"""Consultas de la pestaña Progreso.

Ninguna agrupa por día de calendario en el servidor. `func.date()` sobre un
timestamptz se evalúa en el timezone de la sesión de Postgres, así que el
mismo entrenamiento cae en un día distinto según dónde corra la consulta:
producción está en UTC y el Postgres local en America/Santiago. La agrupación
por día, semana y mes vive entera en el cliente, que es el único que conoce el
huso del usuario.
"""

from datetime import datetime

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session, selectinload

from api.config import Config
from api.models import (
    CatalogExercise,
    Meal,
    MealItem,
    WeightEntry,
    Workout,
    WorkoutExercise,
    WorkoutSet,
)
from api.services import perfil as servicio_perfil


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

    Cuenta `body_part_es`, salvo dentro de "Brazos": ahí se separa por
    `target_es` ("Bíceps"/"Tríceps", los únicos dos valores que trae ese
    grupo en el catálogo), porque juntarlos tapa qué músculo del brazo se
    entrenó de verdad. El resto de los grupos sigue con `body_part_es`: sus
    `target_es` usan otro vocabulario que no vale la pena traducir todavía.

    El recorte va por el `started_at` del ENTRENAMIENTO, no por el
    `completed_at` de cada serie: una sesión pertenece a la semana en que
    empezó, igual que en el mapa.

    `outerjoin` contra el catálogo a propósito: no hay FK y la ingesta borra lo
    que ya no está en el dataset.
    """
    _validar(desde, hasta)

    clave_grupo = case(
        (CatalogExercise.body_part_es == "Brazos", CatalogExercise.target_es),
        else_=CatalogExercise.body_part_es,
    )

    filas = sesion.execute(
        select(clave_grupo, func.count(WorkoutSet.id))
        .select_from(WorkoutSet)
        .join(WorkoutExercise, WorkoutSet.workout_exercise_id == WorkoutExercise.id)
        .join(Workout, WorkoutExercise.workout_id == Workout.id)
        .outerjoin(CatalogExercise, CatalogExercise.id == WorkoutExercise.catalog_id)
        .where(
            Workout.user_id == user_id,
            Workout.started_at >= desde,
            Workout.started_at < hasta,
        )
        .group_by(clave_grupo)
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


def _entrenamiento_exportable(
    sesion: Session, user_id: str, desde: datetime, hasta: datetime
) -> dict:
    """Duración promedio, series por grupo y el detalle de cada sesión.

    `series_por_grupo` ya resuelve la separación Bíceps/Tríceps; se reutiliza
    en vez de reimplementar la misma consulta. La lista de sesiones sí
    necesita su propia consulta: `mapa()` no trae ni las series ni los grupos
    musculares de cada entrenamiento.
    """
    grupos_ventana = series_por_grupo(sesion, user_id, desde, hasta)

    entrenamientos = list(
        sesion.execute(
            select(Workout)
            .where(
                Workout.user_id == user_id,
                Workout.started_at >= desde,
                Workout.started_at < hasta,
            )
            .order_by(Workout.started_at)
            .options(selectinload(Workout.ejercicios).selectinload(WorkoutExercise.series))
        ).scalars()
    )

    ids_catalogo = {e.catalog_id for w in entrenamientos for e in w.ejercicios}
    grupo_por_catalogo = (
        dict(
            sesion.execute(
                select(CatalogExercise.id, CatalogExercise.body_part_es).where(
                    CatalogExercise.id.in_(ids_catalogo)
                )
            ).all()
        )
        if ids_catalogo
        else {}
    )

    sesiones = [
        {
            "started_at": w.started_at,
            "duracion_min": int((w.ended_at - w.started_at).total_seconds() // 60),
            "series_totales": sum(len(e.series) for e in w.ejercicios),
            "grupos": sorted(
                {grupo_por_catalogo.get(e.catalog_id, SIN_CLASIFICAR) for e in w.ejercicios}
            ),
        }
        for w in entrenamientos
    ]

    duracion_promedio = (
        sum(s["duracion_min"] for s in sesiones) / len(sesiones) if sesiones else None
    )

    return {
        "duracion_promedio_min": duracion_promedio,
        "series_por_grupo": grupos_ventana,
        "sesiones": sesiones,
    }


def _comida_exportable(
    sesion: Session, user_id: str, desde: datetime, hasta: datetime, dias_ventana: float
) -> dict:
    """Comidas de la ventana (una fila por comida, sumados sus ítems) y el
    promedio diario.

    El promedio se divide por `dias_ventana` (el largo de la ventana pedida),
    NO por la cantidad de comidas: son cosas distintas. Alguien que cargó una
    sola comida muy completa en dos días no comió "el promedio de esa
    comida", comió la mitad en promedio por día.
    """
    filas = sesion.execute(
        select(
            Meal.logged_at,
            func.sum(MealItem.calorias),
            func.sum(MealItem.prot_g),
            func.sum(MealItem.carbs_g),
            func.sum(MealItem.fat_g),
        )
        .select_from(MealItem)
        .join(Meal, MealItem.meal_id == Meal.id)
        .where(Meal.user_id == user_id, Meal.logged_at >= desde, Meal.logged_at < hasta)
        .group_by(Meal.id, Meal.logged_at)
        .order_by(Meal.logged_at)
    ).all()

    comidas = [
        {
            "logged_at": logged_at,
            "calorias": int(calorias),
            "prot_g": float(prot_g),
            "carbs_g": float(carbs_g),
            "fat_g": float(fat_g),
        }
        for logged_at, calorias, prot_g, carbs_g, fat_g in filas
    ]

    if comidas:
        promedio_calorias = sum(c["calorias"] for c in comidas) / dias_ventana
        promedio_prot_g = sum(c["prot_g"] for c in comidas) / dias_ventana
        promedio_carbs_g = sum(c["carbs_g"] for c in comidas) / dias_ventana
        promedio_fat_g = sum(c["fat_g"] for c in comidas) / dias_ventana
    else:
        promedio_calorias = promedio_prot_g = promedio_carbs_g = promedio_fat_g = None

    resuelto = servicio_perfil.resolver(sesion, user_id)
    meta_calorias = resuelto.metas.calorias if resuelto.metas else Config().calorie_goal
    metas_macros = (
        {
            "prot": resuelto.metas.prot_g,
            "carb": resuelto.metas.carb_g,
            "fat": resuelto.metas.fat_g,
        }
        if resuelto.metas
        else None
    )

    return {
        "meta_calorias": meta_calorias,
        "metas_macros": metas_macros,
        "promedio_calorias": promedio_calorias,
        "promedio_prot_g": promedio_prot_g,
        "promedio_carbs_g": promedio_carbs_g,
        "promedio_fat_g": promedio_fat_g,
        "comidas": comidas,
    }


def _peso_exportable(sesion: Session, user_id: str, desde: datetime, hasta: datetime) -> dict:
    """Kg inicial/final/tendencia de la ventana y cada registro, del más
    viejo al más nuevo (al revés de `/api/weight`, que pagina del más nuevo
    hacia atrás: acá se lee como una línea de tiempo, no como una lista para
    seguir cargando)."""
    registros = list(
        sesion.execute(
            select(WeightEntry)
            .where(
                WeightEntry.user_id == user_id,
                WeightEntry.recorded_at >= desde,
                WeightEntry.recorded_at < hasta,
            )
            .order_by(WeightEntry.recorded_at)
        ).scalars()
    )

    return {
        "inicial_kg": registros[0].kg if registros else None,
        "final_kg": registros[-1].kg if registros else None,
        "tendencia_kg": (registros[-1].kg - registros[0].kg) if registros else None,
        "registros": registros,
    }


def resumen_exportable(sesion: Session, user_id: str, desde: datetime, hasta: datetime) -> dict:
    """El resumen completo de entrenamiento, comida y peso de la ventana."""
    _validar(desde, hasta)
    dias_ventana = max((hasta - desde).total_seconds() / 86400, 1.0)

    return {
        "desde": desde,
        "hasta": hasta,
        "entrenamiento": _entrenamiento_exportable(sesion, user_id, desde, hasta),
        "comida": _comida_exportable(sesion, user_id, desde, hasta, dias_ventana),
        "peso": _peso_exportable(sesion, user_id, desde, hasta),
    }
