import json
from typing import NamedTuple

import anthropic
from fastapi import HTTPException

from api.config import Config
from api.schemas import ItemComida
from api.services.catalog import normalizar

_client: anthropic.Anthropic | None = None

# Los cinco momentos que maneja la app (labels chilenos, los mismos que
# `etiquetaPorHora` en el cliente), indexados por su forma normalizada.
_ETIQUETAS = {
    "desayuno": "Desayuno",
    "almuerzo": "Almuerzo",
    "once": "Once",
    "cena": "Cena",
    "colacion": "Colación",
}


class AnalisisComida(NamedTuple):
    items: list[ItemComida]
    # El momento del día si el texto lo menciona, si no None: ahí el cliente
    # cae a la sugerencia por hora.
    etiqueta: str | None


def _etiqueta_canonica(cruda) -> str | None:
    """Mapea lo que devuelve la IA al label exacto de la app, o None.

    La IA puede contestar en minúsculas, sin acento o con un momento que no
    manejamos ("brunch"): nada de eso se guarda crudo."""
    if not isinstance(cruda, str):
        return None
    return _ETIQUETAS.get(normalizar(cruda))


def _get_client() -> anthropic.Anthropic:
    """Inicializa el cliente de Anthropic una sola vez (lazy)."""
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=Config().anthropic_api_key)
    return _client


_PROMPT = (
    "Analiza esta comida y devuelve SOLO un JSON válido con este formato exacto: "
    '{"items": [{"nombre": "string", "calorias": int, "prot_g": float, '
    '"carbs_g": float, "fat_g": float}], "etiqueta": string|null}. '
    'El campo "etiqueta" es el momento del día y solo puede ser uno de: '
    '"Desayuno", "Almuerzo", "Once", "Cena", "Colación". '
    "Ponlo únicamente si la descripción menciona o implica claramente ese "
    'momento (ej: "almorcé...", "en la cena", "para el desayuno"). '
    'Si no lo menciona, o si es una foto sin descripción, pon "etiqueta": null. '
    "Sin texto adicional, solo el JSON."
)


def analizar(texto: str | None = None, imagen_base64: str | None = None) -> AnalisisComida:
    """Estima los macros de una comida con Claude Haiku (texto y/o imagen).

    No persiste nada. Devuelve los ítems estimados y, si el texto lo menciona,
    el momento del día; o levanta un HTTPException con un mensaje en español si
    la API falla."""
    contenido: list = []
    if imagen_base64:
        contenido.append(
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": "image/jpeg",
                    "data": imagen_base64,
                },
            }
        )
    prompt = _PROMPT
    if texto:
        prompt += f"\n\nDescripción: {texto}"
    contenido.append({"type": "text", "text": prompt})

    try:
        respuesta = _get_client().messages.create(
            model="claude-haiku-4-5",
            max_tokens=1024,
            messages=[{"role": "user", "content": contenido}],
        )
    except anthropic.AuthenticationError:
        raise HTTPException(status_code=502, detail="La API key de Anthropic es inválida.")
    except anthropic.BadRequestError as e:
        mensaje = str(e)
        if "credit balance" in mensaje or "too low" in mensaje:
            raise HTTPException(
                status_code=402,
                detail="Sin créditos en Anthropic. Carga saldo en console.anthropic.com.",
            )
        raise HTTPException(status_code=400, detail=f"Solicitud rechazada por Anthropic: {e}")
    except anthropic.APIError as e:
        raise HTTPException(status_code=502, detail=f"Error de la API de IA: {e}")

    try:
        crudo = respuesta.content[0].text.strip()
        if crudo.startswith("```"):
            crudo = crudo.split("```")[1]
            if crudo.startswith("json"):
                crudo = crudo[4:]
        datos = json.loads(crudo.strip())
        items = [ItemComida(**item) for item in datos["items"]]
    except (json.JSONDecodeError, KeyError, TypeError, IndexError) as e:
        raise HTTPException(status_code=502, detail=f"Respuesta inválida de Claude: {e}")

    return AnalisisComida(items=items, etiqueta=_etiqueta_canonica(datos.get("etiqueta")))
