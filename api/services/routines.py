"""Lógica de rutinas. Los routers no deciden nada, solo traducen HTTP."""

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from api.models import (
    CatalogExercise,
    Routine,
    RoutineExercise,
    Workout,
    WorkoutExercise,
    WorkoutSet,
)


class RutinaInvalida(ValueError):
    """El nombre o la lista de ejercicios no cumplen las reglas."""


class EjercicioDesconocido(ValueError):
    """Se pidió un catalog_id que no está en el catálogo."""


def _grupos_por_rutina(
    sesion: Session, ids: list[int]
) -> dict[int, list[str]]:
    """Grupos musculares de cada rutina, en una sola consulta.

    El JOIN es interno a propósito: un ejercicio que la ingesta ya borró
    simplemente no aparece, y el conteo refleja lo que existe de verdad.
    """
    if not ids:
        return {}

    filas = sesion.execute(
        select(RoutineExercise.routine_id, CatalogExercise.body_part_es)
        .join(CatalogExercise, CatalogExercise.id == RoutineExercise.catalog_id)
        .where(RoutineExercise.routine_id.in_(ids))
    ).all()

    por_rutina: dict[int, list[str]] = {}
    for routine_id, grupo in filas:
        por_rutina.setdefault(routine_id, []).append(grupo)
    return por_rutina


def listar(sesion: Session, user_id: str, archivadas: bool = False) -> list[dict]:
    """Rutinas del usuario con su conteo y los grupos musculares que cubren."""
    consulta = select(Routine).where(Routine.user_id == user_id)
    consulta = consulta.where(
        Routine.archived_at.is_not(None) if archivadas else Routine.archived_at.is_(None)
    )
    rutinas = list(
        sesion.execute(consulta.order_by(Routine.nombre, Routine.id)).scalars()
    )

    grupos = _grupos_por_rutina(sesion, [r.id for r in rutinas])
    return [
        {
            "id": r.id,
            "nombre": r.nombre,
            "archived_at": r.archived_at,
            "total_ejercicios": len(grupos.get(r.id, [])),
            "grupos_musculares": sorted(set(grupos.get(r.id, []))),
        }
        for r in rutinas
    ]


def _validar(sesion: Session, nombre: str, catalog_ids: list[str]) -> str:
    """Devuelve el nombre limpio o levanta. Compartido por crear y reemplazar."""
    limpio = nombre.strip()
    if not limpio:
        raise RutinaInvalida("La rutina necesita un nombre")
    if len(limpio) > 80:
        raise RutinaInvalida("El nombre no puede superar los 80 caracteres")
    if not catalog_ids:
        raise RutinaInvalida("La rutina necesita al menos un ejercicio")
    if len(set(catalog_ids)) != len(catalog_ids):
        raise RutinaInvalida("Un ejercicio no puede repetirse en la misma rutina")

    existentes = set(
        sesion.execute(
            select(CatalogExercise.id).where(CatalogExercise.id.in_(catalog_ids))
        ).scalars()
    )
    faltan = [c for c in catalog_ids if c not in existentes]
    if faltan:
        raise EjercicioDesconocido(f"Ejercicios no encontrados: {', '.join(faltan)}")

    return limpio


def crear(
    sesion: Session, user_id: str, nombre: str, catalog_ids: list[str]
) -> Routine:
    """Crea la rutina del usuario con sus ejercicios en el orden recibido."""
    limpio = _validar(sesion, nombre, catalog_ids)

    rutina = Routine(user_id=user_id, nombre=limpio)
    rutina.ejercicios = [
        RoutineExercise(catalog_id=c, orden=i) for i, c in enumerate(catalog_ids)
    ]
    sesion.add(rutina)
    sesion.commit()
    sesion.refresh(rutina)
    return rutina


def obtener(
    sesion: Session, user_id: str, rutina_id: int, para_actualizar: bool = False
) -> Routine | None:
    """La rutina del usuario, o None. Nunca devuelve la de otro.

    Con para_actualizar=True toma un lock de fila: dos guardados simultáneos
    sobre la misma rutina se serializan en vez de chocar contra la restricción
    de unicidad, y gana el último en escribir.
    """
    consulta = select(Routine).where(
        Routine.id == rutina_id, Routine.user_id == user_id
    )
    if para_actualizar:
        consulta = consulta.with_for_update()
    return sesion.execute(consulta).scalar_one_or_none()


