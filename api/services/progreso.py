"""Consultas de la pestaña Progreso.

Ninguna agrupa por día de calendario en el servidor. `func.date()` sobre un
timestamptz se evalúa en el timezone de la sesión de Postgres, así que el
mismo entrenamiento cae en un día distinto según dónde corra la consulta:
producción está en UTC y el Postgres local en America/Santiago. La agrupación
por día, semana y mes vive entera en el cliente, que es el único que conoce el
huso del usuario.
"""

from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from api.models import CatalogExercise, Workout, WorkoutExercise, WorkoutSet


class VentanaInvalida(ValueError):
    """`desde` posterior a `hasta`."""


def _validar(desde: datetime, hasta: datetime) -> None:
    if desde > hasta:
        raise VentanaInvalida("La ventana empieza después de terminar")


def mapa(sesion: Session, user_id: str, desde: datetime, hasta: datetime) -> list[dict]:
    """Un registro por entrenamiento de la ventana, con su duración en minutos.

    La resta la hace el servidor porque es aritmética, no lógica de calendario.
    Lo que el servidor no decide nunca es a qué día pertenece cada uno.
    """
    _validar(desde, hasta)

    filas = sesion.execute(
        select(Workout.started_at, Workout.ended_at).where(
            Workout.user_id == user_id,
            Workout.started_at >= desde,
            Workout.started_at < hasta,
        )
    ).all()

    return [
        {
            "started_at": inicio,
            "minutos": int((fin - inicio).total_seconds() // 60),
        }
        for inicio, fin in filas
    ]


# Las series cuyo ejercicio ya no está en el catálogo. Se muestran en vez de
# desaparecer: un número que se lee como un hecho no puede venir corto en
# silencio.
SIN_CLASIFICAR = "Sin clasificar"


def series_por_grupo(
    sesion: Session, user_id: str, desde: datetime, hasta: datetime
) -> list[dict]:
    """Series por grupo muscular primario en la ventana.

    Cuenta SOLO `body_part_es`, el primario. Los secundarios usan otro
    vocabulario ("Bíceps", "Flexores de cadera") que no coincide con los diez
    grupos, así que sumarlos exigiría una tabla de mapeo escrita a mano y
    acreditaría grupos que no se entrenaron.

    El recorte va por el `started_at` del ENTRENAMIENTO, no por el
    `completed_at` de cada serie: una sesión pertenece a la semana en que
    empezó, igual que en el mapa.

    `outerjoin` contra el catálogo a propósito: no hay FK y la ingesta borra lo
    que ya no está en el dataset.
    """
    _validar(desde, hasta)

    filas = sesion.execute(
        select(CatalogExercise.body_part_es, func.count(WorkoutSet.id))
        .select_from(WorkoutSet)
        .join(WorkoutExercise, WorkoutSet.workout_exercise_id == WorkoutExercise.id)
        .join(Workout, WorkoutExercise.workout_id == Workout.id)
        .outerjoin(CatalogExercise, CatalogExercise.id == WorkoutExercise.catalog_id)
        .where(
            Workout.user_id == user_id,
            Workout.started_at >= desde,
            Workout.started_at < hasta,
        )
        .group_by(CatalogExercise.body_part_es)
    ).all()

    return [
        {"grupo": grupo if grupo is not None else SIN_CLASIFICAR, "series": series}
        for grupo, series in filas
    ]


def progresion_ejercicio(
    sesion: Session,
    user_id: str,
    catalog_id: str,
    limite: int,
    hasta: datetime | None,
) -> list[dict]:
    """El máximo de kg levantado por sesión en ESTE ejercicio.

    Se agrupa por entrenamiento (Workout.id), no por calendario: la ventana
    son las últimas SESIONES donde apareció el ejercicio, no días ni semanas.
    Un ejercicio puede hacerse cada varias semanas y una ventana calendario
    dejaría casi todo vacío, a diferencia del mapa de asistencia.
    """
    condiciones = [Workout.user_id == user_id, WorkoutExercise.catalog_id == catalog_id]
    if hasta is not None:
        condiciones.append(Workout.started_at < hasta)

    filas = sesion.execute(
        select(Workout.started_at, func.max(WorkoutSet.weight_kg))
        .select_from(WorkoutSet)
        .join(WorkoutExercise, WorkoutSet.workout_exercise_id == WorkoutExercise.id)
        .join(Workout, WorkoutExercise.workout_id == Workout.id)
        .where(*condiciones)
        .group_by(Workout.id, Workout.started_at)
        .order_by(Workout.started_at.desc())
        .limit(limite)
    ).all()

    return [
        {"started_at": inicio, "max_weight_kg": maximo}
        for inicio, maximo in filas
    ]
