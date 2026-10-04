import base64
import json
import logging
from typing import NamedTuple

import anthropic
import httpx
from fastapi import HTTPException

from api.config import Config
from api.schemas import ItemComida
from api.services.catalog import normalizar

logger = logging.getLogger(__name__)

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


def _tipo_imagen(imagen_base64: str) -> str:
    """Tipo MIME según los primeros bytes; 422 si no es un formato soportado."""
    try:
        cabecera = base64.b64decode(imagen_base64[:32] + "=" * (-len(imagen_base64[:32]) % 4))
    except ValueError:
        raise HTTPException(status_code=422, detail="Imagen inválida")
    if cabecera.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if cabecera.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if cabecera.startswith(b"GIF8"):
        return "image/gif"
    if cabecera[:4] == b"RIFF" and cabecera[8:12] == b"WEBP":
        return "image/webp"
    raise HTTPException(status_code=422, detail="Formato de imagen no soportado")


def _get_client() -> anthropic.Anthropic:
    """Inicializa el cliente de Anthropic una sola vez (lazy)."""
    global _client
    if _client is None:
        # Timeout corto y un solo reintento: el endpoint es síncrono y cada
        # llamada colgada ocupa un hilo del threadpool compartido con toda la API.
        _client = anthropic.Anthropic(
            api_key=Config().anthropic_api_key,
            timeout=httpx.Timeout(25.0, connect=5.0),
            max_retries=1,
        )
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
                    "media_type": _tipo_imagen(imagen_base64),
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
        logger.error("Anthropic rechazó la API key")
        raise HTTPException(status_code=502, detail="El análisis no está disponible por ahora.")
    except anthropic.BadRequestError as e:
        mensaje = str(e)
        if "credit balance" in mensaje or "too low" in mensaje:
            logger.error("Anthropic sin créditos")
            raise HTTPException(
                status_code=503, detail="El análisis no está disponible por ahora."
            )
        logger.warning("Anthropic rechazó la solicitud: %s", e)
        raise HTTPException(
            status_code=400, detail="No se pudo analizar la comida. Prueba con otra foto o texto."
        )
    except anthropic.APIError as e:
        logger.error("Error de la API de IA: %s", e)
        raise HTTPException(status_code=502, detail="El análisis no está disponible por ahora.")

    try:
        crudo = respuesta.content[0].text.strip()
        if crudo.startswith("```"):
            crudo = crudo.split("```")[1]
            if crudo.startswith("json"):
                crudo = crudo[4:]
        datos = json.loads(crudo.strip())
        if not isinstance(datos["items"], list) or len(datos["items"]) > 50:
            raise ValueError("items inválido")
        items = [ItemComida(**item) for item in datos["items"]]
    except (json.JSONDecodeError, KeyError, TypeError, IndexError, AttributeError, ValueError) as e:
        logger.warning("Respuesta inválida de Claude: %s", e)
        raise HTTPException(status_code=502, detail="No se pudo interpretar el análisis.")

    return AnalisisComida(items=items, etiqueta=_etiqueta_canonica(datos.get("etiqueta")))
