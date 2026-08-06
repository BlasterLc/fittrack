import datetime as dt
import uuid

from api.models import CatalogExercise, Workout, WorkoutExercise, WorkoutSet

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


def test_heatmap_excluye_el_entrenamiento_que_empieza_justo_en_hasta(
    client, auth_headers, db_session
):
    """`hasta` es el borde abierto: lo que empieza justo ahí es de la ventana siguiente."""
    _crear_entrenamiento(db_session, YO, BASE, minutos=48)

    cuerpo = client.get(
        "/api/progress/heatmap",
        params={
            "desde": (BASE - dt.timedelta(days=1)).isoformat(),
            "hasta": BASE.isoformat(),
        },
        headers=auth_headers,
    ).json()

    assert cuerpo == []


def test_heatmap_incluye_el_entrenamiento_que_empieza_justo_en_desde(
    client, auth_headers, db_session
):
    """`desde` es el borde cerrado: lo que empieza justo ahí sí es de la ventana."""
    _crear_entrenamiento(db_session, YO, BASE, minutos=48)

    cuerpo = client.get(
        "/api/progress/heatmap",
        params={
            "desde": BASE.isoformat(),
            "hasta": (BASE + dt.timedelta(days=1)).isoformat(),
        },
        headers=auth_headers,
    ).json()

    assert len(cuerpo) == 1
    assert cuerpo[0]["minutos"] == 48


def test_heatmap_ventana_de_un_instante_no_es_invalida(client, auth_headers):
    """`desde == hasta` es una ventana válida, aunque en la práctica quede vacía
    salvo que algo empiece exactamente en ese instante. No es lo mismo que
    `desde > hasta`, que sí es un error del cliente."""
    respuesta = client.get(
        "/api/progress/heatmap",
        params={
            "desde": BASE.isoformat(),
            "hasta": BASE.isoformat(),
        },
        headers=auth_headers,
    )
    assert respuesta.status_code == 200


def _crear_ficha(db_session, catalog_id, grupo, target_es="Pectorales"):
    db_session.add(
        CatalogExercise(
            id=catalog_id,
            nombre_en="X",
            nombre_es="Equis",
            nombre_norm="equis",
            body_part="chest",
            body_part_es=grupo,
            equipment="barbell",
            equipment_es="Barra",
            target="pectorals",
            target_es=target_es,
            secondary_muscles=[],
            secondary_muscles_es=[],
            instrucciones_es=[],
            gif_path="http://ejemplo/x.gif",
            atribucion="dataset",
        )
    )
    db_session.commit()


def _ventana_ancha():
    return {
        "desde": (BASE - dt.timedelta(days=7)).isoformat(),
        "hasta": (BASE + dt.timedelta(days=1)).isoformat(),
    }


def test_series_por_grupo_sin_token_devuelve_401(client):
    respuesta = client.get("/api/progress/sets-by-muscle")
    assert respuesta.status_code == 401


def test_series_por_grupo_cuenta_solo_el_musculo_primario(
    client, auth_headers, db_session
):
    _crear_ficha(db_session, "0001", "Espalda")
    _crear_entrenamiento(db_session, YO, BASE, minutos=48, catalog_id="0001", series=3)

    cuerpo = client.get(
        "/api/progress/sets-by-muscle", params=_ventana_ancha(), headers=auth_headers
    ).json()

    assert cuerpo == [{"grupo": "Espalda", "series": 3}]


def test_series_por_grupo_suma_entre_entrenamientos_de_la_ventana(
    client, auth_headers, db_session
):
    _crear_ficha(db_session, "0001", "Espalda")
    _crear_entrenamiento(db_session, YO, BASE, minutos=48, catalog_id="0001", series=3)
    _crear_entrenamiento(
        db_session, YO, BASE - dt.timedelta(days=2), minutos=30, catalog_id="0001", series=2
    )

    cuerpo = client.get(
        "/api/progress/sets-by-muscle", params=_ventana_ancha(), headers=auth_headers
    ).json()

    assert cuerpo == [{"grupo": "Espalda", "series": 5}]


