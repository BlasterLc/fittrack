import json
from unittest.mock import MagicMock, patch

from api.scripts.traducir import parsear_respuesta, traducir_lote


def test_parsear_respuesta_acepta_json_limpio():
    crudo = '{"barbell bench press": "Press de banca con barra"}'
    assert parsear_respuesta(crudo) == {"barbell bench press": "Press de banca con barra"}


def test_parsear_respuesta_tolera_cercos_de_markdown():
    crudo = '```json\n{"push-up": "Flexiones"}\n```'
    assert parsear_respuesta(crudo) == {"push-up": "Flexiones"}


def test_traducir_lote_usa_el_modelo_y_devuelve_el_mapa():
    respuesta = MagicMock()
    respuesta.content = [MagicMock(text=json.dumps({"push-up": "Flexiones"}))]
    cliente = MagicMock()
    cliente.messages.create.return_value = respuesta

    with patch("api.scripts.traducir.obtener_cliente", return_value=cliente):
        resultado = traducir_lote(["push-up"])

    assert resultado == {"push-up": "Flexiones"}
    assert cliente.messages.create.call_args.kwargs["model"] == "claude-haiku-4-5"
