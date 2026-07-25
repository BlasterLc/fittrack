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
