import unicodedata


def normalizar(texto: str) -> str:
    """Deja el texto comparable: sin acentos, en minúsculas y sin espacios de más.

    La ñ se convierte en n. Es lo esperable al buscar desde un teclado de
    teléfono, donde escribir acentos es incómodo.
    """
    if not texto:
        return ""
    descompuesto = unicodedata.normalize("NFD", texto)
    sin_acentos = "".join(c for c in descompuesto if unicodedata.category(c) != "Mn")
    return " ".join(sin_acentos.lower().split())


from sqlalchemy import func, select
from sqlalchemy.orm import Session

from api.models import CatalogExercise

LIMITE_POR_DEFECTO = 50
LIMITE_MAXIMO = 200


def _filtrar(consulta, q, body_part, equipment):
    """Aplica los filtros comunes a la búsqueda y al conteo.

    Vive aparte para que `buscar` y `contar` no puedan divergir: si el conteo
    filtrara distinto, `total` volvería a mentir.
    """
    if q:
        consulta = consulta.where(CatalogExercise.nombre_norm.contains(normalizar(q)))
    if body_part:
        consulta = consulta.where(CatalogExercise.body_part_es == body_part)
    if equipment:
        consulta = consulta.where(CatalogExercise.equipment_es == equipment)
    return consulta


def buscar(
    sesion: Session,
    q: str | None = None,
    body_part: str | None = None,
    equipment: str | None = None,
    limite: int = LIMITE_POR_DEFECTO,
    desplazamiento: int = 0,
) -> list[CatalogExercise]:
    """Devuelve una página del catálogo. Los filtros se combinan con AND."""
    consulta = _filtrar(select(CatalogExercise), q, body_part, equipment)
    consulta = (
        consulta.order_by(CatalogExercise.nombre_es, CatalogExercise.id)
        .limit(limite)
        .offset(desplazamiento)
    )
    return list(sesion.execute(consulta).scalars())


def contar(
    sesion: Session,
    q: str | None = None,
    body_part: str | None = None,
    equipment: str | None = None,
) -> int:
    """Cuenta todas las coincidencias, sin importar la página pedida."""
    consulta = _filtrar(
        select(func.count()).select_from(CatalogExercise), q, body_part, equipment
    )
    return sesion.execute(consulta).scalar_one()


def filtros(sesion: Session) -> dict[str, list[str]]:
    """Valores disponibles para filtrar, sacados de los propios datos.

    Salen de la base y no de una lista escrita a mano: así la app nunca
    ofrece un filtro que devuelve cero resultados, y si cambia el dataset
    los filtros se actualizan solos.
    """
    grupos = sesion.execute(
        select(CatalogExercise.body_part_es)
        .distinct()
        .order_by(CatalogExercise.body_part_es)
    ).scalars()
    equipos = sesion.execute(
        select(CatalogExercise.equipment_es)
        .distinct()
        .order_by(CatalogExercise.equipment_es)
    ).scalars()
    return {"grupos_musculares": list(grupos), "equipamientos": list(equipos)}
