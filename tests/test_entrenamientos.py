import datetime as dt

import pytest
from sqlalchemy.exc import IntegrityError

from api.models import CatalogExercise, Routine, RoutineExercise, Workout, WorkoutExercise, WorkoutSet

USUARIO = "11111111-1111-1111-1111-111111111111"
OTRO = "22222222-2222-2222-2222-222222222222"


def sembrar_catalogo(sesion, ids=("0025", "0031")):
    for i, cid in enumerate(ids):
        sesion.add(
            CatalogExercise(
                id=cid, nombre_en=f"Ex {i}", nombre_es=f"Ejercicio {i}",
                nombre_norm=f"ejercicio {i}", body_part="chest", body_part_es="Pecho",
                equipment="barbell", equipment_es="Barra", target="pectorals",
                target_es="Pectorales", gif_path=f"{cid}.gif", atribucion="Gym visual",
            )
        )
    sesion.commit()


def test_un_entrenamiento_guarda_sus_ejercicios_y_series(db_session):
    sembrar_catalogo(db_session)
    entrenamiento = Workout(
        user_id=USUARIO,
        client_id="cliente-1",
        started_at=dt.datetime(2026, 7, 28, 22, 40, tzinfo=dt.timezone.utc),
        ended_at=dt.datetime(2026, 7, 28, 23, 32, tzinfo=dt.timezone.utc),
    )
    entrenamiento.ejercicios = [
        WorkoutExercise(
            catalog_id="0025",
            orden=0,
            series=[
                WorkoutSet(
                    orden=0, reps=8, weight_kg=80.0,
                    completed_at=dt.datetime(2026, 7, 28, 22, 44, tzinfo=dt.timezone.utc),
                )
            ],
        )
    ]
    db_session.add(entrenamiento)
    db_session.commit()

    guardado = db_session.get(Workout, entrenamiento.id)
    assert len(guardado.ejercicios) == 1
    assert guardado.ejercicios[0].series[0].reps == 8


def test_el_client_id_no_se_repite_para_el_mismo_usuario(db_session):
    for _ in range(2):
        db_session.add(
            Workout(
                user_id=USUARIO, client_id="cliente-1",
                started_at=dt.datetime(2026, 7, 28, 22, 40, tzinfo=dt.timezone.utc),
                ended_at=dt.datetime(2026, 7, 28, 23, 32, tzinfo=dt.timezone.utc),
            )
        )
    with pytest.raises(IntegrityError):
        db_session.commit()
