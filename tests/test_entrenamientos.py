import datetime as dt

import pytest
from sqlalchemy.exc import IntegrityError

from api.models import CatalogExercise, Routine, RoutineExercise, Workout, WorkoutExercise, WorkoutSet
from api.services import entrenamientos as servicio

USUARIO = "11111111-1111-1111-1111-111111111111"
OTRO = "22222222-2222-2222-2222-222222222222"

INICIO = dt.datetime(2026, 7, 28, 22, 40, tzinfo=dt.timezone.utc)
FIN = dt.datetime(2026, 7, 28, 23, 32, tzinfo=dt.timezone.utc)


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


def cuerpo(**cambios):
    base = {
        "client_id": "cliente-1",
        "routine_id": None,
        "started_at": INICIO,
        "ended_at": FIN,
        "ejercicios": [
            {
                "catalog_id": "0025",
                "orden": 0,
                "series": [
                    {"orden": 0, "reps": 8, "weight_kg": 80.0, "completed_at": INICIO},
                    {"orden": 1, "reps": 5, "weight_kg": 75.0, "completed_at": FIN},
                ],
            }
        ],
        "agregar_a_rutina": [],
    }
    base.update(cambios)
    return base


def test_guardar_devuelve_el_resumen(db_session):
    sembrar_catalogo(db_session)

    resumen = servicio.guardar(db_session, USUARIO, cuerpo())

    assert resumen["duracion_min"] == 52
    assert resumen["total_series"] == 2
    assert resumen["total_ejercicios"] == 1
    assert resumen["omitidos"] == []


def test_las_series_se_guardan_con_sus_valores_y_en_orden(db_session):
    """Lo que el usuario levantó tiene que volver tal cual, sin reordenarse."""
    sembrar_catalogo(db_session)

    resumen = servicio.guardar(db_session, USUARIO, cuerpo())

    ejercicio = resumen["ejercicios"][0]
    assert ejercicio["catalog_id"] == "0025"
    assert ejercicio["nombre_es"] == "Ejercicio 0"
    assert ejercicio["series"] == [
        {"orden": 0, "reps": 8, "weight_kg": 80.0},
        {"orden": 1, "reps": 5, "weight_kg": 75.0},
    ]


def test_el_mismo_client_id_no_crea_dos_entrenamientos(db_session):
    sembrar_catalogo(db_session)

    primero = servicio.guardar(db_session, USUARIO, cuerpo())
    segundo = servicio.guardar(db_session, USUARIO, cuerpo())

    assert primero["id"] == segundo["id"]
    assert db_session.query(Workout).count() == 1


def test_dos_envios_a_la_vez_devuelven_el_mismo_entrenamiento(db_session, monkeypatch):
    """La carrera que la lectura previa no alcanza a ver.

    Dos peticiones simultáneas leen las dos que no hay nada y las dos intentan
    insertar: la restricción de unicidad frena a la segunda. Se simula dejando
    ciega la primera lectura, porque con una sola sesión secuencial nunca se
    llegaría al INSERT que choca.
    """
    sembrar_catalogo(db_session)
    primero = servicio.guardar(db_session, USUARIO, cuerpo())

    real = servicio._buscar_por_cliente
    lecturas = []

    def ciega_la_primera(sesion, user_id, client_id):
        lecturas.append(client_id)
        if len(lecturas) == 1:
            return None
        return real(sesion, user_id, client_id)

    monkeypatch.setattr(servicio, "_buscar_por_cliente", ciega_la_primera)

    segundo = servicio.guardar(db_session, USUARIO, cuerpo())

    assert segundo["id"] == primero["id"]
    assert db_session.query(Workout).count() == 1


def test_un_ejercicio_que_ya_no_esta_en_el_catalogo_se_omite(db_session):
    sembrar_catalogo(db_session, ids=("0025",))
    con_fantasma = cuerpo()
    con_fantasma["ejercicios"].append(
        {
            "catalog_id": "9999",
            "orden": 1,
            "series": [{"orden": 0, "reps": 10, "weight_kg": 20.0, "completed_at": FIN}],
        }
    )

    resumen = servicio.guardar(db_session, USUARIO, con_fantasma)

    assert resumen["omitidos"] == ["9999"]
    assert resumen["total_ejercicios"] == 1
    assert resumen["total_series"] == 2


def test_un_reintento_devuelve_lo_guardado_aunque_el_catalogo_haya_cambiado(db_session):
    """El entrenamiento ya guardado se devuelve sin volver a validarlo.

    Si la ingesta borró la ficha entre el primer envío y el reintento, revalidar
    haría fallar un entrenamiento que ya está en la base.
    """
    sembrar_catalogo(db_session, ids=("0025",))
    primero = servicio.guardar(db_session, USUARIO, cuerpo())
    db_session.query(CatalogExercise).delete()
    db_session.commit()

    segundo = servicio.guardar(db_session, USUARIO, cuerpo())

    assert segundo["id"] == primero["id"]
    assert segundo["total_series"] == 2


def test_los_ejercicios_validos_se_guardan_todos_y_el_orden_se_compacta(db_session):
    """El hueco que deja un ejercicio omitido no se conserva en el orden."""
    sembrar_catalogo(db_session)
    con_hueco = cuerpo()
    con_hueco["ejercicios"].append(
        {
            "catalog_id": "9999",
            "orden": 1,
            "series": [{"orden": 0, "reps": 10, "weight_kg": 20.0, "completed_at": FIN}],
        }
    )
    con_hueco["ejercicios"].append(
        {
            "catalog_id": "0031",
            "orden": 2,
            "series": [{"orden": 0, "reps": 12, "weight_kg": 25.0, "completed_at": FIN}],
        }
    )

    resumen = servicio.guardar(db_session, USUARIO, con_hueco)

    assert [e["catalog_id"] for e in resumen["ejercicios"]] == ["0025", "0031"]
    assert resumen["total_ejercicios"] == 2
    assert resumen["total_series"] == 3
    filas = db_session.query(WorkoutExercise).order_by(WorkoutExercise.id).all()
    assert [(f.catalog_id, f.orden) for f in filas] == [("0025", 0), ("0031", 1)]


def test_si_ningun_ejercicio_existe_se_rechaza(db_session):
    sembrar_catalogo(db_session, ids=("0031",))

    with pytest.raises(servicio.EntrenamientoInvalido):
        servicio.guardar(db_session, USUARIO, cuerpo())


def test_el_fin_no_puede_ser_anterior_al_inicio(db_session):
    sembrar_catalogo(db_session)

    with pytest.raises(servicio.EntrenamientoInvalido):
        servicio.guardar(db_session, USUARIO, cuerpo(ended_at=INICIO - dt.timedelta(minutes=1)))


def test_un_entrenamiento_de_otro_usuario_no_se_ve(db_session):
    sembrar_catalogo(db_session)
    servicio.guardar(db_session, USUARIO, cuerpo())

    # Mismo client_id, otro usuario: es un entrenamiento distinto, no el mismo.
    del_otro = servicio.guardar(db_session, OTRO, cuerpo())

    assert db_session.query(Workout).count() == 2
    assert del_otro["id"] != servicio.guardar(db_session, USUARIO, cuerpo())["id"]
