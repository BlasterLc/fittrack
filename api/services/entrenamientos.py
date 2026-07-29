"""Lógica de entrenamientos. Los routers no deciden nada, solo traducen HTTP."""

from datetime import date, datetime

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from api.models import (
    CatalogExercise,
    Routine,
    RoutineExercise,
    Workout,
    WorkoutExercise,
    WorkoutSet,
)
from api.services import routines


class EntrenamientoInvalido(ValueError):
    """El cuerpo no cumple las reglas: sin ejercicios válidos, fechas al revés…"""


def resumen_del_dia(sesion: Session, user_id: str, dia: date) -> dict | None:
    """Series y minutos de lo entrenado ese día, o None si no entrenó.

    Si hubo más de un entrenamiento se suman: son dos sesiones del mismo día.
    """
    entrenamientos = list(
        sesion.execute(
            select(Workout).where(
                Workout.user_id == user_id,
                func.date(Workout.started_at) == dia,
            )
        ).scalars()
    )
    if not entrenamientos:
        return None

    series = sum(len(e.series) for w in entrenamientos for e in w.ejercicios)
    minutos = sum(
        int((w.ended_at - w.started_at).total_seconds() // 60) for w in entrenamientos
    )
    return {"series": series, "duracion_min": minutos}


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


def _actualizar_rutina(
    rutina: Routine | None,
    validos: list[dict],
    agregar: list[str],
    existentes: set[str],
) -> None:
    """Escribe los defaults y suma los ejercicios confirmados.

    Corre dentro de la misma transacción que el guardado, para que no pueda
    quedar el entrenamiento guardado y la rutina a medias. La rutina llega ya
    resuelta y verificada por `guardar`: si no existe o es de otro usuario, el
    guardado entero se rechaza antes de llegar hasta acá.
    """
    # Una rutina archivada se deja quieta: ya no la usas, y ensuciarla con los
    # defaults de hoy no le sirve a nadie.
    if rutina is None or rutina.archived_at is not None:
        return

    por_catalogo = {e.catalog_id: e for e in rutina.ejercicios}

    # Se agregan filas sueltas en vez de reasignar `rutina.ejercicios`: con
    # `delete-orphan` los INSERT salen antes que los DELETE en el mismo flush y
    # la restricción `uq_rutina_ejercicio` reventaría. Acá no se reemplaza nada,
    # y el que ya está en la rutina se saltea.
    siguiente = len(rutina.ejercicios)
    for catalog_id in agregar:
        # `existentes` son los catalog_id del entrenamiento que están en el
        # catálogo: no se suma a la rutina algo que no se hizo o que ya no existe.
        if catalog_id in por_catalogo or catalog_id not in existentes:
            continue
        fila = RoutineExercise(catalog_id=catalog_id, orden=siguiente)
        rutina.ejercicios.append(fila)
        # Se registra ya para que reciba sus defaults abajo como cualquier otro
        # ejercicio de la rutina, y para no agregarlo dos veces si viene repetido.
        por_catalogo[catalog_id] = fila
        siguiente += 1

    for ejercicio in validos:
        fila = por_catalogo.get(ejercicio["catalog_id"])
        # Un ejercicio hecho sobre la marcha y no confirmado no tiene fila en la
        # rutina, así que no guarda defaults.
        if fila is None:
            continue
        # La PRIMERA serie, no la última: las últimas bajan por cansancio, y
        # arrancar ahí la próxima vez degradaría la meta sola (80 → 75 → 70).
        primera = ejercicio["series"][0]
        fila.sets_default = len(ejercicio["series"])
        fila.reps_default = primera["reps"]
        fila.weight_default = primera["weight_kg"]


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
    rutina = None
    if routine_id is not None:
        # El lock va en esta lectura, que igual hay que hacer: no es una consulta
        # de más. Serializa los guardados contra la misma rutina, igual que los
        # PUT de la 5b. No hace falta entrenar dos veces a la vez para llegar
        # acá: si el teléfono estuvo sin señal quedan borradores en cola y al
        # recuperar conexión pueden salir juntos. Si los dos confirman el mismo
        # ejercicio nuevo, sin lock chocan contra `uq_rutina_ejercicio`, y el
        # `except IntegrityError` de más abajo solo sabe recuperarse del
        # `client_id` repetido: re-lanzaría, y el usuario vería un 500 sin
        # mensaje. No es decorativo: sacarlo reabre ese 500.
        rutina = routines.obtener(sesion, user_id, routine_id, para_actualizar=True)
        if rutina is None:
            raise EntrenamientoInvalido(
                "La rutina del entrenamiento no existe o no te pertenece"
            )

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
    _actualizar_rutina(rutina, validos, datos.get("agregar_a_rutina", []), existentes)

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
