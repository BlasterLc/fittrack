def test_dashboard_sin_token_devuelve_401(client):
    respuesta = client.get("/api/dashboard")
    assert respuesta.status_code == 401


def test_dashboard_vacio_devuelve_meta_y_ceros(client, auth_headers, monkeypatch):
    monkeypatch.setenv("CALORIE_GOAL", "2200")
    respuesta = client.get("/api/dashboard", headers=auth_headers)
    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["calorias"] == {"consumidas": 0, "meta": 2200}
    assert cuerpo["macros"] == {"prot": 0, "carb": 0, "fat": 0}
    assert cuerpo["entrenamiento"] is None
    assert cuerpo["peso"] is None


def _crear_comida(db_session, user_id, calorias, dias_atras=0):
    import datetime as dt

    from api.models import Meal, MealItem

    cuando = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=dias_atras)
    comida = Meal(user_id=user_id, logged_at=cuando)
    comida.items = [MealItem(nombre="X", calorias=calorias, prot_g=10, carbs_g=20, fat_g=5)]
    db_session.add(comida)
    db_session.commit()


def test_dashboard_suma_las_comidas_de_hoy(client, auth_headers, db_session):
    yo = "11111111-1111-1111-1111-111111111111"
    _crear_comida(db_session, yo, calorias=300)
    _crear_comida(db_session, yo, calorias=200)

    cuerpo = client.get("/api/dashboard", headers=auth_headers).json()
    assert cuerpo["calorias"]["consumidas"] == 500
    assert cuerpo["macros"]["prot"] == 20


def test_dashboard_ignora_comidas_de_otros_usuarios(client, auth_headers, db_session):
    yo = "11111111-1111-1111-1111-111111111111"
    _crear_comida(db_session, yo, calorias=300)
    _crear_comida(db_session, "otro-usuario", calorias=999)

    cuerpo = client.get("/api/dashboard", headers=auth_headers).json()
    assert cuerpo["calorias"]["consumidas"] == 300


def test_dashboard_ignora_comidas_de_dias_anteriores(client, auth_headers, db_session):
    yo = "11111111-1111-1111-1111-111111111111"
    _crear_comida(db_session, yo, calorias=300)
    _crear_comida(db_session, yo, calorias=400, dias_atras=2)

    cuerpo = client.get("/api/dashboard", headers=auth_headers).json()
    assert cuerpo["calorias"]["consumidas"] == 300


def test_dashboard_usa_las_metas_del_perfil(client, auth_headers, db_session):
    import datetime as dt

    from api.services import perfil as servicio_perfil

    servicio_perfil.guardar(
        db_session,
        "11111111-1111-1111-1111-111111111111",
        {
            "nombre": "Matías",
            "sexo": "hombre",
            "fecha_nacimiento": dt.date(1998, 3, 14),
            "altura_cm": 176,
            "peso_kg": 78.0,
            "actividad": "moderado",
            "objetivo": "ganar",
        },
    )

    cuerpo = client.get("/api/dashboard", headers=auth_headers).json()

    assert cuerpo["calorias"]["meta"] > 2000
    assert cuerpo["metas_macros"]["prot"] == 140


def test_dashboard_sin_perfil_cae_a_la_meta_generica(client, auth_headers, monkeypatch):
    """Nadie queda peor que antes: sin perfil, todo funciona como hasta ahora."""
    monkeypatch.setenv("CALORIE_GOAL", "2200")

    cuerpo = client.get("/api/dashboard", headers=auth_headers).json()

    assert cuerpo["calorias"]["meta"] == 2200
    assert cuerpo["metas_macros"] is None


def test_dashboard_con_perfil_incompleto_cae_a_la_meta_generica(
    client, auth_headers, db_session, monkeypatch
):
    from api.services import perfil as servicio_perfil

    monkeypatch.setenv("CALORIE_GOAL", "2200")
    servicio_perfil.guardar(
        db_session, "11111111-1111-1111-1111-111111111111", {"nombre": "Matías"}
    )

    cuerpo = client.get("/api/dashboard", headers=auth_headers).json()

    assert cuerpo["calorias"]["meta"] == 2200
    assert cuerpo["metas_macros"] is None


def test_el_dashboard_muestra_el_entrenamiento_de_hoy(client, db_session, auth_headers):
    from tests.test_entrenamientos import sembrar_catalogo
    from api.models import Workout, WorkoutExercise, WorkoutSet
    import datetime as dt

    sembrar_catalogo(db_session)
    ahora = dt.datetime.now(dt.timezone.utc)
    entrenamiento = Workout(
        user_id="11111111-1111-1111-1111-111111111111",
        client_id="hoy",
        started_at=ahora - dt.timedelta(minutes=45),
        ended_at=ahora,
    )
    entrenamiento.ejercicios = [
        WorkoutExercise(
            catalog_id="0025", orden=0,
            series=[
                WorkoutSet(orden=0, reps=8, weight_kg=80.0, completed_at=ahora),
                WorkoutSet(orden=1, reps=8, weight_kg=80.0, completed_at=ahora),
            ],
        )
    ]
    db_session.add(entrenamiento)
    db_session.commit()

    cuerpo = client.get("/api/dashboard", headers=auth_headers).json()

    assert cuerpo["entrenamiento"]["series"] == 2
    assert cuerpo["entrenamiento"]["duracion_min"] == 45


