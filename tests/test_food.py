UUID_PRUEBA = "11111111-1111-1111-1111-111111111111"

_ITEMS = [
    {"nombre": "Avena", "calorias": 150, "prot_g": 5, "carbs_g": 27, "fat_g": 3},
]


def test_analyze_sin_token_da_401(client):
    assert client.post("/api/food/analyze", json={"texto": "avena"}).status_code == 401


def test_analyze_sin_texto_ni_imagen_da_422(client, auth_headers):
    r = client.post("/api/food/analyze", json={}, headers=auth_headers)
    assert r.status_code == 422


def test_analyze_devuelve_los_items(client, auth_headers, monkeypatch):
    import api.services.comida as comida
    from api.schemas import ItemComida

    monkeypatch.setattr(
        comida,
        "analizar",
        lambda texto=None, imagen_base64=None: comida.AnalisisComida(
            items=[ItemComida(**_ITEMS[0])], etiqueta=None
        ),
    )
    r = client.post("/api/food/analyze", json={"texto": "avena"}, headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["items"][0]["nombre"] == "Avena"


def test_analyze_pasa_la_etiqueta_sugerida(client, auth_headers, monkeypatch):
    import api.services.comida as comida
    from api.schemas import ItemComida

    monkeypatch.setattr(
        comida,
        "analizar",
        lambda texto=None, imagen_base64=None: comida.AnalisisComida(
            items=[ItemComida(**_ITEMS[0])], etiqueta="Almuerzo"
        ),
    )
    r = client.post(
        "/api/food/analyze", json={"texto": "almorcé avena"}, headers=auth_headers
    )
    assert r.status_code == 200
    assert r.json()["etiqueta"] == "Almuerzo"


def test_log_persiste_la_comida(client, auth_headers, db_session):
    import datetime as dt

    from api.models import Meal

    r = client.post(
        "/api/food/log",
        json={"items": _ITEMS, "etiqueta": "Desayuno"},
        headers=auth_headers,
    )
    assert r.status_code == 200
    cuerpo = r.json()
    assert cuerpo["etiqueta"] == "Desayuno"
    assert cuerpo["items"][0]["nombre"] == "Avena"

    guardada = db_session.query(Meal).one()
    assert guardada.user_id == UUID_PRUEBA
    assert len(guardada.items) == 1
    assert abs((guardada.logged_at - dt.datetime.now(dt.timezone.utc)).total_seconds()) < 5


def test_historial_filtra_por_rango_y_usuario(client, auth_headers, db_session):
    import datetime as dt
    from urllib.parse import quote

    from api.models import Meal, MealItem

    yo = "11111111-1111-1111-1111-111111111111"
    ahora = dt.datetime.now(dt.timezone.utc)

    def crear(user, dias_atras):
        m = Meal(user_id=user, logged_at=ahora - dt.timedelta(days=dias_atras))
        m.items = [MealItem(nombre="X", calorias=100, prot_g=1, carbs_g=2, fat_g=3)]
        db_session.add(m)
        db_session.commit()

    crear(yo, 1)       # dentro del rango
    crear(yo, 40)      # fuera del rango
    crear("otro", 1)   # de otro usuario

    desde = quote((ahora - dt.timedelta(days=7)).isoformat())
    hasta = quote((ahora + dt.timedelta(days=1)).isoformat())
    r = client.get(f"/api/food?desde={desde}&hasta={hasta}", headers=auth_headers)
    assert r.status_code == 200
    cuerpo = r.json()
    assert len(cuerpo) == 1
    assert cuerpo[0]["items"][0]["nombre"] == "X"


def test_historial_sin_token_da_401(client):
    import datetime as dt
    from urllib.parse import quote

    ahora = quote(dt.datetime.now(dt.timezone.utc).isoformat())
    r = client.get(f"/api/food?desde={ahora}&hasta={ahora}")
    assert r.status_code == 401


def test_patch_reemplaza_items_y_etiqueta(client, auth_headers, db_session):
    creada = client.post(
        "/api/food/log", json={"items": _ITEMS, "etiqueta": "Desayuno"}, headers=auth_headers
    ).json()

    r = client.patch(
        f"/api/food/{creada['id']}",
        json={
            "items": [{"nombre": "Nuevo", "calorias": 500, "prot_g": 1, "carbs_g": 2, "fat_g": 3}],
            "etiqueta": "Cena",
        },
        headers=auth_headers,
    )
    assert r.status_code == 200
    cuerpo = r.json()
    assert cuerpo["etiqueta"] == "Cena"
    assert len(cuerpo["items"]) == 1
    assert cuerpo["items"][0]["nombre"] == "Nuevo"


def test_patch_comida_de_otro_da_404(client, auth_headers, db_session):
    from api.models import Meal, MealItem

    ajena = Meal(user_id="otro-usuario")
    ajena.items = [MealItem(nombre="X", calorias=1, prot_g=1, carbs_g=1, fat_g=1)]
    db_session.add(ajena)
    db_session.commit()

    r = client.patch(f"/api/food/{ajena.id}", json={"items": _ITEMS}, headers=auth_headers)
    assert r.status_code == 404


def test_delete_borra_la_comida(client, auth_headers, db_session):
    from api.models import Meal

    creada = client.post("/api/food/log", json={"items": _ITEMS}, headers=auth_headers).json()

    r = client.delete(f"/api/food/{creada['id']}", headers=auth_headers)
    assert r.status_code == 204
    assert db_session.get(Meal, creada["id"]) is None


def test_delete_comida_de_otro_da_404(client, auth_headers, db_session):
    from api.models import Meal, MealItem

    ajena = Meal(user_id="otro-usuario")
    ajena.items = [MealItem(nombre="X", calorias=1, prot_g=1, carbs_g=1, fat_g=1)]
    db_session.add(ajena)
    db_session.commit()

    r = client.delete(f"/api/food/{ajena.id}", headers=auth_headers)
    assert r.status_code == 404
    assert db_session.get(Meal, ajena.id) is not None


def test_log_con_logged_at_dentro_de_la_ventana_lo_respeta(client, auth_headers, db_session):
    import datetime as dt

    from api.models import Meal

    ayer = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=1)
    r = client.post(
        "/api/food/log",
        json={"items": _ITEMS, "logged_at": ayer.isoformat()},
        headers=auth_headers,
    )
    assert r.status_code == 200
    guardada = db_session.query(Meal).one()
    assert abs((guardada.logged_at - ayer).total_seconds()) < 1


