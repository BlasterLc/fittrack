import datetime as dt

from api.models import WeightEntry

YO = "11111111-1111-1111-1111-111111111111"
BASE = dt.datetime(2025, 3, 10, 15, 0, tzinfo=dt.timezone.utc)


def _crear_registro(db_session, user_id, kg, cuando):
    """Crea un registro con una fecha controlada, saltando el `server_default`
    de `recorded_at` (que siempre pone "ahora"). Se usa para las pruebas de
    orden y paginación, donde hace falta fijar el tiempo a mano."""
    registro = WeightEntry(user_id=user_id, kg=kg, recorded_at=cuando)
    db_session.add(registro)
    db_session.commit()
    db_session.refresh(registro)
    return registro


def test_crear_sin_token_devuelve_401(client):
    respuesta = client.post("/api/weight", json={"kg": 78.0})
    assert respuesta.status_code == 401


def test_crear_devuelve_el_registro_con_fecha_del_servidor(client, auth_headers):
    respuesta = client.post("/api/weight", json={"kg": 78.5}, headers=auth_headers)

    assert respuesta.status_code == 201
    cuerpo = respuesta.json()
    assert cuerpo["kg"] == 78.5
    assert cuerpo["recorded_at"] is not None
    assert "id" in cuerpo


def test_crear_rechaza_un_peso_fuera_de_rango(client, auth_headers):
    respuesta = client.post("/api/weight", json={"kg": 29.0}, headers=auth_headers)

    assert respuesta.status_code == 422
    # La app muestra este texto tal cual, así que tiene que ser una cadena.
    assert isinstance(respuesta.json()["detail"], str)


def test_crear_permite_varios_registros_el_mismo_dia(client, auth_headers, db_session):
    client.post("/api/weight", json={"kg": 78.0}, headers=auth_headers)
    client.post("/api/weight", json={"kg": 78.4}, headers=auth_headers)

    assert db_session.query(WeightEntry).filter_by(user_id=YO).count() == 2


def test_listar_sin_token_devuelve_401(client):
    respuesta = client.get("/api/weight")
    assert respuesta.status_code == 401


def test_listar_ordena_de_mas_reciente_a_mas_vieja(client, auth_headers, db_session):
    _crear_registro(db_session, YO, 80.0, BASE - dt.timedelta(days=7))
    _crear_registro(db_session, YO, 78.0, BASE)

    cuerpo = client.get("/api/weight", headers=auth_headers).json()

    assert len(cuerpo) == 2
    assert cuerpo[0]["kg"] == 78.0
    assert cuerpo[1]["kg"] == 80.0


def test_listar_respeta_el_limite(client, auth_headers, db_session):
    for i in range(3):
        _crear_registro(db_session, YO, 78.0 + i, BASE - dt.timedelta(days=i))

    cuerpo = client.get("/api/weight", params={"limite": 2}, headers=auth_headers).json()

    assert len(cuerpo) == 2


def test_listar_limite_negativo_da_422(client, auth_headers):
    respuesta = client.get("/api/weight", params={"limite": -1}, headers=auth_headers)
    assert respuesta.status_code == 422


def test_listar_pagina_con_el_cursor_hasta(client, auth_headers, db_session):
    """`hasta` es el cursor: solo trae registros ANTERIORES a esa fecha."""
    _crear_registro(db_session, YO, 80.0, BASE - dt.timedelta(days=7))
    _crear_registro(db_session, YO, 78.0, BASE)

    cuerpo = client.get(
        "/api/weight", params={"limite": 12, "hasta": BASE.isoformat()}, headers=auth_headers
    ).json()

    # No solo la longitud: un 404 con {"detail": "Not Found"} también da 1.
    assert len(cuerpo) == 1
    assert cuerpo[0]["kg"] == 80.0


def test_listar_encadena_dos_paginas_sin_duplicar(client, auth_headers, db_session):
    for i in range(15):
        _crear_registro(db_session, YO, 70.0 + i, BASE - dt.timedelta(days=i))

    primera = client.get("/api/weight", headers=auth_headers).json()
    assert len(primera) == 12

    segunda = client.get(
        "/api/weight", params={"hasta": primera[-1]["recorded_at"]}, headers=auth_headers
    ).json()
    assert len(segunda) == 3

    todos = [r["id"] for r in primera] + [r["id"] for r in segunda]
    assert len(todos) == len(set(todos))


def test_listar_ignora_a_otros_usuarios(client, auth_headers, db_session):
    _crear_registro(db_session, YO, 78.0, BASE)
    _crear_registro(db_session, "otro-usuario", 99.0, BASE)

    cuerpo = client.get("/api/weight", headers=auth_headers).json()

    assert len(cuerpo) == 1
    assert cuerpo[0]["kg"] == 78.0


def test_listar_sin_registros_devuelve_lista_vacia(client, auth_headers):
    cuerpo = client.get("/api/weight", headers=auth_headers).json()
    assert cuerpo == []


def test_borrar_sin_token_devuelve_401(client):
    respuesta = client.delete("/api/weight/1")
    assert respuesta.status_code == 401


def test_borrar_un_registro_propio(client, auth_headers, db_session):
    registro = _crear_registro(db_session, YO, 78.0, BASE)

    respuesta = client.delete(f"/api/weight/{registro.id}", headers=auth_headers)

    assert respuesta.status_code == 204
    assert db_session.get(WeightEntry, registro.id) is None


def test_borrar_un_registro_de_otro_usuario_da_404(client, auth_headers, db_session):
    registro = _crear_registro(db_session, "otro-usuario", 99.0, BASE)

    respuesta = client.delete(f"/api/weight/{registro.id}", headers=auth_headers)

    assert respuesta.status_code == 404
    assert db_session.get(WeightEntry, registro.id) is not None


def test_borrar_un_registro_inexistente_da_404(client, auth_headers):
    respuesta = client.delete("/api/weight/9999", headers=auth_headers)
    assert respuesta.status_code == 404
