from api.config import Config


def test_config_lee_variables_de_entorno(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://u:p@host/db")
    monkeypatch.setenv("SUPABASE_URL", "https://demo.supabase.co")
    monkeypatch.setenv("SUPABASE_JWT_SECRET", "secreto-de-prueba")
    monkeypatch.setenv("SUPABASE_STORAGE_BUCKET", "gifs-test")
    monkeypatch.setenv("MEDIA_DIR", "/tmp/gifs")

    config = Config()

    assert config.database_url == "postgresql+psycopg://u:p@host/db"
    assert config.supabase_url == "https://demo.supabase.co"
    assert config.supabase_jwt_secret == "secreto-de-prueba"
    assert config.supabase_storage_bucket == "gifs-test"
    assert config.media_dir == "/tmp/gifs"


def test_bucket_tiene_valor_por_defecto(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://u:p@host/db")
    monkeypatch.setenv("SUPABASE_URL", "https://demo.supabase.co")
    monkeypatch.setenv("SUPABASE_JWT_SECRET", "x")
    monkeypatch.delenv("SUPABASE_STORAGE_BUCKET", raising=False)

    config = Config()

    assert config.supabase_storage_bucket == "exercise-gifs"


def test_calorie_goal_por_defecto_2000(monkeypatch):
    monkeypatch.delenv("CALORIE_GOAL", raising=False)
    from api.config import Config

    assert Config().calorie_goal == 2000


def test_calorie_goal_lee_del_entorno(monkeypatch):
    monkeypatch.setenv("CALORIE_GOAL", "2500")
    from api.config import Config

    assert Config().calorie_goal == 2500
