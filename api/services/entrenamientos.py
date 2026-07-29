"""Lógica de entrenamientos. Los routers no deciden nada, solo traducen HTTP."""

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from api.models import CatalogExercise, Workout, WorkoutExercise, WorkoutSet
from api.services import routines


class EntrenamientoInvalido(ValueError):
    """El cuerpo no cumple las reglas: sin ejercicios válidos, fechas al revés…"""


def _buscar_por_cliente(sesion: Session, user_id: str, client_id: str) -> Workout | None:
    """El entrenamiento que ese cliente ya guardó, si existe.

    Filtra por user_id además de client_id: el client_id lo genera el teléfono
    y no se puede confiar en que sea único entre usuarios.
    """
    return sesion.execute(
        select(Workout).where(
            Workout.user_id == user_id, Workout.client_id == client_id
        )
    ).scalar_one_or_none()


def _resumen(sesion: Session, entrenamiento: Workout, omitidos: list[str]) -> dict:
    ids = [e.catalog_id for e in entrenamiento.ejercicios]
    fichas = {
        f.id: f
        for f in sesion.execute(
            select(CatalogExercise).where(CatalogExercise.id.in_(ids))
        ).scalars()
    }
    minutos = int(
        (entrenamiento.ended_at - entrenamiento.started_at).total_seconds() // 60
    )
    return {
        "id": entrenamiento.id,
        "duracion_min": minutos,
        "total_series": sum(len(e.series) for e in entrenamiento.ejercicios),
        "total_ejercicios": len(entrenamiento.ejercicios),
        "ejercicios": [
            {
                "catalog_id": e.catalog_id,
                # Si la ingesta borró la ficha después de guardar, se muestra el
                # id: es feo, pero no rompe el resumen de un entrenamiento hecho.
                "nombre_es": (
                    fichas[e.catalog_id].nombre_es
                    if e.catalog_id in fichas
                    else e.catalog_id
                ),
                "series": [
                    {"orden": s.orden, "reps": s.reps, "weight_kg": s.weight_kg}
                    for s in e.series
                ],
            }
            for e in entrenamiento.ejercicios
        ],
        "omitidos": omitidos,
    }


def guardar(sesion: Session, user_id: str, datos: dict) -> dict:
    """Guarda el entrenamiento completo. Idempotente por client_id.

    El entrenamiento llega entero porque la sesión vivió en el teléfono: no hay
    guardado incremental que reconciliar, solo un insert grande o ninguno.
    """
    # La idempotencia va primero, antes que cualquier validación: lo que ya está
    # guardado se devuelve tal cual. Un reintento no puede fallar por reglas que
    # cambiaron después de guardarlo (una ficha del catálogo que la ingesta borró,
    # una rutina que dejó de existir); el entrenamiento ya es un hecho.
    ya_existe = _buscar_por_cliente(sesion, user_id, datos["client_id"])
    if ya_existe is not None:
        return _resumen(sesion, ya_existe, omitidos=[])

    inicio: datetime = datos["started_at"]
    fin: datetime = datos["ended_at"]
    if fin < inicio:
        raise EntrenamientoInvalido("El entrenamiento no puede terminar antes de empezar")

    # Se valida antes de insertar, no atrapando la violación de la FK: así el
    # usuario recibe un mensaje y no un 500. Una rutina archivada se acepta,
    # porque se archiva en vez de borrar justamente para no dejar huérfano al
    # historial que la referencia.
    routine_id = datos.get("routine_id")
    if routine_id is not None and routines.obtener(sesion, user_id, routine_id) is None:
        raise EntrenamientoInvalido("La rutina del entrenamiento no existe o no te pertenece")

    pedidos = [e["catalog_id"] for e in datos["ejercicios"]]
    existentes = set(
        sesion.execute(
            select(CatalogExercise.id).where(CatalogExercise.id.in_(pedidos))
        ).scalars()
    )
    # Se guarda lo válido y se informa lo omitido. Rechazar el entrenamiento
    # entero haría perder una hora de trabajo por un ejercicio que la ingesta
    # borró mientras el usuario entrenaba.
    omitidos = [c for c in pedidos if c not in existentes]
    validos = [e for e in datos["ejercicios"] if e["catalog_id"] in existentes]
    if not validos:
        raise EntrenamientoInvalido(
            "Ninguno de los ejercicios del entrenamiento existe en el catálogo"
        )

    entrenamiento = Workout(
        user_id=user_id,
        client_id=datos["client_id"],
        routine_id=routine_id,
        started_at=inicio,
        ended_at=fin,
    )
    entrenamiento.ejercicios = [
        WorkoutExercise(
            catalog_id=e["catalog_id"],
            orden=i,
            series=[
                WorkoutSet(
                    orden=j,
                    reps=s["reps"],
                    weight_kg=s["weight_kg"],
                    completed_at=s["completed_at"],
                )
                for j, s in enumerate(e["series"])
            ],
        )
        for i, e in enumerate(validos)
    ]
    sesion.add(entrenamiento)

    try:
        sesion.commit()
    except IntegrityError:
        # Dos POST simultáneos con el mismo client_id: la restricción de
        # unicidad hizo su trabajo. Gana el que llegó primero.
        sesion.rollback()
        existente = _buscar_por_cliente(sesion, user_id, datos["client_id"])
        if existente is None:
            raise
        return _resumen(sesion, existente, omitidos=[])

    sesion.refresh(entrenamiento)
    return _resumen(sesion, entrenamiento, omitidos)
