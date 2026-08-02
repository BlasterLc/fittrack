"""Registro y consulta del historial de peso corporal."""

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from api.models import WeightEntry

PESO_KG = (30.0, 300.0)


class PesoInvalido(ValueError):
    """El peso está fuera del rango aceptado."""


def _validar(kg: float) -> None:
    if not PESO_KG[0] <= kg <= PESO_KG[1]:
        raise PesoInvalido(f"El peso debe estar entre {PESO_KG[0]:.0f} y {PESO_KG[1]:.0f} kg")


def crear(sesion: Session, user_id: str, kg: float) -> WeightEntry:
    _validar(kg)
    registro = WeightEntry(user_id=user_id, kg=kg)
    sesion.add(registro)
    sesion.commit()
    sesion.refresh(registro)
    return registro


def listar(
    sesion: Session, user_id: str, limite: int, hasta: datetime | None
) -> list[WeightEntry]:
    """Del más reciente al más viejo. `hasta` es el cursor: solo trae
    registros ANTERIORES a esa fecha, igual que `progresion_ejercicio`."""
    condiciones = [WeightEntry.user_id == user_id]
    if hasta is not None:
        condiciones.append(WeightEntry.recorded_at < hasta)

    return list(
        sesion.execute(
            select(WeightEntry)
            .where(*condiciones)
            .order_by(WeightEntry.recorded_at.desc())
            .limit(limite)
        ).scalars()
    )


def mas_reciente(sesion: Session, user_id: str) -> WeightEntry | None:
    """El último registro del usuario, o None si nunca cargó uno."""
    return sesion.execute(
        select(WeightEntry)
        .where(WeightEntry.user_id == user_id)
        .order_by(WeightEntry.recorded_at.desc())
        .limit(1)
    ).scalar_one_or_none()


def borrar(sesion: Session, user_id: str, entry_id: int) -> bool:
    """True si borró. False si el registro no existe o es de otro usuario."""
    registro = sesion.get(WeightEntry, entry_id)
    if registro is None or registro.user_id != user_id:
        return False
    sesion.delete(registro)
    sesion.commit()
    return True
