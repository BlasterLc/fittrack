import datetime
import os

import jwt

UUID_PRUEBA = "11111111-1111-1111-1111-111111111111"


def _token(**cambios) -> str:
    ahora = datetime.datetime.now(datetime.timezone.utc)
    carga = {
        "sub": UUID_PRUEBA,
        "aud": "authenticated",
        "exp": ahora + datetime.timedelta(hours=1),
    }
    carga.update(cambios)
    return jwt.encode(carga, os.environ["SUPABASE_JWT_SECRET"], algorithm="HS256")


def test_me_con_token_valido_devuelve_el_uuid(client):
    respuesta = client.get("/api/me", headers={"Authorization": f"Bearer {_token()}"})
    assert respuesta.status_code == 200
    assert respuesta.json() == {"user_id": UUID_PRUEBA}


def test_me_sin_token_da_401(client):
    assert client.get("/api/me").status_code == 401


def test_me_con_firma_invalida_da_401(client):
    ahora = datetime.datetime.now(datetime.timezone.utc)
    falso = jwt.encode(
        {"sub": UUID_PRUEBA, "aud": "authenticated", "exp": ahora + datetime.timedelta(hours=1)},
        "secreto-equivocado",
        algorithm="HS256",
    )
    assert client.get("/api/me", headers={"Authorization": f"Bearer {falso}"}).status_code == 401


def test_me_con_token_expirado_da_401(client):
    ahora = datetime.datetime.now(datetime.timezone.utc)
    expirado = _token(exp=ahora - datetime.timedelta(hours=1))
    assert client.get("/api/me", headers={"Authorization": f"Bearer {expirado}"}).status_code == 401


def test_me_con_audiencia_incorrecta_da_401(client):
    otro = _token(aud="otra-cosa")
    assert client.get("/api/me", headers={"Authorization": f"Bearer {otro}"}).status_code == 401


def test_salud_es_publica(client):
    respuesta = client.get("/api/health")
    assert respuesta.status_code == 200
    assert respuesta.json() == {"estado": "ok"}


def test_fixture_auth_headers_permite_entrar(client, auth_headers):
    respuesta = client.get("/api/me", headers=auth_headers)
    assert respuesta.status_code == 200
