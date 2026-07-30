import datetime as dt
import uuid

from api.models import Workout, WorkoutExercise, WorkoutSet

YO = "11111111-1111-1111-1111-111111111111"

# Lejos de now() a propósito: con fechas de hoy, una prueba de ventanas pasa
# por casualidad de calendario, con y sin el arreglo. Ya pasó en este proyecto
# con el corte del día del dashboard.
BASE = dt.datetime(2025, 3, 10, 15, 0, tzinfo=dt.timezone.utc)


def _crear_entrenamiento(db_session, user_id, inicio, minutos, catalog_id=None, series=1):
    """Un entrenamiento con una serie por defecto. `catalog_id` puede no existir."""
    entrenamiento = Workout(
        user_id=user_id,
        client_id=str(uuid.uuid4()),
        routine_id=None,
        started_at=inicio,
        ended_at=inicio + dt.timedelta(minutes=minutos),
    )
    entrenamiento.ejercicios = [
        WorkoutExercise(
            catalog_id=catalog_id or "0001",
            orden=0,
            series=[
                WorkoutSet(orden=j, reps=10, weight_kg=40, completed_at=inicio)
                for j in range(series)
            ],
        )
    ]
    db_session.add(entrenamiento)
    db_session.commit()
    return entrenamiento


def test_heatmap_sin_token_devuelve_401(client):
    respuesta = client.get("/api/progress/heatmap")
    assert respuesta.status_code == 401


def test_heatmap_devuelve_un_registro_por_entrenamiento_con_sus_minutos(
    client, auth_headers, db_session
):
    _crear_entrenamiento(db_session, YO, BASE, minutos=48)

    respuesta = client.get(
        "/api/progress/heatmap",
        params={
            "desde": (BASE - dt.timedelta(days=1)).isoformat(),
            "hasta": (BASE + dt.timedelta(days=1)).isoformat(),
        },
        headers=auth_headers,
    )

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert len(cuerpo) == 1
    assert cuerpo[0]["minutos"] == 48


def test_heatmap_no_agrupa_por_dia_devuelve_los_dos_del_mismo_dia(
    client, auth_headers, db_session
):
    """Agrupar por día es tarea del cliente, que es el único que sabe el huso."""
    _crear_entrenamiento(db_session, YO, BASE, minutos=48)
    _crear_entrenamiento(db_session, YO, BASE + dt.timedelta(hours=2), minutos=1)

    cuerpo = client.get(
        "/api/progress/heatmap",
        params={
            "desde": (BASE - dt.timedelta(days=1)).isoformat(),
            "hasta": (BASE + dt.timedelta(days=1)).isoformat(),
        },
        headers=auth_headers,
    ).json()

    assert len(cuerpo) == 2
    assert sorted(d["minutos"] for d in cuerpo) == [1, 48]


def test_heatmap_ignora_entrenamientos_de_otros_usuarios(
    client, auth_headers, db_session
):
    _crear_entrenamiento(db_session, YO, BASE, minutos=48)
    _crear_entrenamiento(db_session, "otro-usuario", BASE, minutos=99)

    cuerpo = client.get(
        "/api/progress/heatmap",
        params={
            "desde": (BASE - dt.timedelta(days=1)).isoformat(),
            "hasta": (BASE + dt.timedelta(days=1)).isoformat(),
        },
        headers=auth_headers,
    ).json()

    assert len(cuerpo) == 1
    assert cuerpo[0]["minutos"] == 48


def test_heatmap_recorta_por_la_ventana(client, auth_headers, db_session):
    _crear_entrenamiento(db_session, YO, BASE, minutos=48)
    _crear_entrenamiento(db_session, YO, BASE - dt.timedelta(days=40), minutos=30)

    cuerpo = client.get(
        "/api/progress/heatmap",
        params={
            "desde": (BASE - dt.timedelta(days=7)).isoformat(),
            "hasta": (BASE + dt.timedelta(days=1)).isoformat(),
        },
        headers=auth_headers,
    ).json()

    assert len(cuerpo) == 1


def test_heatmap_ventana_vacia_devuelve_lista_vacia_y_200(client, auth_headers):
    """La pantalla vacía es el estado normal aquí, no un error."""
    respuesta = client.get(
        "/api/progress/heatmap",
        params={
            "desde": BASE.isoformat(),
            "hasta": (BASE + dt.timedelta(days=1)).isoformat(),
        },
        headers=auth_headers,
    )
    assert respuesta.status_code == 200
    assert respuesta.json() == []


def test_heatmap_rechaza_ventana_al_reves(client, auth_headers):
    respuesta = client.get(
        "/api/progress/heatmap",
        params={
            "desde": (BASE + dt.timedelta(days=1)).isoformat(),
            "hasta": BASE.isoformat(),
        },
        headers=auth_headers,
    )
    assert respuesta.status_code == 422


def test_heatmap_de_menos_de_un_minuto_devuelve_cero(client, auth_headers, db_session):
    """Existe uno real de 54 segundos en producción. Es dato válido, no un error."""
    entrenamiento = Workout(
        user_id=YO,
        client_id="corto",
        routine_id=None,
        started_at=BASE,
        ended_at=BASE + dt.timedelta(seconds=54),
    )
    entrenamiento.ejercicios = [
        WorkoutExercise(
            catalog_id="0001",
            orden=0,
            series=[WorkoutSet(orden=0, reps=10, weight_kg=40, completed_at=BASE)],
        )
    ]
    db_session.add(entrenamiento)
    db_session.commit()

    cuerpo = client.get(
        "/api/progress/heatmap",
        params={
            "desde": (BASE - dt.timedelta(days=1)).isoformat(),
            "hasta": (BASE + dt.timedelta(days=1)).isoformat(),
        },
        headers=auth_headers,
    ).json()

    assert cuerpo[0]["minutos"] == 0
