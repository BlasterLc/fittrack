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


# Un ejercicio cuyo nombre en inglés y su traducción no comparten ninguna
# palabra: sirve para probar que la búsqueda cruza los dos idiomas.
CRUCE = [
    {
        "id": "0060", "name": "cable reverse fly", "body_part": "shoulders",
        "equipment": "cable", "target": "delts",
        "secondary_muscles": [], "gif_url": "videos/0060-a.gif",
        "instruction_steps": {"es": ["Paso uno."]},
    },
]


@pytest.fixture
def catalogo_cruce(db_session):
    ingestar(db_session, CRUCE, {"cable reverse fly": "Aperturas invertidas en polea"})
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


def test_busca_por_el_nombre_en_ingles(client, catalogo, auth_headers):
    """"squat" no está en "Sentadilla con barra" pero sí en el nombre original."""
    respuesta = client.get("/api/catalog/search?q=squat", headers=auth_headers)
    cuerpo = respuesta.json()
    assert cuerpo["total"] == 1
    assert cuerpo["resultados"][0]["nombre_es"] == "Sentadilla con barra"


def test_busca_por_palabras_sueltas_en_cualquier_orden(client, catalogo, auth_headers):
    """Cada palabra se busca por separado: el orden y la contigüidad no importan."""
    respuesta = client.get("/api/catalog/search?q=squat+barbell", headers=auth_headers)
    cuerpo = respuesta.json()
    assert cuerpo["total"] == 1
    assert cuerpo["resultados"][0]["nombre_es"] == "Sentadilla con barra"


def test_busca_cruzando_palabras_de_los_dos_idiomas(client, catalogo_cruce, auth_headers):
    """"fly" solo está en el nombre en inglés; "polea" solo en el español."""
    respuesta = client.get("/api/catalog/search?q=fly+polea", headers=auth_headers)
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
    assert filtros(db_session) == {
        "grupos_musculares": [],
        "equipamientos": [],
        "grupos_disponibles": [],
        "equipamientos_disponibles": [],
    }


def test_endpoint_filtros_devuelve_las_dos_listas(client, catalogo, auth_headers):
    r = client.get("/api/catalog/filtros", headers=auth_headers)

    assert r.status_code == 200
    assert r.json() == {
        "grupos_musculares": ["Pecho", "Piernas"],
        "equipamientos": ["Barra"],
        "grupos_disponibles": ["Pecho", "Piernas"],
        "equipamientos_disponibles": ["Barra"],
    }


# --- Filtros combinados que dan cero -----------------------------------
# El dataset real tiene equipamientos que solo existen en algunos grupos
# musculares: "balón bosu" está en Pecho y Piernas, pero no en Espalda.
# Combinar Espalda + bosu daba cero resultados sin ninguna señal previa.

ASIMETRICAS = [
    {
        "id": "1001", "name": "bosu ball push up", "body_part": "chest",
        "equipment": "bosu ball", "target": "pectorals",
        "secondary_muscles": [], "gif_url": "videos/1001-a.gif",
        "instruction_steps": {"es": ["Paso uno."]},
    },
    {
        "id": "1002", "name": "barbell row", "body_part": "back",
        "equipment": "barbell", "target": "lats",
        "secondary_muscles": [], "gif_url": "videos/1002-b.gif",
        "instruction_steps": {"es": ["Paso uno."]},
    },
    {
        "id": "1003", "name": "barbell bench press", "body_part": "chest",
        "equipment": "barbell", "target": "pectorals",
        "secondary_muscles": [], "gif_url": "videos/1003-c.gif",
        "instruction_steps": {"es": ["Paso uno."]},
    },
]


@pytest.fixture
def catalogo_asimetrico(db_session):
    ingestar(db_session, ASIMETRICAS, {})
    return db_session


def test_sin_filtros_activos_todo_esta_disponible(catalogo_asimetrico):
    r = filtros(catalogo_asimetrico)

    assert r["grupos_disponibles"] == r["grupos_musculares"] == ["Espalda", "Pecho"]
    assert r["equipamientos_disponibles"] == r["equipamientos"] == ["Balón bosu", "Barra"]


def test_un_grupo_activo_atenua_el_equipamiento_imposible(catalogo_asimetrico):
    """El caso que reportó Matías: Espalda no tiene ningún ejercicio con bosu."""
    r = filtros(catalogo_asimetrico, body_part="Espalda")

    # La lista completa no cambia: los chips no desaparecen ni se reordenan.
    assert r["equipamientos"] == ["Balón bosu", "Barra"]
    # Pero solo "Barra" sigue dando resultados.
    assert r["equipamientos_disponibles"] == ["Barra"]


def test_el_grupo_activo_no_se_restringe_a_si_mismo(catalogo_asimetrico):
    """Cambiar de grupo muscular nunca puede quedar sin opciones.

    Si los grupos se filtraran por el grupo activo, solo quedaría "Espalda"
    disponible y tocar cualquier otro chip sería imposible.
    """
    r = filtros(catalogo_asimetrico, body_part="Espalda")

    assert r["grupos_disponibles"] == ["Espalda", "Pecho"]


def test_un_equipamiento_activo_atenua_los_grupos_imposibles(catalogo_asimetrico):
    r = filtros(catalogo_asimetrico, equipment="Balón bosu")

    assert r["grupos_musculares"] == ["Espalda", "Pecho"]
    assert r["grupos_disponibles"] == ["Pecho"]
    # Y el equipamiento activo tampoco se restringe a sí mismo.
    assert r["equipamientos_disponibles"] == ["Balón bosu", "Barra"]


def test_la_busqueda_por_texto_tambien_restringe(catalogo_asimetrico):
    r = filtros(catalogo_asimetrico, q="row")

    assert r["grupos_disponibles"] == ["Espalda"]
    assert r["equipamientos_disponibles"] == ["Barra"]


def test_endpoint_filtros_acepta_los_filtros_activos(
    client, catalogo_asimetrico, auth_headers
):
    r = client.get("/api/catalog/filtros?body_part=Espalda", headers=auth_headers)

    assert r.status_code == 200
    assert r.json()["equipamientos"] == ["Balón bosu", "Barra"]
    assert r.json()["equipamientos_disponibles"] == ["Barra"]


def test_endpoint_filtros_exige_token(client):
    assert client.get("/api/catalog/filtros").status_code == 401


def test_filtros_no_cae_en_el_handler_de_ficha(client, auth_headers):
    """Con la base vacía, /filtros debe dar 200 y no 404.

    Si la ruta se declarara después de /{ejercicio_id}, FastAPI la
    tomaría como una ficha con id "filtros" y respondería 404.
    """
    r = client.get("/api/catalog/filtros", headers=auth_headers)

    assert r.status_code == 200
    # Lo que importa es que responda el handler de filtros y no el de ficha:
    # la forma exacta del payload la fijan los tests de arriba.
    assert "grupos_musculares" in r.json()
