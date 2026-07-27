"""Lógica de rutinas. Los routers no deciden nada, solo traducen HTTP."""

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from api.models import CatalogExercise, Routine, RoutineExercise


def _ejercicios_por_rutina(
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

    grupos = _ejercicios_por_rutina(sesion, [r.id for r in rutinas])
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
