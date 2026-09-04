import pytest


class _Bloque:
    def __init__(self, text):
        self.text = text


class _Respuesta:
    def __init__(self, text):
        self.content = [_Bloque(text)]


def _cliente_falso(text):
    class _Messages:
        def create(self, **kwargs):
            return _Respuesta(text)

    class _Cliente:
        messages = _Messages()

    return _Cliente()


def test_analizar_parsea_los_items(monkeypatch):
    import api.services.comida as comida

    json_claude = (
        '{"items": [{"nombre": "Pan", "calorias": 80, '
        '"prot_g": 3, "carbs_g": 15, "fat_g": 1}]}'
    )
    monkeypatch.setattr(comida, "_get_client", lambda: _cliente_falso(json_claude))

    items = comida.analizar(texto="un pan").items

    assert len(items) == 1
    assert items[0].nombre == "Pan"
    assert items[0].calorias == 80
    assert items[0].prot_g == 3


def test_analizar_tolera_json_en_bloque_de_codigo(monkeypatch):
    import api.services.comida as comida

    con_fences = '```json\n{"items": [{"nombre": "Manzana", "calorias": 52, "prot_g": 0, "carbs_g": 14, "fat_g": 0}]}\n```'
    monkeypatch.setattr(comida, "_get_client", lambda: _cliente_falso(con_fences))

    items = comida.analizar(texto="una manzana").items
    assert items[0].nombre == "Manzana"


def test_analizar_respuesta_invalida_da_502(monkeypatch):
    import api.services.comida as comida
    from fastapi import HTTPException

    monkeypatch.setattr(comida, "_get_client", lambda: _cliente_falso("no soy json"))

    with pytest.raises(HTTPException) as exc:
        comida.analizar(texto="algo")
    assert exc.value.status_code == 502


def test_analizar_devuelve_la_etiqueta_sugerida_normalizada(monkeypatch):
    """La IA puede devolver el momento en minúsculas o sin acento; se guarda
    con la forma canónica que usa la app."""
    import api.services.comida as comida

    json_claude = (
        '{"items": [{"nombre": "Hamburguesa", "calorias": 500, "prot_g": 25, '
        '"carbs_g": 40, "fat_g": 25}], "etiqueta": "almuerzo"}'
    )
    monkeypatch.setattr(comida, "_get_client", lambda: _cliente_falso(json_claude))

    resultado = comida.analizar(texto="almorcé una hamburguesa")

    assert resultado.etiqueta == "Almuerzo"
    assert resultado.items[0].nombre == "Hamburguesa"


def test_analizar_etiqueta_fuera_del_set_conocido_es_none(monkeypatch):
    import api.services.comida as comida

    json_claude = (
        '{"items": [{"nombre": "Waffles", "calorias": 300, "prot_g": 8, '
        '"carbs_g": 40, "fat_g": 12}], "etiqueta": "brunch"}'
    )
    monkeypatch.setattr(comida, "_get_client", lambda: _cliente_falso(json_claude))

    assert comida.analizar(texto="unos waffles").etiqueta is None


def test_analizar_sin_etiqueta_en_la_respuesta_es_none(monkeypatch):
    import api.services.comida as comida

    json_claude = (
        '{"items": [{"nombre": "Pan", "calorias": 80, "prot_g": 3, '
        '"carbs_g": 15, "fat_g": 1}]}'
    )
    monkeypatch.setattr(comida, "_get_client", lambda: _cliente_falso(json_claude))

    assert comida.analizar(texto="un pan").etiqueta is None
