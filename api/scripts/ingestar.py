"""Carga el catálogo traducido en Postgres.

Uso:
    python -m api.scripts.ingestar

Idempotente: vuelve a ejecutarse sin duplicar y actualiza traducciones
corregidas a mano.
"""

import json
import sys
from pathlib import Path

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from api.database import get_engine
from api.models import CatalogExercise
from api.scripts.mapeos import BODY_PART, EQUIPMENT, TARGET, traducir
from api.services.catalog import normalizar

ATRIBUCION = "© Gym visual — gymvisual.com"
FICHAS = Path("data/exercises.json")
NOMBRES = Path("data/nombres_es.json")


def construir_fila(ficha: dict, traducciones: dict[str, str]) -> dict:
    nombre_en = ficha["name"]
    nombre_es = traducciones.get(nombre_en, nombre_en)
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
        "secondary_muscles": ficha.get("secondary_muscles") or [],
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


def ingestar(sesion: Session, fichas: list[dict], traducciones: dict[str, str]) -> int:
    filas = [construir_fila(f, traducciones) for f in fichas]
    for fila in filas:
        sentencia = insert(CatalogExercise).values(**fila)
        sentencia = sentencia.on_conflict_do_update(
            index_elements=["id"],
            set_={k: v for k, v in fila.items() if k != "id"},
        )
        sesion.execute(sentencia)
    sesion.commit()
    return len(filas)


def main() -> int:
    fichas = json.loads(FICHAS.read_text())
    traducciones = json.loads(NOMBRES.read_text()) if NOMBRES.exists() else {}
    print(f"{len(fichas)} fichas · {len(traducciones)} traducciones disponibles")

    from api.database import Base

    Base.metadata.create_all(bind=get_engine())

    with Session(get_engine()) as sesion:
        total = ingestar(sesion, fichas, traducciones)
        print(f"Ingeridas {total} fichas")
        sin_traducir = sesion.query(CatalogExercise).filter(
            CatalogExercise.nombre_es == CatalogExercise.nombre_en
        ).count()
        if sin_traducir:
            print(f"Aviso: {sin_traducir} fichas quedaron con el nombre en inglés")
    return 0


if __name__ == "__main__":
    sys.exit(main())