def test_log_con_logged_at_futuro_da_422(client, auth_headers):
    import datetime as dt

    manana = dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=1)
    r = client.post(
        "/api/food/log",
        json={"items": _ITEMS, "logged_at": manana.isoformat()},
        headers=auth_headers,
    )
    assert r.status_code == 422


def test_log_con_logged_at_de_mas_de_7_dias_da_422(client, auth_headers):
    import datetime as dt

    hace_mucho = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=10)
    r = client.post(
        "/api/food/log",
        json={"items": _ITEMS, "logged_at": hace_mucho.isoformat()},
        headers=auth_headers,
    )
    assert r.status_code == 422


def test_patch_cambia_el_logged_at_dentro_de_la_ventana(client, auth_headers, db_session):
    import datetime as dt

    from api.models import Meal

    creada = client.post("/api/food/log", json={"items": _ITEMS}, headers=auth_headers).json()
    ayer = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=1)

    r = client.patch(
        f"/api/food/{creada['id']}",
        json={"items": _ITEMS, "logged_at": ayer.isoformat()},
        headers=auth_headers,
    )
    assert r.status_code == 200
    actualizada = db_session.get(Meal, creada["id"])
    assert abs((actualizada.logged_at - ayer).total_seconds()) < 1


def test_patch_con_logged_at_futuro_da_422(client, auth_headers):
    import datetime as dt

    creada = client.post("/api/food/log", json={"items": _ITEMS}, headers=auth_headers).json()
    manana = dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=1)

    r = client.patch(
        f"/api/food/{creada['id']}",
        json={"items": _ITEMS, "logged_at": manana.isoformat()},
        headers=auth_headers,
    )
    assert r.status_code == 422


def test_patch_sin_logged_at_no_toca_una_comida_vieja(client, auth_headers, db_session):
    import datetime as dt

    from api.models import Meal, MealItem

    vieja = Meal(
        user_id=UUID_PRUEBA,
        logged_at=dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=30),
    )
    vieja.items = [MealItem(nombre="X", calorias=1, prot_g=1, carbs_g=1, fat_g=1)]
    db_session.add(vieja)
    db_session.commit()
    fecha_original = vieja.logged_at

    r = client.patch(
        f"/api/food/{vieja.id}",
        json={"items": _ITEMS, "etiqueta": "Cena"},
        headers=auth_headers,
    )
    assert r.status_code == 200
    db_session.refresh(vieja)
    assert vieja.logged_at == fecha_original


def test_patch_con_logged_at_de_mas_de_7_dias_da_422(client, auth_headers):
    import datetime as dt

    creada = client.post("/api/food/log", json={"items": _ITEMS}, headers=auth_headers).json()
    hace_mucho = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=10)

    r = client.patch(
        f"/api/food/{creada['id']}",
        json={"items": _ITEMS, "logged_at": hace_mucho.isoformat()},
        headers=auth_headers,
    )
    assert r.status_code == 422