def _series_previas(
    sesion: Session, user_id: str, ids: list[str]
) -> dict[str, list[dict]]:
    """Las series de la última vez que se hizo cada ejercicio, una por una.

    Alimenta la columna «Previa» de la sesión. Sale del historial y no de
    `reps_default`/`weight_default`: esos guardan solo la PRIMERA serie, así que
    de ahí cada fila mostraría lo mismo en vez de lo que se hizo en ella.
    """
    if not ids:
        return {}
    # Del más reciente al más viejo: la primera aparición de cada ejercicio es
    # la de su última sesión. Cualquier entrenamiento vale, no solo los de esta
    # rutina: «previa» es la última vez que hiciste ese ejercicio.
    filas = sesion.execute(
        select(WorkoutExercise.catalog_id, WorkoutExercise.id)
        .join(Workout, Workout.id == WorkoutExercise.workout_id)
        .where(Workout.user_id == user_id, WorkoutExercise.catalog_id.in_(ids))
        .order_by(Workout.started_at.desc(), WorkoutExercise.id.desc())
    ).all()
    ultimo: dict[str, int] = {}
    for catalog_id, ejercicio_id in filas:
        ultimo.setdefault(catalog_id, ejercicio_id)
    if not ultimo:
        return {}

    por_ejercicio: dict[int, list[dict]] = {}
    for ejercicio_id, reps, kg in sesion.execute(
        select(WorkoutSet.workout_exercise_id, WorkoutSet.reps, WorkoutSet.weight_kg)
        .where(WorkoutSet.workout_exercise_id.in_(ultimo.values()))
        .order_by(WorkoutSet.workout_exercise_id, WorkoutSet.orden)
    ):
        por_ejercicio.setdefault(ejercicio_id, []).append(
            {"reps": reps, "weight_kg": kg}
        )
    return {c: por_ejercicio.get(e, []) for c, e in ultimo.items()}


def detalle(sesion: Session, user_id: str, rutina_id: int) -> dict | None:
    rutina = obtener(sesion, user_id, rutina_id)
    if rutina is None:
        return None

    ids = [e.catalog_id for e in rutina.ejercicios]
    fichas = {
        f.id: f
        for f in sesion.execute(
            select(CatalogExercise).where(CatalogExercise.id.in_(ids))
        ).scalars()
    }
    # Se respeta el orden de la rutina, no el que devuelva la base. Cada ficha
    # viaja con lo que se hizo la última vez, que es de donde salen los valores
    # iniciales de las ruedas de la sesión.
    por_catalogo = {e.catalog_id: e for e in rutina.ejercicios}
    previas = _series_previas(sesion, user_id, ids)
    encontrados = [
        {
            "id": ficha.id,
            "nombre_es": ficha.nombre_es,
            "body_part_es": ficha.body_part_es,
            "equipment_es": ficha.equipment_es,
            "target_es": ficha.target_es,
            # gif_url lo calcula solo el esquema a partir de gif_path.
            "gif_path": ficha.gif_path,
            "sets_default": por_catalogo[c].sets_default,
            "reps_default": por_catalogo[c].reps_default,
            "weight_default": por_catalogo[c].weight_default,
            "series_previas": previas.get(c, []),
        }
        for c in ids
        if (ficha := fichas.get(c)) is not None
    ]

    return {
        "id": rutina.id,
        "nombre": rutina.nombre,
        "archived_at": rutina.archived_at,
        "ejercicios": encontrados,
        "ejercicios_faltantes": len(ids) - len(encontrados),
    }


def reemplazar(
    sesion: Session,
    user_id: str,
    rutina_id: int,
    nombre: str,
    catalog_ids: list[str],
) -> Routine | None:
    """Deja la rutina exactamente como se pide. Devuelve None si no es del usuario.

    Reemplaza la lista completa en vez de aplicar operaciones sueltas: el editor
    manda el estado final y el servidor converge, igual que `ingestar()`. Evita
    endpoints de "mover" o "quitar" que ningún otro cliente usaría.
    """
    rutina = obtener(sesion, user_id, rutina_id, para_actualizar=True)
    if rutina is None:
        return None

    limpio = _validar(sesion, nombre, catalog_ids)

    rutina.nombre = limpio
    # Lo que se hizo la última vez vive en la fila, y acá las filas se borran y
    # se vuelven a crear. Sin rescatarlo antes, reordenar o agregar un
    # ejercicio dejaría en blanco a TODOS los que sobreviven al reemplazo, y
    # las ruedas de la sesión perderían el punto de partida.
    defaults_previos = {
        e.catalog_id: (e.sets_default, e.reps_default, e.weight_default)
        for e in rutina.ejercicios
    }
    # Las filas viejas se borran ANTES de insertar las nuevas: si un ejercicio
    # sobrevive al reemplazo, insertarlo de nuevo chocaría con
    # uq_rutina_ejercicio mientras la fila anterior sigue viva. SQLAlchemy
    # emite los INSERT antes que los DELETE dentro de un mismo flush, así que
    # hay que forzar el corte.
    rutina.ejercicios = []
    sesion.flush()
    rutina.ejercicios = [
        RoutineExercise(
            catalog_id=c,
            orden=i,
            # Un ejercicio que entra ahora no tiene historial: queda en None,
            # que es lo que hace arrancar las ruedas en los valores iniciales.
            sets_default=defaults_previos.get(c, (None, None, None))[0],
            reps_default=defaults_previos.get(c, (None, None, None))[1],
            weight_default=defaults_previos.get(c, (None, None, None))[2],
        )
        for i, c in enumerate(catalog_ids)
    ]
    sesion.commit()
    sesion.refresh(rutina)
    return rutina


def archivar(
    sesion: Session, user_id: str, rutina_id: int, archivada: bool
) -> Routine | None:
    """Marca o desmarca el archivado de la rutina. Idempotente al marcar."""
    rutina = obtener(sesion, user_id, rutina_id)
    if rutina is None:
        return None

    if archivada:
        if rutina.archived_at is None:
            rutina.archived_at = datetime.now(timezone.utc)
    else:
        rutina.archived_at = None
    sesion.commit()
    sesion.refresh(rutina)
    return rutina
