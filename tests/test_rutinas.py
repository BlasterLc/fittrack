import pytest
from sqlalchemy.exc import IntegrityError

from api.models import Routine, RoutineExercise

USUARIO = "11111111-1111-1111-1111-111111111111"


def test_una_rutina_guarda_sus_ejercicios_en_orden(db_session):
    rutina = Routine(user_id=USUARIO, nombre="Empuje A")
    rutina.ejercicios = [
        RoutineExercise(catalog_id="0025", orden=0),
        RoutineExercise(catalog_id="0033", orden=1),
    ]
    db_session.add(rutina)
    db_session.commit()

    guardada = db_session.get(Routine, rutina.id)
    assert guardada.nombre == "Empuje A"
    assert guardada.archived_at is None
    assert [e.catalog_id for e in guardada.ejercicios] == ["0025", "0033"]


def test_el_mismo_ejercicio_no_entra_dos_veces(db_session):
    """UNIQUE (routine_id, catalog_id): es lo que habilita los checks del catálogo."""
    rutina = Routine(user_id=USUARIO, nombre="Empuje A")
    rutina.ejercicios = [
        RoutineExercise(catalog_id="0025", orden=0),
        RoutineExercise(catalog_id="0025", orden=1),
    ]
    db_session.add(rutina)

    with pytest.raises(IntegrityError):
        db_session.commit()


def test_borrar_la_rutina_borra_sus_ejercicios(db_session):
    rutina = Routine(user_id=USUARIO, nombre="Temporal")
    rutina.ejercicios = [RoutineExercise(catalog_id="0025", orden=0)]
    db_session.add(rutina)
    db_session.commit()

    db_session.delete(rutina)
    db_session.commit()

    assert db_session.query(RoutineExercise).count() == 0
