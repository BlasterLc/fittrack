from api.models import CatalogExercise
from api.scripts.ingestar import construir_fila, ingestar

FICHA = {
    "id": "0025",
    "name": "barbell bench press",
    "body_part": "chest",
    "equipment": "barbell",
    "target": "pectorals",
    "secondary_muscles": ["triceps", "shoulders"],
    "instruction_steps": {"es": ["Primer paso.", "Segundo paso."], "en": ["First."]},
    "gif_url": "videos/0025-EIeI8Vf.gif",
}


def test_construir_fila_traduce_y_normaliza():
    fila = construir_fila(FICHA, {"barbell bench press": "Press de banca con barra"})

    assert fila["id"] == "0025"
    assert fila["nombre_es"] == "Press de banca con barra"
    assert fila["nombre_norm"] == "press de banca con barra"
    assert fila["body_part_es"] == "Pecho"
    assert fila["equipment_es"] == "Barra"
    assert fila["target_es"] == "Pectorales"
    assert fila["gif_path"] == "0025-EIeI8Vf.gif"
    assert "Gym visual" in fila["atribucion"]


def test_sin_traduccion_usa_el_nombre_en_ingles():
    fila = construir_fila(FICHA, {})
    assert fila["nombre_es"] == "barbell bench press"


def test_ingestar_inserta_las_fichas(db_session):
    ingestar(db_session, [FICHA], {"barbell bench press": "Press de banca con barra"})

    assert db_session.query(CatalogExercise).count() == 1
    guardado = db_session.get(CatalogExercise, "0025")
    assert guardado.instrucciones_es == ["Primer paso.", "Segundo paso."]


def test_ingestar_es_idempotente(db_session):
    traducciones = {"barbell bench press": "Press de banca con barra"}
    ingestar(db_session, [FICHA], traducciones)
    ingestar(db_session, [FICHA], traducciones)

    assert db_session.query(CatalogExercise).count() == 1


def test_ingestar_actualiza_una_traduccion_corregida(db_session):
    ingestar(db_session, [FICHA], {"barbell bench press": "Press banca"})
    ingestar(db_session, [FICHA], {"barbell bench press": "Press de banca con barra"})

    guardado = db_session.get(CatalogExercise, "0025")
    assert guardado.nombre_es == "Press de banca con barra"
