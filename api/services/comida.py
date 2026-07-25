import json

import anthropic
from fastapi import HTTPException

from api.config import Config
from api.schemas import ItemComida

_client: anthropic.Anthropic | None = None


def _get_client() -> anthropic.Anthropic:
    """Inicializa el cliente de Anthropic una sola vez (lazy)."""
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=Config().anthropic_api_key)
    return _client


_PROMPT = (
    "Analiza esta comida y devuelve SOLO un JSON válido con este formato exacto: "
    '{"items": [{"nombre": "string", "calorias": int, "prot_g": float, '
    '"carbs_g": float, "fat_g": float}]}. '
    "Sin texto adicional, solo el JSON."
)


def analizar(texto: str | None = None, imagen_base64: str | None = None) -> list[ItemComida]:
    """Estima los macros de una comida con Claude Haiku (texto y/o imagen).

    No persiste nada. Devuelve la lista de ítems estimados o levanta un
    HTTPException con un mensaje en español si la API falla."""
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
        return [ItemComida(**item) for item in datos["items"]]
    except (json.JSONDecodeError, KeyError, TypeError, IndexError) as e:
        raise HTTPException(status_code=502, detail=f"Respuesta inválida de Claude: {e}")
