"""Descarga el dataset de ejercicios y sus animaciones.

Uso:
    python -m api.scripts.descargar

Es idempotente: los archivos ya descargados se omiten.
"""

import json
import os
import sys
import urllib.request
from pathlib import Path

BASE = "https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main"
DESTINO_JSON = Path("data/exercises.json")
# Configurable para poder descargar directamente sobre otro directorio.
DESTINO_GIFS = Path(os.getenv("MEDIA_DIR", "./media/gifs"))


def descargar(url: str, destino: Path) -> bool:
    """Descarga si el archivo no existe. Devuelve True si escribió algo."""
    if destino.exists() and destino.stat().st_size > 0:
        return False
    destino.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(url, timeout=60) as respuesta:
        destino.write_bytes(respuesta.read())
    return True


def main() -> int:
    print("Descargando el catálogo…")
    descargar(f"{BASE}/data/exercises.json", DESTINO_JSON)
    fichas = json.loads(DESTINO_JSON.read_text())
    print(f"  {len(fichas)} ejercicios")

    print("Descargando animaciones…")
    nuevas = fallidas = 0
    for i, ficha in enumerate(fichas, 1):
        ruta = ficha.get("gif_url")
        if not ruta:
            continue
        destino = DESTINO_GIFS / Path(ruta).name
        try:
            if descargar(f"{BASE}/{ruta}", destino):
                nuevas += 1
        except Exception as error:
            fallidas += 1
            print(f"  fallo en {ruta}: {error}")
        if i % 100 == 0:
            print(f"  {i}/{len(fichas)}")

    total_mb = sum(f.stat().st_size for f in DESTINO_GIFS.glob("*.gif")) / 1024 / 1024
    print(f"\nNuevas: {nuevas} · fallidas: {fallidas} · total en disco: {total_mb:.1f} MB")
    return 1 if fallidas else 0


if __name__ == "__main__":
    sys.exit(main())
