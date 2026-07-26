from api.models import CatalogExercise
from api.scripts.ingestar import (
    construir_fila,
    desduplicar,
    ingestar,
    reduccion_sospechosa,
)

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

OTRA_FICHA = {
    "id": "0026",
    "name": "barbell squat",
    "body_part": "upper legs",
    "equipment": "barbell",
    "target": "quads",
    "secondary_muscles": ["glutes"],
    "instruction_steps": {"es": ["Un paso."]},
    "gif_url": "videos/0026-AbCdEf.gif",
}

GEMELA = {
    "id": "0099",
    "name": "barbells bench press",
    "body_part": "chest",
    "equipment": "barbell",
    "target": "pectorals",
    "secondary_muscles": ["triceps"],
    "instruction_steps": {"es": ["Otro paso."]},
    "gif_url": "videos/0099-ZzZzZz.gif",
}

TRADUCCIONES_GEMELAS = {
    "barbell bench press": "Press de banca con barra",
    "barbells bench press": "Press de banca con barra",
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


def _fila(id_, nombre_es, equipment="barbell", target="calves"):
    return {"id": id_, "nombre_es": nombre_es, "equipment": equipment, "target": target}


def test_desduplicar_conserva_el_id_mas_bajo():
    filas = [
        _fila("1371", "Elevación de talones sentado con barra"),
        _fila("0088", "Elevación de talones sentado con barra"),
    ]
    assert [f["id"] for f in desduplicar(filas)] == ["0088"]


def test_desduplicar_ignora_el_orden_de_entrada():
    a = [_fila("0088", "Elevación"), _fila("1371", "Elevación")]
    b = [_fila("1371", "Elevación"), _fila("0088", "Elevación")]
    assert desduplicar(a) == desduplicar(b)


def test_desduplicar_no_fusiona_si_cambia_el_equipamiento():
    filas = [
        _fila("0001", "Remo inclinado", equipment="barbell"),
        _fila("0002", "Remo inclinado", equipment="dumbbell"),
    ]
    assert [f["id"] for f in desduplicar(filas)] == ["0001", "0002"]


def test_desduplicar_no_fusiona_si_cambia_el_musculo_objetivo():
    filas = [
        _fila("0001", "Remo inclinado", target="upper back"),
        _fila("0002", "Remo inclinado", target="lats"),
    ]
    assert [f["id"] for f in desduplicar(filas)] == ["0001", "0002"]


def test_desduplicar_deja_intacta_una_lista_sin_duplicados():
    filas = [_fila("0001", "Sentadilla"), _fila("0002", "Press militar")]
    assert desduplicar(filas) == filas


def test_desduplicar_colapsa_un_grupo_de_tres():
    filas = [
        _fila("1396", "Elevación de puntas"),
        _fila("0763", "Elevación de puntas"),
        _fila("1394", "Elevación de puntas"),
    ]
    assert [f["id"] for f in desduplicar(filas)] == ["0763"]


def test_desduplicar_con_lista_vacia_devuelve_lista_vacia():
    assert desduplicar([]) == []


def test_ingestar_elimina_las_fichas_que_ya_no_estan(db_session):
    traducciones = {"barbell bench press": "Press de banca con barra"}
    ingestar(db_session, [FICHA, OTRA_FICHA], traducciones)
    assert db_session.query(CatalogExercise).count() == 2

    ingestar(db_session, [FICHA], traducciones)

    assert db_session.query(CatalogExercise).count() == 1
    assert db_session.get(CatalogExercise, "0026") is None

    superviviente = db_session.get(CatalogExercise, "0025")
    assert superviviente.nombre_es == "Press de banca con barra"
    assert superviviente.instrucciones_es == ["Primer paso.", "Segundo paso."]


def test_ingestar_descarta_el_duplicado_y_conserva_el_id_mas_bajo(db_session):
    resultado = ingestar(db_session, [FICHA, GEMELA], TRADUCCIONES_GEMELAS)

    assert resultado.total == 1
    assert db_session.query(CatalogExercise).count() == 1
    assert db_session.get(CatalogExercise, "0025") is not None
    assert db_session.get(CatalogExercise, "0099") is None


def test_ingestar_con_lista_vacia_deja_la_tabla_vacia(db_session):
    ingestar(db_session, [FICHA], {"barbell bench press": "Press de banca con barra"})

    resultado = ingestar(db_session, [], {})

    assert resultado.total == 0
    assert resultado.borradas == 1
    assert db_session.query(CatalogExercise).count() == 0


def test_reduccion_no_sospechosa_en_base_vacia():
    assert reduccion_sospechosa(0, 0) is False


def test_reduccion_no_sospechosa_en_la_corrida_real_de_esta_fase():
    assert reduccion_sospechosa(1312, 1324) is False


def test_reduccion_sospechosa_si_el_dataset_llega_vacio():
    assert reduccion_sospechosa(0, 1324) is True


def test_reduccion_no_sospechosa_justo_en_el_borde_del_margen():
    assert reduccion_sospechosa(90, 100) is False