def test_series_de_un_ejercicio_borrado_del_catalogo_no_se_evaporan(
    client, auth_headers, db_session
):
    """El catálogo es convergente: `ingestar()` borra lo que ya no está en el
    dataset, y no hay FK que lo impida. Con un JOIN normal estas series
    desaparecerían en silencio y las barras quedarían cortas sin avisar.
    """
    _crear_ficha(db_session, "0001", "Espalda")
    _crear_entrenamiento(db_session, YO, BASE, minutos=48, catalog_id="0001", series=3)
    _crear_entrenamiento(
        db_session,
        YO,
        BASE + dt.timedelta(hours=1),
        minutos=20,
        catalog_id="9999",  # nunca estuvo en el catálogo
        series=2,
    )

    cuerpo = client.get(
        "/api/progress/sets-by-muscle", params=_ventana_ancha(), headers=auth_headers
    ).json()

    por_grupo = {f["grupo"]: f["series"] for f in cuerpo}
    assert por_grupo == {"Espalda": 3, "Sin clasificar": 2}


def test_series_por_grupo_ignora_a_otros_usuarios(client, auth_headers, db_session):
    _crear_ficha(db_session, "0001", "Espalda")
    _crear_entrenamiento(db_session, YO, BASE, minutos=48, catalog_id="0001", series=3)
    _crear_entrenamiento(
        db_session, "otro-usuario", BASE, minutos=48, catalog_id="0001", series=9
    )

    cuerpo = client.get(
        "/api/progress/sets-by-muscle", params=_ventana_ancha(), headers=auth_headers
    ).json()

    assert cuerpo == [{"grupo": "Espalda", "series": 3}]


def test_series_por_grupo_separa_biceps_de_triceps(client, auth_headers, db_session):
    _crear_ficha(db_session, "0001", "Brazos", target_es="Bíceps")
    _crear_ficha(db_session, "0002", "Brazos", target_es="Tríceps")
    _crear_entrenamiento(db_session, YO, BASE, minutos=30, catalog_id="0001", series=3)
    _crear_entrenamiento(db_session, YO, BASE, minutos=20, catalog_id="0002", series=2)

    cuerpo = client.get(
        "/api/progress/sets-by-muscle", params=_ventana_ancha(), headers=auth_headers
    ).json()

    por_grupo = {f["grupo"]: f["series"] for f in cuerpo}
    assert por_grupo == {"Bíceps": 3, "Tríceps": 2}


def test_series_de_una_sesion_que_cruza_la_medianoche_cuentan_donde_empezo(
    client, auth_headers, db_session
):
    """Una sesión pertenece a la semana en que empezó, no a la de cada serie.

    Si el mapa usara `started_at` y las barras el `completed_at` de cada serie,
    las dos mitades de la misma pantalla se contradirían sobre el mismo
    entrenamiento.
    """
    _crear_ficha(db_session, "0001", "Espalda")
    domingo_tarde = dt.datetime(2025, 3, 9, 23, 30, tzinfo=dt.timezone.utc)
    _crear_entrenamiento(
        db_session, YO, domingo_tarde, minutos=60, catalog_id="0001", series=4
    )

    # Ventana que termina ANTES de la medianoche: la sesión empezó adentro.
    cuerpo = client.get(
        "/api/progress/sets-by-muscle",
        params={
            "desde": (domingo_tarde - dt.timedelta(hours=1)).isoformat(),
            "hasta": dt.datetime(2025, 3, 10, 0, 0, tzinfo=dt.timezone.utc).isoformat(),
        },
        headers=auth_headers,
    ).json()

    assert cuerpo == [{"grupo": "Espalda", "series": 4}]


