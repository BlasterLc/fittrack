import os

from dotenv import load_dotenv

load_dotenv()


class Config:
    """Punto único de lectura de variables de entorno.

    Se instancia bajo demanda, no al importar el módulo, para que las
    pruebas puedan cambiar el entorno con monkeypatch.
    """

    def __init__(self) -> None:
        self.app_password = os.environ["APP_PASSWORD"]
        self.database_url = os.environ["DATABASE_URL"]
        self.media_dir = os.getenv("MEDIA_DIR", "./media/gifs")
        self.anthropic_api_key = os.getenv("ANTHROPIC_API_KEY", "")
