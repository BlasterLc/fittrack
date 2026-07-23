import os

from api.config import Config


def test_config_lee_variables_de_entorno(monkeypatch):
    monkeypatch.setenv("APP_PASSWORD", "secreta")
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://u:p@host/db")
    monkeypatch.setenv("MEDIA_DIR", "/tmp/gifs")

    config = Config()

    assert config.app_password == "secreta"
    assert config.database_url == "postgresql+psycopg://u:p@host/db"
    assert config.media_dir == "/tmp/gifs"


def test_media_dir_tiene_valor_por_defecto(monkeypatch):
    monkeypatch.setenv("APP_PASSWORD", "secreta")
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://u:p@host/db")
    monkeypatch.delenv("MEDIA_DIR", raising=False)

    config = Config()

    assert config.media_dir == "./media/gifs"
