"""Consultas de la pestaña Progreso.

Ninguna agrupa por día de calendario en el servidor. `func.date()` sobre un
timestamptz se evalúa en el timezone de la sesión de Postgres, así que el
mismo entrenamiento cae en un día distinto según dónde corra la consulta:
producción está en UTC y el Postgres local en America/Santiago. La agrupación
por día, semana y mes vive entera en el cliente, que es el único que conoce el
huso del usuario.
"""

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from api.models import Workout


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
