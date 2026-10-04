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
        # Solo para tokens HS256 de prueba. En producción Supabase firma con
        # ES256 (JWKS) y este secreto no se usa ni hace falta definirlo.
        self.supabase_jwt_secret = os.getenv("SUPABASE_JWT_SECRET", "")
        self.allow_hs256_tests = os.getenv("ALLOW_HS256_TESTS") == "1"
        self.supabase_service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
        self.supabase_storage_bucket = os.getenv("SUPABASE_STORAGE_BUCKET", "exercise-gifs")
        self.media_dir = os.getenv("MEDIA_DIR", "./media/gifs")
        self.anthropic_api_key = os.getenv("ANTHROPIC_API_KEY", "")
        self.calorie_goal = int(os.getenv("CALORIE_GOAL", "2000"))
