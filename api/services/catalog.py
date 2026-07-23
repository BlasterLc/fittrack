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


from sqlalchemy import select
from sqlalchemy.orm import Session

from api.models import CatalogExercise

LIMITE_POR_DEFECTO = 50


def buscar(
    sesion: Session,
    q: str | None = None,
    body_part: str | None = None,
    equipment: str | None = None,
    limite: int = LIMITE_POR_DEFECTO,
) -> list[CatalogExercise]:
    """Busca en el catálogo. Los filtros se combinan con AND."""
    consulta = select(CatalogExercise)

    if q:
        consulta = consulta.where(CatalogExercise.nombre_norm.contains(normalizar(q)))
    if body_part:
        consulta = consulta.where(CatalogExercise.body_part_es == body_part)
    if equipment:
        consulta = consulta.where(CatalogExercise.equipment_es == equipment)

    consulta = consulta.order_by(CatalogExercise.nombre_es).limit(limite)
    return list(sesion.execute(consulta).scalars())