def test_sin_entrenar_hoy_el_dashboard_devuelve_null(client, db_session, auth_headers):
    assert client.get("/api/dashboard", headers=auth_headers).json()["entrenamiento"] is None


def _crear_rutina(db_session, user_id, nombre, archivada=False):
    import datetime as dt

    from api.models import Routine

    rutina = Routine(user_id=user_id, nombre=nombre)
    if archivada:
        rutina.archived_at = dt.datetime.now(dt.timezone.utc)
    db_session.add(rutina)
    db_session.commit()
    db_session.refresh(rutina)
    return rutina


def _crear_entrenamiento(db_session, user_id, client_id, dias_atras=0, routine_id=None):
    """Un entrenamiento de 30 minutos con una serie, para las pruebas de
    aislamiento del resumen diario."""
    import datetime as dt

    from api.models import Workout, WorkoutExercise, WorkoutSet

    fin = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=dias_atras)
    entrenamiento = Workout(
        user_id=user_id,
        client_id=client_id,
        routine_id=routine_id,
        started_at=fin - dt.timedelta(minutes=30),
        ended_at=fin,
    )
    entrenamiento.ejercicios = [
        WorkoutExercise(
            catalog_id="0025", orden=0,
            series=[WorkoutSet(orden=0, reps=8, weight_kg=80.0, completed_at=fin)],
        )
    ]
    db_session.add(entrenamiento)
    db_session.commit()


def test_el_dashboard_ignora_entrenamientos_de_otros_usuarios(client, db_session, auth_headers):
    _crear_entrenamiento(db_session, "otro-usuario", client_id="ajeno")

    cuerpo = client.get("/api/dashboard", headers=auth_headers).json()

    assert cuerpo["entrenamiento"] is None


def test_el_dashboard_no_cuenta_entrenamientos_de_otro_dia(client, db_session, auth_headers):
    yo = "11111111-1111-1111-1111-111111111111"
    _crear_entrenamiento(db_session, yo, client_id="ayer", dias_atras=2)

    cuerpo = client.get("/api/dashboard", headers=auth_headers).json()

    assert cuerpo["entrenamiento"] is None


def test_el_dashboard_suma_dos_entrenamientos_del_mismo_dia(client, db_session, auth_headers):
    yo = "11111111-1111-1111-1111-111111111111"
    _crear_entrenamiento(db_session, yo, client_id="manana")
    _crear_entrenamiento(db_session, yo, client_id="tarde")

    cuerpo = client.get("/api/dashboard", headers=auth_headers).json()

    assert cuerpo["entrenamiento"]["series"] == 2
    assert cuerpo["entrenamiento"]["duracion_min"] == 60


def test_el_dashboard_respeta_la_ventana_local_que_manda_el_telefono(
    client, db_session, auth_headers
):
    """El día lo recorta el teléfono, no el servidor.

    Sin esto el corte era medianoche UTC, y para alguien en Chile (-04) todo
    lo hecho después de las 20:00 contaba para el día siguiente: entrenabas el
    miércoles a las 21:00 y la pantalla Hoy te mostraba cero. Peor, el
    historial de comidas ya agrupaba por día local, así que las dos pantallas
    se contradecían sobre los mismos datos.
    """
    import datetime as dt

    from tests.test_entrenamientos import sembrar_catalogo

    sembrar_catalogo(db_session)
    yo = "11111111-1111-1111-1111-111111111111"

    # Fechas lejos de hoy a propósito: si cayeran en el día UTC actual, el
    # comportamiento viejo daría lo mismo que el nuevo y el test pasaría sin
    # probar nada.
    # Jueves 15/01 a las 21:16 en Chile (-03 en verano) = viernes 16/01 00:16 UTC.
    _crear_entrenamiento_en(
        db_session, yo, "jueves-noche", dt.datetime(2026, 1, 16, 0, 16, tzinfo=dt.timezone.utc)
    )

    # La ventana del jueves chileno: 03:00 UTC del jueves a 03:00 UTC del
    # viernes. La zona va como «Z» y no como «+00:00» a propósito: un «+» sin
    # codificar en una query string se lee como espacio y el request da 422.
    cuerpo = client.get(
        "/api/dashboard?desde=2026-01-15T03:00:00Z&hasta=2026-01-16T03:00:00Z",
        headers=auth_headers,
    ).json()

    assert cuerpo["entrenamiento"] is not None, "el entrenamiento del jueves por la noche tiene que contar para el jueves"
    assert cuerpo["entrenamiento"]["series"] == 1

    # Y en la ventana del viernes chileno ya no aparece.
    siguiente = client.get(
        "/api/dashboard?desde=2026-01-16T03:00:00Z&hasta=2026-01-17T03:00:00Z",
        headers=auth_headers,
    ).json()
    assert siguiente["entrenamiento"] is None


