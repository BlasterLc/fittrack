from api.services.catalog import normalizar


def test_quita_acentos_y_pasa_a_minusculas():
    assert normalizar("Press Inclinado con Mancuérnas") == "press inclinado con mancuernas"


def test_colapsa_espacios():
    assert normalizar("  press   de  banca  ") == "press de banca"


def test_maneja_la_enie():
    assert normalizar("Extensión de Peñas") == "extension de penas"


def test_cadena_vacia():
    assert normalizar("") == ""