def test_series_por_grupo_ignora_cuando_se_completo_cada_serie(
    client, auth_headers, db_session
):
    """Distingue `started_at` del entrenamiento de `completed_at` de la serie.

    La prueba de la sesión que cruza la medianoche no alcanza para esto: ahí
    el fixture pone `completed_at` igual al `started_at`, así que filtrar por
    uno u otro da el mismo resultado. Aquí la serie se completa después de que
    termina la ventana, mientras el entrenamiento empezó adentro.
    """
    _crear_ficha(db_session, "0001", "Espalda")
    domingo_tarde = dt.datetime(2025, 3, 9, 23, 30, tzinfo=dt.timezone.utc)
    medianoche = dt.datetime(2025, 3, 10, 0, 0, tzinfo=dt.timezone.utc)

    entrenamiento = Workout(
        user_id=YO,
        client_id=str(uuid.uuid4()),
        routine_id=None,
        started_at=domingo_tarde,
        ended_at=domingo_tarde + dt.timedelta(hours=1),
    )
    entrenamiento.ejercicios = [
        WorkoutExercise(
            catalog_id="0001",
            orden=0,
            series=[
                # Se completa después del corte de la ventana, aunque el
                # entrenamiento empezó adentro.
                WorkoutSet(
                    orden=0,
                    reps=10,
                    weight_kg=40,
                    completed_at=medianoche + dt.timedelta(minutes=30),
                )
            ],
        )
    ]
    db_session.add(entrenamiento)
    db_session.commit()

    # Ventana que termina ANTES de la medianoche: el entrenamiento empezó
    # adentro, pero la serie se completó después de `hasta`.
    cuerpo = client.get(
        "/api/progress/sets-by-muscle",
        params={
            "desde": (domingo_tarde - dt.timedelta(hours=1)).isoformat(),
            "hasta": medianoche.isoformat(),
        },
        headers=auth_headers,
    ).json()

    assert cuerpo == [{"grupo": "Espalda", "series": 1}]


def test_series_por_grupo_ventana_vacia_devuelve_lista_vacia(client, auth_headers):
    respuesta = client.get(
        "/api/progress/sets-by-muscle", params=_ventana_ancha(), headers=auth_headers
    )
    assert respuesta.status_code == 200
    assert respuesta.json() == []


