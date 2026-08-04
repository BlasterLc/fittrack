from sqlalchemy import text

from api.models import WeightEntry
from api.scripts.migrar_historial_peso import migrar


def _agregar_columna_vieja(db_session):
    """Simula el esquema de producción antes del DROP COLUMN: el modelo
    Profile de este código ya no declara peso_kg, así que hay que agregarla
    a mano con SQL crudo para poder probar el script contra ella."""
    db_session.execute(text("ALTER TABLE profiles ADD COLUMN peso_kg FLOAT"))
    db_session.commit()


def _crear_perfil_con_peso_viejo(db_session, user_id, kg):
    db_session.execute(
        text(
            "INSERT INTO profiles (user_id, peso_kg, updated_at) "
            "VALUES (:user_id, :kg, now())"
        ),
        {"user_id": user_id, "kg": kg},
    )
    db_session.commit()


def test_migrar_copia_el_peso_del_perfil_al_historial(db_session):
    _agregar_columna_vieja(db_session)
    _crear_perfil_con_peso_viejo(db_session, "u1", 78.0)

    migrados = migrar(db_session)

    assert migrados == 1
    registro = db_session.query(WeightEntry).filter_by(user_id="u1").one()
    assert registro.kg == 78.0


def test_migrar_ignora_perfiles_sin_peso(db_session):
    _agregar_columna_vieja(db_session)
    db_session.execute(
        text("INSERT INTO profiles (user_id, updated_at) VALUES ('u1', now())")
    )
    db_session.commit()

    migrados = migrar(db_session)

    assert migrados == 0
    assert db_session.query(WeightEntry).count() == 0


def test_migrar_es_idempotente(db_session):
    """Correrlo dos veces no duplica: si el usuario ya tiene algún registro
    en weight_entries, se salta."""
    _agregar_columna_vieja(db_session)
    _crear_perfil_con_peso_viejo(db_session, "u1", 78.0)

    migrar(db_session)
    segunda_pasada = migrar(db_session)

    assert segunda_pasada == 0
    assert db_session.query(WeightEntry).filter_by(user_id="u1").count() == 1
