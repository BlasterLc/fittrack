"""Migra Profile.peso_kg (columna vieja) a la tabla weight_entries.

Uso:
    python -m api.scripts.migrar_historial_peso

Se corre a mano, UNA vez, contra producción — DESPUÉS de que `weight_entries`
ya existe en la base (vía `Base.metadata.create_all`) y ANTES de borrar la
columna vieja con `ALTER TABLE profiles DROP COLUMN peso_kg`. El modelo
`Profile` de este código ya no tiene `peso_kg` como atributo, así que la
lectura es SQL crudo, no ORM.

Idempotente por (user_id, recorded_at), no por usuario: si alguien ya cargó
un peso nuevo entre el deploy y el backfill, ese registro nuevo no bloquea la
migración del valor viejo, que tiene su propio `recorded_at` (el `updated_at`
de `profiles`). Correrlo dos veces no duplica datos.
"""

from sqlalchemy import text
from sqlalchemy.orm import Session

from api.database import get_engine
from api.models import WeightEntry


def migrar(sesion: Session) -> int:
    """Devuelve cuántos perfiles se migraron."""
    filas = sesion.execute(
        text("SELECT user_id, peso_kg, updated_at FROM profiles WHERE peso_kg IS NOT NULL")
    ).all()

    migrados = 0
    for user_id, peso_kg, updated_at in filas:
        ya_tiene = sesion.execute(
            text(
                "SELECT 1 FROM weight_entries "
                "WHERE user_id = :user_id AND recorded_at = :recorded_at LIMIT 1"
            ),
            {"user_id": user_id, "recorded_at": updated_at},
        ).first()
        if ya_tiene is not None:
            continue
        sesion.add(WeightEntry(user_id=user_id, kg=peso_kg, recorded_at=updated_at))
        migrados += 1

    sesion.commit()
    return migrados


def main() -> int:
    with Session(get_engine()) as sesion:
        migrados = migrar(sesion)
        print(f"{migrados} perfil(es) migrado(s) a weight_entries")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
