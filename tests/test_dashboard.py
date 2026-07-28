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
