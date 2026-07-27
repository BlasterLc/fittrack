"""Lógica de rutinas. Los routers no deciden nada, solo traducen HTTP."""

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from api.models import CatalogExercise, Routine, RoutineExercise


class RutinaInvalida(ValueError):
    """El nombre o la lista de ejercicios no cumplen las reglas."""


class EjercicioDesconocido(ValueError):
    """Se pidió un catalog_id que no está en el catálogo."""


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


def _validar(sesion: Session, nombre: str, catalog_ids: list[str]) -> str:
    """Devuelve el nombre limpio o levanta. Compartido por crear y reemplazar."""
    limpio = nombre.strip()
    if not limpio:
        raise RutinaInvalida("La rutina necesita un nombre")
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
    limpio = _validar(sesion, nombre, catalog_ids)

    rutina = Routine(user_id=user_id, nombre=limpio)
    rutina.ejercicios = [
        RoutineExercise(catalog_id=c, orden=i) for i, c in enumerate(catalog_ids)
    ]
    sesion.add(rutina)
    sesion.commit()
    sesion.refresh(rutina)
    return rutina


def obtener(sesion: Session, user_id: str, rutina_id: int) -> Routine | None:
    """La rutina del usuario, o None. Nunca devuelve la de otro."""
    return sesion.execute(
        select(Routine).where(Routine.id == rutina_id, Routine.user_id == user_id)
    ).scalar_one_or_none()


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
    # Se respeta el orden de la rutina, no el que devuelva la base.
    encontrados = [fichas[c] for c in ids if c in fichas]

    return {
        "id": rutina.id,
        "nombre": rutina.nombre,
        "archived_at": rutina.archived_at,
        "ejercicios": encontrados,
        "ejercicios_faltantes": len(ids) - len(encontrados),
    }
