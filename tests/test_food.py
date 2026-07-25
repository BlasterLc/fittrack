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
        lambda texto=None, imagen_base64=None: [ItemComida(**_ITEMS[0])],
    )
    r = client.post("/api/food/analyze", json={"texto": "avena"}, headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["items"][0]["nombre"] == "Avena"


def test_log_persiste_la_comida(client, auth_headers, db_session):
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
