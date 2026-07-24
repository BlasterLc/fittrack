"""Traduce al español los nombres de ejercicio del dataset.

Uso:
    python -m api.scripts.traducir

El resultado se guarda en data/nombres_es.json para no repetir el gasto.
"""

import json
import sys
from pathlib import Path

import anthropic

from api.config import Config

MODELO = "claude-haiku-4-5"
TAMANO_LOTE = 60
ORIGEN = Path("data/exercises.json")
DESTINO = Path("data/nombres_es.json")

INSTRUCCION = """Traduce al español neutro estos nombres de ejercicios de gimnasio.

Reglas:
- Español neutro, sin regionalismos. Nada de voseo.
- Usa la terminología habitual de gimnasio en español.
- Primera letra en mayúscula, el resto en minúscula salvo nombres propios.
- Conserva las marcas de equipamiento cuando existan (Smith, Hammer).

Responde únicamente con un objeto JSON que mapee cada nombre original a su
traducción. Sin explicaciones ni cercos de código.

Nombres:
"""

_cliente = None


def obtener_cliente() -> anthropic.Anthropic:
    global _cliente
    if _cliente is None:
        _cliente = anthropic.Anthropic(api_key=Config().anthropic_api_key)
    return _cliente


def parsear_respuesta(crudo: str) -> dict[str, str]:
    """Extrae el JSON, tolerando que venga envuelto en cercos de markdown."""
    texto = crudo.strip()
    if texto.startswith("```"):
        lineas = [l for l in texto.splitlines() if not l.strip().startswith("```")]
        texto = "\n".join(lineas)
    return json.loads(texto)


def traducir_lote(nombres: list[str]) -> dict[str, str]:
    respuesta = obtener_cliente().messages.create(
        model=MODELO,
        max_tokens=4000,
        messages=[{"role": "user", "content": INSTRUCCION + json.dumps(nombres, ensure_ascii=False)}],
    )
    return parsear_respuesta(respuesta.content[0].text)


def main() -> int:
    fichas = json.loads(ORIGEN.read_text())
    nombres = sorted({f["name"] for f in fichas})
    print(f"{len(nombres)} nombres únicos por traducir")

    traducciones: dict[str, str] = {}
    if DESTINO.exists():
        traducciones = json.loads(DESTINO.read_text())
        print(f"  {len(traducciones)} ya traducidos, se omiten")

    pendientes = [n for n in nombres if n not in traducciones]
    for i in range(0, len(pendientes), TAMANO_LOTE):
        lote = pendientes[i : i + TAMANO_LOTE]
        try:
            traducciones.update(traducir_lote(lote))
            print(f"  lote {i // TAMANO_LOTE + 1}: {len(lote)} traducidos")
        except Exception as error:
            print(f"  fallo en el lote {i // TAMANO_LOTE + 1}: {error}")
        DESTINO.parent.mkdir(parents=True, exist_ok=True)
        DESTINO.write_text(json.dumps(traducciones, ensure_ascii=False, indent=1))

    faltan = [n for n in nombres if n not in traducciones]
    print(f"\nTraducidos: {len(traducciones)} · sin traducir: {len(faltan)}")
    if faltan:
        print("Ejecuta el script de nuevo para reintentar los que faltan.")
    return 1 if faltan else 0


if __name__ == "__main__":
    sys.exit(main())