def test_las_comidas_usan_la_misma_ventana_que_el_entrenamiento(
    client, db_session, auth_headers
):
    """Las dos mitades del dashboard tienen que cortar el día igual."""
    import datetime as dt

    from api.models import Meal, MealItem

    yo = "11111111-1111-1111-1111-111111111111"
    # Misma idea que el test de arriba: fecha lejos de hoy, o el día UTC
    # actual la incluiría igual y el test no distinguiría nada.
    comida = Meal(user_id=yo, logged_at=dt.datetime(2026, 1, 16, 0, 30, tzinfo=dt.timezone.utc))
    comida.items = [
        MealItem(nombre="Cena", calorias=700, prot_g=40, carbs_g=60, fat_g=25)
    ]
    db_session.add(comida)
    db_session.commit()

    cuerpo = client.get(
        "/api/dashboard?desde=2026-01-15T03:00:00Z&hasta=2026-01-16T03:00:00Z",
        headers=auth_headers,
    ).json()

    assert cuerpo["calorias"]["consumidas"] == 700


def _crear_entrenamiento_en(db_session, user_id, client_id, empezado):
    import datetime as dt

    from api.models import Workout, WorkoutExercise, WorkoutSet

    w = Workout(
        user_id=user_id,
        client_id=client_id,
        started_at=empezado,
        ended_at=empezado + dt.timedelta(minutes=48),
    )
    w.ejercicios = [
        WorkoutExercise(
            catalog_id="0025",
            orden=0,
            series=[WorkoutSet(orden=0, reps=8, weight_kg=80.0, completed_at=empezado)],
        )
    ]
    db_session.add(w)
    db_session.commit()
    return w


def test_dashboard_muestra_el_peso_mas_reciente(client, auth_headers, db_session):
    import datetime as dt

    from api.models import WeightEntry

    yo = "11111111-1111-1111-1111-111111111111"
    db_session.add(
        WeightEntry(
            user_id=yo, kg=80.0,
            recorded_at=dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=3),
        )
    )
    db_session.add(
        WeightEntry(user_id=yo, kg=78.4, recorded_at=dt.datetime.now(dt.timezone.utc))
    )
    db_session.commit()

    cuerpo = client.get("/api/dashboard", headers=auth_headers).json()

    assert cuerpo["peso"]["kg"] == 78.4


def test_ultima_rutina_es_la_del_entrenamiento_mas_reciente(client, auth_headers, db_session):
    yo = "11111111-1111-1111-1111-111111111111"
    vieja = _crear_rutina(db_session, yo, "Piernas")
    nueva = _crear_rutina(db_session, yo, "Empuje")
    _crear_entrenamiento(db_session, yo, "viejo", dias_atras=3, routine_id=vieja.id)
    _crear_entrenamiento(db_session, yo, "nuevo", dias_atras=1, routine_id=nueva.id)

    cuerpo = client.get("/api/dashboard", headers=auth_headers).json()

    assert cuerpo["ultima_rutina"] == {"id": nueva.id, "nombre": "Empuje"}


def test_ultima_rutina_null_si_nunca_entreno_desde_una_rutina(client, auth_headers, db_session):
    yo = "11111111-1111-1111-1111-111111111111"
    _crear_entrenamiento(db_session, yo, "suelto", dias_atras=1)

    cuerpo = client.get("/api/dashboard", headers=auth_headers).json()

    assert cuerpo["ultima_rutina"] is None


def test_ultima_rutina_salta_la_archivada_y_busca_la_anterior(client, auth_headers, db_session):
    yo = "11111111-1111-1111-1111-111111111111"
    activa = _crear_rutina(db_session, yo, "Piernas")
    archivada = _crear_rutina(db_session, yo, "Empuje viejo", archivada=True)
    _crear_entrenamiento(db_session, yo, "viejo", dias_atras=3, routine_id=activa.id)
    _crear_entrenamiento(db_session, yo, "nuevo", dias_atras=1, routine_id=archivada.id)

    cuerpo = client.get("/api/dashboard", headers=auth_headers).json()

    assert cuerpo["ultima_rutina"] == {"id": activa.id, "nombre": "Piernas"}


def test_ultima_rutina_null_si_todas_las_usadas_estan_archivadas(client, auth_headers, db_session):
    yo = "11111111-1111-1111-1111-111111111111"
    archivada = _crear_rutina(db_session, yo, "Empuje viejo", archivada=True)
    _crear_entrenamiento(db_session, yo, "nuevo", dias_atras=1, routine_id=archivada.id)

    cuerpo = client.get("/api/dashboard", headers=auth_headers).json()

    assert cuerpo["ultima_rutina"] is None
