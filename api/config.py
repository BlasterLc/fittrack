import os

from dotenv import load_dotenv

load_dotenv()


class Config:
    """Punto único de lectura de variables de entorno.

    Se instancia bajo demanda, no al importar el módulo, para que las
    pruebas puedan cambiar el entorno con monkeypatch.
    """

    def __init__(self) -> None:
        self.database_url = os.environ["DATABASE_URL"]
        self.supabase_url = os.environ["SUPABASE_URL"]
        self.supabase_jwt_secret = os.environ["SUPABASE_JWT_SECRET"]
        self.supabase_service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
        self.supabase_storage_bucket = os.getenv("SUPABASE_STORAGE_BUCKET", "exercise-gifs")
        self.media_dir = os.getenv("MEDIA_DIR", "./media/gifs")
        self.anthropic_api_key = os.getenv("ANTHROPIC_API_KEY", "")
