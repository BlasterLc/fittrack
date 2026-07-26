import pytest

from api.scripts.ingestar import ingestar
from api.services.catalog import filtros

FICHAS = [
    {
        "id": "0025", "name": "barbell bench press", "body_part": "chest",
        "equipment": "barbell", "target": "pectorals",
        "secondary_muscles": ["triceps"], "gif_url": "videos/0025-a.gif",
        "instruction_steps": {"es": ["Paso uno."]},
    },
    {
        "id": "0033", "name": "barbell incline bench press", "body_part": "chest",
        "equipment": "barbell", "target": "pectorals",
        "secondary_muscles": [], "gif_url": "videos/0033-b.gif",
        "instruction_steps": {"es": ["Paso uno."]},
    },
    {
        "id": "0043", "name": "barbell squat", "body_part": "upper legs",
        "equipment": "barbell", "target": "quads",
        "secondary_muscles": [], "gif_url": "videos/0043-c.gif",
        "instruction_steps": {"es": ["Paso uno."]},
    },
]

TRADUCCIONES = {
    "barbell bench press": "Press de banca con barra",
    "barbell incline bench press": "Press inclinado con barra",
    "barbell squat": "Sentadilla con barra",
}


@pytest.fixture
def catalogo(db_session):
    ingestar(db_session, FICHAS, TRADUCCIONES)
    return db_session


def test_busca_por_texto(client, catalogo, auth_headers):
    respuesta = client.get("/api/catalog/search?q=press", headers=auth_headers)
    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["total"] == 2
    assert {r["nombre_es"] for r in cuerpo["resultados"]} == {
        "Press de banca con barra", "Press inclinado con barra",
    }


def test_la_busqueda_ignora_acentos_y_mayusculas(client, catalogo, auth_headers):
    respuesta = client.get("/api/catalog/search?q=SENTADÍLLA", headers=auth_headers)
    assert respuesta.json()["total"] == 1


def test_filtra_por_grupo_muscular(client, catalogo, auth_headers):
    respuesta = client.get("/api/catalog/search?body_part=Piernas", headers=auth_headers)
    assert respuesta.json()["total"] == 1
    assert respuesta.json()["resultados"][0]["nombre_es"] == "Sentadilla con barra"


def test_combina_texto_y_filtro(client, catalogo, auth_headers):
    respuesta = client.get("/api/catalog/search?q=barra&body_part=Pecho", headers=auth_headers)
    assert respuesta.json()["total"] == 2


def test_sin_resultados_devuelve_lista_vacia(client, catalogo, auth_headers):
    respuesta = client.get("/api/catalog/search?q=trapecio volador", headers=auth_headers)
    assert respuesta.status_code == 200
    assert respuesta.json() == {"total": 0, "resultados": []}


def test_requiere_autenticacion(client, catalogo):
    assert client.get("/api/catalog/search?q=press").status_code == 401


def test_total_cuenta_todas_las_coincidencias_no_solo_la_pagina(
    client, catalogo, auth_headers
):
    """`total` es cuántas hay, no cuántas caben en la página.

    Sin esto la app muestra "50 resultados" sobre 294 y no hay forma de
    saber que faltan.
    """
    respuesta = client.get(
        "/api/catalog/search?body_part=Pecho&limite=1", headers=auth_headers
    )
    cuerpo = respuesta.json()
    assert cuerpo["total"] == 2
    assert len(cuerpo["resultados"]) == 1


def test_limite_recorta_la_pagina(client, catalogo, auth_headers):
    respuesta = client.get("/api/catalog/search?limite=2", headers=auth_headers)
    cuerpo = respuesta.json()
    assert cuerpo["total"] == 3
    assert len(cuerpo["resultados"]) == 2


def test_desplazamiento_avanza_sin_repetir(client, catalogo, auth_headers):
    primera = client.get(
        "/api/catalog/search?limite=2&desplazamiento=0", headers=auth_headers
    ).json()
    segunda = client.get(
        "/api/catalog/search?limite=2&desplazamiento=2", headers=auth_headers
    ).json()
    assert len(primera["resultados"]) == 2
    assert len(segunda["resultados"]) == 1
    ids_primera = {r["id"] for r in primera["resultados"]}
    ids_segunda = {r["id"] for r in segunda["resultados"]}
    assert not (ids_primera & ids_segunda)
    assert primera["total"] == segunda["total"] == 3


def test_ficha_completa(client, catalogo, auth_headers):
    respuesta = client.get("/api/catalog/0025", headers=auth_headers)
    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["nombre_es"] == "Press de banca con barra"
    assert cuerpo["target_es"] == "Pectorales"
    assert cuerpo["instrucciones_es"] == ["Paso uno."]
    assert "Gym visual" in cuerpo["atribucion"]


def test_ficha_inexistente_devuelve_404(client, catalogo, auth_headers):
    respuesta = client.get("/api/catalog/9999", headers=auth_headers)
    assert respuesta.status_code == 404


def test_la_ficha_trae_la_url_de_la_animacion(client, catalogo, auth_headers):
    """La app recibe la URL lista: no arma rutas de Storage por su cuenta."""
    cuerpo = client.get("/api/catalog/0025", headers=auth_headers).json()
    assert cuerpo["gif_url"].endswith("/exercise-gifs/0025-a.gif")
    assert "/object/public/" in cuerpo["gif_url"]


def test_la_busqueda_trae_la_url_de_la_animacion(client, catalogo, auth_headers):
    cuerpo = client.get("/api/catalog/search?q=press", headers=auth_headers).json()
    assert all(r["gif_url"].endswith(".gif") for r in cuerpo["resultados"])


def test_filtros_devuelve_valores_distintos_y_ordenados(catalogo):
    resultado = filtros(catalogo)

    # Dos fichas son de Pecho y una de Piernas: el valor repetido aparece
    # una sola vez, y las tres comparten equipamiento.
    assert resultado["grupos_musculares"] == ["Pecho", "Piernas"]
    assert resultado["equipamientos"] == ["Barra"]


def test_filtros_con_la_base_vacia_devuelve_listas_vacias(db_session):
    assert filtros(db_session) == {"grupos_musculares": [], "equipamientos": []}
