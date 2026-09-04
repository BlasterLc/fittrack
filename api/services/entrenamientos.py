"""Lógica de entrenamientos. Los routers no deciden nada, solo traducen HTTP."""

from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

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


def resumen_del_dia(
    sesion: Session, user_id: str, inicio: datetime, fin: datetime
) -> dict | None:
    """Series y minutos de lo entrenado en esa ventana, o None si no entrenó.

    Si hubo más de un entrenamiento se suman: son dos sesiones del mismo día.

    El recorte va por rango explícito y NO por `func.date()`: `date()` sobre un
    timestamptz se evalúa en el timezone de la sesión de Postgres, así que el
    mismo entrenamiento caía en un día o en otro según cómo estuviera
    configurada la base. Además dejaba esta mitad del dashboard en desacuerdo
    con la de comidas, que siempre usó un rango.
    """
    entrenamientos = list(
        sesion.execute(
            select(Workout).where(
                Workout.user_id == user_id,
                Workout.started_at >= inicio,
                Workout.started_at < fin,
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


def racha_dias(sesion: Session, user_id: str, inicio_hoy: datetime) -> int:
    """Días consecutivos con al menos un entrenamiento, contando hacia atrás
    desde el día de `inicio_hoy` (el borde de medianoche local que ya manda el
    teléfono, igual que `resumen_del_dia`).

    Si hoy todavía no hay entrenamiento guardado, la racha no se corta ahí: se
    prueba ayer y se sigue contando desde donde haya registro. Recién se corta
    cuando aparece un día completo sin nada.

    Camina de a un día con `timedelta(days=1)` sobre el mismo borde que ya
    manda el teléfono — no corrige el cambio de horario de verano, que mueve
    el borde una hora dos veces al año y no saca ningún entrenamiento real de
    su día.
    """

    def entrenado_en(dia_inicio: datetime, dia_fin: datetime) -> bool:
        return (
            sesion.execute(
                select(Workout.id)
                .where(
                    Workout.user_id == user_id,
                    Workout.started_at >= dia_inicio,
                    Workout.started_at < dia_fin,
                )
                .limit(1)
            ).first()
            is not None
        )

    dia_inicio = inicio_hoy
    dia_fin = inicio_hoy + timedelta(days=1)

    if not entrenado_en(dia_inicio, dia_fin):
        dia_fin = dia_inicio
        dia_inicio = dia_inicio - timedelta(days=1)
        if not entrenado_en(dia_inicio, dia_fin):
            return 0

    racha = 0
    while entrenado_en(dia_inicio, dia_fin):
        racha += 1
        dia_fin = dia_inicio
        dia_inicio = dia_inicio - timedelta(days=1)
    return racha


def ultima_rutina_activa(sesion: Session, user_id: str) -> Routine | None:
    """La rutina del entrenamiento más reciente del usuario que siga activa.

    Si la rutina del entrenamiento más reciente está archivada, sigue
    buscando hacia atrás hasta la primera que no lo esté — mismo criterio que
    ya usa la lista de rutinas, donde una archivada no se puede "Empezar".
    """
    return sesion.execute(
        select(Routine)
        .join(Workout, Workout.routine_id == Routine.id)
        .where(Workout.user_id == user_id, Routine.archived_at.is_(None))
        .order_by(Workout.started_at.desc())
        .limit(1)
    ).scalar_one_or_none()


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
            # `orden` sigue la secuencia en que se marcaron los checks, no la
            # posición de la fila: el usuario puede saltear una serie y volver
            # a ella. `completed_at` es obligatorio en cada serie, así que el
            # orden siempre queda definido.
            series=[
                WorkoutSet(
                    orden=j,
                    reps=s["reps"],
                    weight_kg=s["weight_kg"],
                    completed_at=s["completed_at"],
                )
                for j, s in enumerate(
                    sorted(e["series"], key=lambda s: s["completed_at"])
                )
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


# Lo que se muestra cuando la ingesta borró la ficha del ejercicio. Distinto de
# `_resumen`, que muestra el catalog_id crudo: ahí es el eco inmediato de algo
# que se acaba de guardar, acá es una lista que se lee meses después, y un
# "0025" no le dice nada a nadie.
NOMBRE_BORRADO = "Ejercicio no disponible"

LIMITE_MAXIMO = 100


def historial(
    sesion: Session, user_id: str, hasta: datetime | None, limite: int
) -> list[dict]:
    """Los `limite` entrenamientos anteriores a `hasta`, del más nuevo al más viejo.

    Pagina por CANTIDAD y no por mes: pidiendo mes a mes, un usuario con un solo
    entrenamiento dispararía una request por cada mes vacío hacia atrás antes de
    encontrar algo. Los encabezados por mes los arma el cliente, que es el único
    que sabe en qué huso cae cada entrenamiento.
    """
    condiciones = [Workout.user_id == user_id]
    if hasta is not None:
        condiciones.append(Workout.started_at < hasta)

    entrenamientos = list(
        sesion.execute(
            select(Workout)
            .where(*condiciones)
            .order_by(Workout.started_at.desc())
            .limit(limite)
            # Sin esto son N+1 consultas: una por entrenamiento para sus
            # ejercicios y otra por ejercicio para sus series.
            .options(
                selectinload(Workout.ejercicios).selectinload(WorkoutExercise.series)
            )
        ).scalars()
    )
    if not entrenamientos:
        return []

    ids_catalogo = {e.catalog_id for w in entrenamientos for e in w.ejercicios}
    nombres = dict(
        sesion.execute(
            select(CatalogExercise.id, CatalogExercise.nombre_es).where(
                CatalogExercise.id.in_(ids_catalogo)
            )
        ).all()
    )

    ids_rutina = {w.routine_id for w in entrenamientos if w.routine_id is not None}
    rutinas = (
        dict(
            sesion.execute(
                select(Routine.id, Routine.nombre).where(Routine.id.in_(ids_rutina))
            ).all()
        )
        if ids_rutina
        else {}
    )

    return [
        {
            "id": w.id,
            "nombre_rutina": rutinas.get(w.routine_id),
            "started_at": w.started_at,
            "duracion_min": int((w.ended_at - w.started_at).total_seconds() // 60),
            "total_series": sum(len(e.series) for e in w.ejercicios),
            "total_ejercicios": len(w.ejercicios),
            "ejercicios": [
                {
                    "catalog_id": e.catalog_id,
                    "nombre_es": nombres.get(e.catalog_id, NOMBRE_BORRADO),
                    "series": [
                        {"orden": s.orden, "reps": s.reps, "weight_kg": s.weight_kg}
                        for s in e.series
                    ],
                }
                for e in w.ejercicios
            ],
        }
        for w in entrenamientos
    ]
