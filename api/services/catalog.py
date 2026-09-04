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


from sqlalchemy import func, or_, select
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
        # Cada palabra de la consulta se busca por separado y contra los dos
        # idiomas: así "press banca" encuentra "Press de banca con barra" sin
        # ser un substring literal, y "deltoid fly" (que en el dataset solo
        # existe en inglés y con las palabras separadas) también cae.
        for palabra in normalizar(q).split():
            consulta = consulta.where(
                or_(
                    CatalogExercise.nombre_norm.contains(palabra),
                    func.lower(CatalogExercise.nombre_en).contains(palabra),
                )
            )
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


def _valores(sesion: Session, columna, q, body_part, equipment) -> list[str]:
    consulta = _filtrar(select(columna).distinct(), q, body_part, equipment)
    return list(sesion.execute(consulta.order_by(columna)).scalars())


def filtros(
    sesion: Session,
    q: str | None = None,
    body_part: str | None = None,
    equipment: str | None = None,
) -> dict[str, list[str]]:
    """Valores para filtrar, sacados de los propios datos.

    Devuelve dos cosas por dimensión: la lista completa (los chips que se
    dibujan, siempre los mismos para que no salten) y cuáles de esos valores
    siguen dando resultados con los filtros que ya están activos.

    La distinción importa porque los filtros se combinan con AND. Que un
    valor exista no significa que se pueda combinar: "Balón bosu" solo
    aparece en Pecho y Piernas, así que con Espalda activo da cero. Antes se
    devolvían las dos listas completas sin cruzarlas y la app ofrecía
    combinaciones vacías.

    Cada dimensión se restringe por las OTRAS, nunca por sí misma: si los
    grupos se filtraran por el grupo activo quedaría uno solo disponible y
    sería imposible cambiar de grupo sin limpiar el filtro primero.
    """
    return {
        "grupos_musculares": _valores(sesion, CatalogExercise.body_part_es, None, None, None),
        "equipamientos": _valores(sesion, CatalogExercise.equipment_es, None, None, None),
        "grupos_disponibles": _valores(
            sesion, CatalogExercise.body_part_es, q, None, equipment
        ),
        "equipamientos_disponibles": _valores(
            sesion, CatalogExercise.equipment_es, q, body_part, None
        ),
    }
