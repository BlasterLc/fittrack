"""Carga el catálogo traducido en Postgres.

Uso:
    python -m api.scripts.ingestar

Convergente: vuelve a ejecutarse sin duplicar, actualiza traducciones
corregidas a mano y borra lo que ya no está en el dataset de origen.
"""

import json
import sys
from pathlib import Path
from typing import NamedTuple

from sqlalchemy import delete
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from api.database import get_engine
from api.models import CatalogExercise
from api.scripts.mapeos import BODY_PART, EQUIPMENT, SECONDARY, TARGET, traducir
from api.services.catalog import normalizar

ATRIBUCION = "© Gym visual — gymvisual.com"
FICHAS = Path("data/exercises.json")
NOMBRES = Path("data/nombres_es.json")


def construir_fila(ficha: dict, traducciones: dict[str, str]) -> dict:
    nombre_en = ficha["name"]
    nombre_es = traducciones.get(nombre_en, nombre_en)
    secundarios = ficha.get("secondary_muscles") or []
    return {
        "id": ficha["id"],
        "nombre_en": nombre_en,
        "nombre_es": nombre_es,
        "nombre_norm": normalizar(nombre_es),
        "body_part": ficha.get("body_part", ""),
        "body_part_es": traducir(BODY_PART, ficha.get("body_part", "")),
        "equipment": ficha.get("equipment", ""),
        "equipment_es": traducir(EQUIPMENT, ficha.get("equipment", "")),
        "target": ficha.get("target", ""),
        "target_es": traducir(TARGET, ficha.get("target", "")),
        "secondary_muscles": secundarios,
        "secondary_muscles_es": [traducir(SECONDARY, m) for m in secundarios],
        "instrucciones_es": (ficha.get("instruction_steps") or {}).get("es") or [],
        "gif_path": Path(ficha.get("gif_url", "")).name,
        "atribucion": ATRIBUCION,
    }


def desduplicar(filas: list[dict]) -> list[dict]:
    """Deja una sola fila por (nombre_es, equipment, target).

    El dataset de origen repite 11 ejercicios (23 fichas en total) con
    nombres distintos en inglés que traducen al mismo nombre en español,
    o directamente con el mismo nombre en inglés. Comparten equipamiento y
    músculo objetivo: son el mismo movimiento grabado dos veces.

    Se compara por los tres campos y no solo por el nombre: si una
    traducción futura hiciera colisionar dos ejercicios genuinamente
    distintos, no deben fusionarse — eso es un bug de traducción y se
    corrige en `nombres_es.json`.

    Se conserva la ficha de id más bajo, que es determinista y no depende
    del orden del JSON de origen.
    """
    por_clave: dict[tuple[str, str, str], dict] = {}
    for fila in sorted(filas, key=lambda f: f["id"]):
        clave = (fila["nombre_es"], fila["equipment"], fila["target"])
        por_clave.setdefault(clave, fila)
    return sorted(por_clave.values(), key=lambda f: f["id"])


def preparar_filas(fichas: list[dict], traducciones: dict[str, str]) -> list[dict]:
    """Filas construidas y desduplicadas, antes de tocar la base.

    Separada de `ingestar()` para que `main()` pueda saber cuántas filas
    va a dejar la corrida *antes* de ejecutarla — la red de seguridad
    necesita ese número para decidir si aborta, sin duplicar la lógica
    de construcción y desduplicado.
    """
    return desduplicar([construir_fila(f, traducciones) for f in fichas])


class ResultadoIngesta(NamedTuple):
    total: int
    borradas: int


def ingestar(
    sesion: Session, fichas: list[dict], traducciones: dict[str, str]
) -> ResultadoIngesta:
    """Deja la tabla igual al dataset: inserta, actualiza y elimina.

    Es convergente, no solo idempotente: las filas que están en la base
    pero no en el dataset (o que quedaron descartadas por duplicadas) se
    borran. Sin eso, desduplicar no tendría efecto sobre una base que ya
    fue cargada.
    """
    filas = preparar_filas(fichas, traducciones)

    for fila in filas:
        sentencia = insert(CatalogExercise).values(**fila)
        sentencia = sentencia.on_conflict_do_update(
            index_elements=["id"],
            set_={k: v for k, v in fila.items() if k != "id"},
        )
        sesion.execute(sentencia)

    ids = [f["id"] for f in filas]
    sobrantes = delete(CatalogExercise)
    if ids:
        # Redundante en Postgres (not_in([]) ya borra todo), pero deja
        # explícito el caso más peligroso: sin filas que conservar, se
        # vacía la tabla.
        sobrantes = sobrantes.where(CatalogExercise.id.not_in(ids))
    resultado = sesion.execute(sobrantes)

    sesion.commit()
    return ResultadoIngesta(total=len(filas), borradas=resultado.rowcount)


def reduccion_sospechosa(previstas: int, existentes: int, margen: float = 0.9) -> bool:
    """Decide si una corrida dejaría muy pocas filas como para ser confiable.

    El margen no es 1.0 porque una reducción chica es normal y esperada:
    desduplicar ya recorta filas que estaban de más (en esta fase, de 1324
    a 1312, un 99%). El margen deja pasar eso y solo dispara ante una caída
    grande, que es la señal de un `exercises.json` corrupto o truncado —
    el caso que esta función existe para frenar antes del `DELETE`.

    Una base vacía (`existentes == 0`) nunca es sospechosa: es la primera
    carga, no hay nada contra qué comparar, y bloquearla dejaría la app
    sin poder arrancar nunca.
    """
    return existentes > 0 and previstas < existentes * margen


def main() -> int:
    fichas = json.loads(FICHAS.read_text())
    traducciones = json.loads(NOMBRES.read_text()) if NOMBRES.exists() else {}
    print(f"{len(fichas)} fichas · {len(traducciones)} traducciones disponibles")

    from api.database import Base

    Base.metadata.create_all(bind=get_engine())

    forzar = "--forzar" in sys.argv

    with Session(get_engine()) as sesion:
        existentes = sesion.query(CatalogExercise).count()
        filas_previstas = preparar_filas(fichas, traducciones)

        # Un exercises.json corrupto o truncado ya no queda sin efecto: la
        # ingesta ahora borra lo que sobra, así que una reducción grande e
        # inesperada podría vaciar producción. Si es intencional, se fuerza.
        if reduccion_sospechosa(len(filas_previstas), existentes) and not forzar:
            print(
                f"Abortado: la ingesta dejaría {len(filas_previstas)} fichas, "
                f"hay {existentes} en la base — es una reducción sospechosa. "
                "Si es intencional, corre de nuevo con --forzar."
            )
            return 1

        resultado = ingestar(sesion, fichas, traducciones)
        print(
            f"Ingeridas {resultado.total} fichas "
            f"({len(fichas) - resultado.total} duplicadas descartadas · "
            f"{resultado.borradas} borradas de la base)"
        )
        sin_traducir = sesion.query(CatalogExercise).filter(
            CatalogExercise.nombre_es == CatalogExercise.nombre_en
        ).count()
        if sin_traducir:
            print(f"Aviso: {sin_traducir} fichas quedaron con el nombre en inglés")
    return 0


if __name__ == "__main__":
    sys.exit(main())
