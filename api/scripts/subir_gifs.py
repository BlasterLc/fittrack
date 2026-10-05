"""Sube las animaciones del catálogo al bucket de Supabase Storage.

Uso:
    python -m api.scripts.subir_gifs [cantidad]

Idempotente: lista lo que ya está en el bucket y sube solo lo que falta, así
que se puede volver a correr si se corta a la mitad. `cantidad` limita cuántas
sube en esta pasada, útil para una prueba corta antes de la carga completa.

Se ejecuta a mano, no en el arranque ni en el deploy: son 122 MB que solo
cambian si cambia el dataset.
"""

import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import httpx

from api.config import Config

CONCURRENCIA = 8
TAMANO_PAGINA = 1000

# Supabase sirve con `no-cache` si no se le indica otra cosa, lo que obligaría
# al teléfono a volver a bajar el mismo GIF en cada scroll. El nombre del
# archivo incluye un hash del origen: si el dibujo cambia, cambia el nombre.
# Por eso el contenido es inmutable y se puede cachear un año.
CACHE = "max-age=31536000, immutable"


def _cliente(config: Config) -> httpx.Client:
    return httpx.Client(
        base_url=config.supabase_url.rstrip("/"),
        headers={
            "apikey": config.supabase_service_role_key,
            "Authorization": f"Bearer {config.supabase_service_role_key}",
        },
        timeout=60.0,
    )


def listar_subidos(cliente: httpx.Client, bucket: str) -> set[str]:
    """Nombres ya presentes en el bucket, paginando hasta agotarlo."""
    nombres: set[str] = set()
    desplazamiento = 0
    while True:
        respuesta = cliente.post(
            f"/storage/v1/object/list/{bucket}",
            json={"prefix": "", "limit": TAMANO_PAGINA, "offset": desplazamiento},
        )
        respuesta.raise_for_status()
        pagina = respuesta.json()
        if not pagina:
            return nombres
        nombres.update(x["name"] for x in pagina)
        desplazamiento += len(pagina)


def subir(cliente: httpx.Client, bucket: str, archivo: Path) -> str | None:
    """Sube un GIF. Devuelve el mensaje de error, o None si salió bien."""
    try:
        respuesta = cliente.post(
            f"/storage/v1/object/{bucket}/{archivo.name}",
            content=archivo.read_bytes(),
            headers={
                "Content-Type": "image/gif",
                "Cache-Control": CACHE,
                # Permite corregir una subida previa sin borrarla a mano.
                "x-upsert": "true",
            },
        )
        if respuesta.status_code in (200, 201):
            return None
        return f"HTTP {respuesta.status_code}: {respuesta.text[:120]}"
    except Exception as error:
        return str(error)


def main() -> int:
    config = Config()
    bucket = config.supabase_storage_bucket
    origen = Path(config.media_dir)

    archivos = sorted(origen.glob("*.gif"))
    if not archivos:
        print(f"No hay animaciones en {origen}. Corre primero api.scripts.descargar.")
        return 1

    with _cliente(config) as cliente:
        subidos = listar_subidos(cliente, bucket)
        print(f"{len(archivos)} archivos en disco · {len(subidos)} ya en el bucket")

        pendientes = [a for a in archivos if a.name not in subidos]
        if len(sys.argv) > 1:
            pendientes = pendientes[: int(sys.argv[1])]
        if not pendientes:
            print("Nada por subir.")
            return 0
        print(f"Subiendo {len(pendientes)}…")

        fallidos: list[tuple[str, str]] = []
        with ThreadPoolExecutor(max_workers=CONCURRENCIA) as pool:
            for i, (archivo, error) in enumerate(
                zip(pendientes, pool.map(lambda a: subir(cliente, bucket, a), pendientes)),
                1,
            ):
                if error:
                    fallidos.append((archivo.name, error))
                if i % 100 == 0:
                    print(f"  {i}/{len(pendientes)}")

    print(f"\nSubidos: {len(pendientes) - len(fallidos)} · fallidos: {len(fallidos)}")
    for nombre, error in fallidos[:10]:
        print(f"  {nombre}: {error}")
    return 1 if fallidos else 0


if __name__ == "__main__":
    sys.exit(main())
