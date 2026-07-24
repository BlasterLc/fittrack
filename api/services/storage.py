"""URLs de las animaciones alojadas en Supabase Storage.

El bucket es público a propósito: son animaciones de un dataset de terceros,
compartidas por todos los usuarios, no datos personales. Una URL fija se
cachea en el CDN y en el teléfono; una URL firmada expira y obliga a volver
a descargar el mismo GIF en cada scroll.

La arma el backend y no la app para que cambiar de bucket o de proyecto no
exija publicar una versión nueva en las tiendas.
"""

from api.config import Config


def url_publica(gif_path: str) -> str:
    """URL pública y estable de una animación. Cadena vacía si no hay archivo."""
    if not gif_path:
        return ""
    config = Config()
    base = config.supabase_url.rstrip("/")
    return f"{base}/storage/v1/object/public/{config.supabase_storage_bucket}/{gif_path}"