def test_series_por_grupo_rechaza_ventana_al_reves(client, auth_headers):
    respuesta = client.get(
        "/api/progress/sets-by-muscle",
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


def test_exercise_progresion_sin_token_devuelve_401(client):
    respuesta = client.get("/api/progress/exercise/0001")
    assert respuesta.status_code == 401


def test_exercise_progresion_devuelve_el_maximo_de_la_sesion_no_la_suma(
    client, auth_headers, db_session
):
    """Dos series en la misma sesión: se queda con la más pesada."""
    entrenamiento = Workout(
        user_id=YO,
        client_id=str(uuid.uuid4()),
        routine_id=None,
        started_at=BASE,
        ended_at=BASE + dt.timedelta(minutes=40),
    )
    entrenamiento.ejercicios = [
        WorkoutExercise(
            catalog_id="0001",
            orden=0,
            series=[
                WorkoutSet(orden=0, reps=10, weight_kg=40, completed_at=BASE),
                WorkoutSet(orden=1, reps=8, weight_kg=45, completed_at=BASE),
            ],
        )
    ]
    db_session.add(entrenamiento)
    db_session.commit()

    cuerpo = client.get(
        "/api/progress/exercise/0001", headers=auth_headers
    ).json()

    assert len(cuerpo) == 1
    assert cuerpo[0]["max_weight_kg"] == 45.0


def test_exercise_progresion_no_mezcla_ejercicios_distintos_de_la_misma_sesion(
    client, auth_headers, db_session
):
    entrenamiento = Workout(
        user_id=YO,
        client_id=str(uuid.uuid4()),
        routine_id=None,
        started_at=BASE,
        ended_at=BASE + dt.timedelta(minutes=40),
    )
    entrenamiento.ejercicios = [
        WorkoutExercise(
            catalog_id="0001",
            orden=0,
            series=[WorkoutSet(orden=0, reps=10, weight_kg=40, completed_at=BASE)],
        ),
        WorkoutExercise(
            catalog_id="0002",
            orden=1,
            series=[WorkoutSet(orden=0, reps=10, weight_kg=90, completed_at=BASE)],
        ),
    ]
    db_session.add(entrenamiento)
    db_session.commit()

    cuerpo = client.get(
        "/api/progress/exercise/0001", headers=auth_headers
    ).json()

    assert len(cuerpo) == 1
    assert cuerpo[0]["max_weight_kg"] == 40.0


def test_exercise_progresion_ordena_de_mas_reciente_a_mas_vieja(
    client, auth_headers, db_session
):
    _crear_entrenamiento(db_session, YO, BASE, minutos=30, catalog_id="0001")
    _crear_entrenamiento(
        db_session, YO, BASE - dt.timedelta(days=7), minutos=30, catalog_id="0001"
    )

    cuerpo = client.get(
        "/api/progress/exercise/0001", headers=auth_headers
    ).json()

    assert len(cuerpo) == 2
    assert dt.datetime.fromisoformat(cuerpo[0]["started_at"]) > dt.datetime.fromisoformat(
        cuerpo[1]["started_at"]
    )


def test_exercise_progresion_limite_negativo_da_422(client, auth_headers):
    respuesta = client.get(
        "/api/progress/exercise/0001", params={"limite": -1}, headers=auth_headers
    )
    assert respuesta.status_code == 422


def test_exercise_progresion_respeta_el_limite(client, auth_headers, db_session):
    for i in range(3):
        _crear_entrenamiento(
            db_session, YO, BASE - dt.timedelta(days=i), minutos=30, catalog_id="0001"
        )

    cuerpo = client.get(
        "/api/progress/exercise/0001",
        params={"limite": 2},
        headers=auth_headers,
    ).json()

    assert len(cuerpo) == 2


def test_exercise_progresion_pagina_con_el_cursor_hasta(
    client, auth_headers, db_session
):
    """`hasta` es el cursor: solo trae sesiones ANTERIORES a esa fecha."""
    _crear_entrenamiento(db_session, YO, BASE, minutos=30, catalog_id="0001")
    _crear_entrenamiento(
        db_session, YO, BASE - dt.timedelta(days=7), minutos=30, catalog_id="0001"
    )

    cuerpo = client.get(
        "/api/progress/exercise/0001",
        params={"limite": 12, "hasta": BASE.isoformat()},
        headers=auth_headers,
    ).json()

    # No solo la longitud: un 404 con `{"detail": "Not Found"}` también tiene
    # longitud 1 y haría pasar el test sin que el endpoint exista.
    assert len(cuerpo) == 1
    assert cuerpo[0]["max_weight_kg"] == 40.0


def test_exercise_progresion_ignora_a_otros_usuarios(client, auth_headers, db_session):
    _crear_entrenamiento(db_session, YO, BASE, minutos=30, catalog_id="0001")
    _crear_entrenamiento(
        db_session, "otro-usuario", BASE, minutos=30, catalog_id="0001"
    )

    cuerpo = client.get(
        "/api/progress/exercise/0001", headers=auth_headers
    ).json()

    assert len(cuerpo) == 1
    assert cuerpo[0]["max_weight_kg"] == 40.0


def test_exercise_progresion_sin_historial_devuelve_lista_vacia(client, auth_headers):
    cuerpo = client.get(
        "/api/progress/exercise/0001", headers=auth_headers
    ).json()
    assert cuerpo == []


def test_exercise_progresion_encadena_dos_paginas_sin_duplicar(
    client, auth_headers, db_session
):
    for i in range(15):
        _crear_entrenamiento(
            db_session, YO, BASE - dt.timedelta(days=i), minutos=30, catalog_id="0001"
        )

    primera = client.get(
        "/api/progress/exercise/0001", headers=auth_headers
    ).json()
    assert len(primera) == 12

    segunda = client.get(
        "/api/progress/exercise/0001",
        params={"hasta": primera[-1]["started_at"]},
        headers=auth_headers,
    ).json()
    assert len(segunda) == 3

    todos = [s["started_at"] for s in primera] + [s["started_at"] for s in segunda]
    assert len(todos) == len(set(todos))
