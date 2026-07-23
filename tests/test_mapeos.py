from api.scripts.mapeos import BODY_PART, EQUIPMENT, TARGET, traducir


def test_traduce_valores_conocidos():
    assert traducir(BODY_PART, "chest") == "Pecho"
    assert traducir(EQUIPMENT, "barbell") == "Barra"
    assert traducir(TARGET, "pectorals") == "Pectorales"


def test_valor_desconocido_se_devuelve_capitalizado():
    assert traducir(BODY_PART, "tentacles") == "Tentacles"


def test_cubre_todas_las_categorias_del_dataset():
    partes = {
        "back", "cardio", "chest", "lower arms", "lower legs",
        "neck", "shoulders", "upper arms", "upper legs", "waist",
    }
    assert partes <= set(BODY_PART)
