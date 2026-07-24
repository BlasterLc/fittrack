import pytest

from api.services import storage


@pytest.fixture
def entorno(monkeypatch):
    """Fija el proyecto y el bucket para que la URL esperada sea exacta."""
    monkeypatch.setenv("SUPABASE_URL", "https://proyecto.supabase.co")
    monkeypatch.setenv("SUPABASE_STORAGE_BUCKET", "exercise-gifs")


def test_arma_la_url_publica_de_una_animacion(entorno):
    assert storage.url_publica("1655-niXESDw.gif") == (
        "https://proyecto.supabase.co"
        "/storage/v1/object/public/exercise-gifs/1655-niXESDw.gif"
    )


def test_tolera_barra_final_en_supabase_url(entorno, monkeypatch):
    """Una barra de más en la variable de entorno no debe romper la URL."""
    monkeypatch.setenv("SUPABASE_URL", "https://proyecto.supabase.co/")
    assert storage.url_publica("a.gif") == (
        "https://proyecto.supabase.co/storage/v1/object/public/exercise-gifs/a.gif"
    )


def test_respeta_el_bucket_configurado(entorno, monkeypatch):
    monkeypatch.setenv("SUPABASE_STORAGE_BUCKET", "otro-bucket")
    assert "/public/otro-bucket/a.gif" in storage.url_publica("a.gif")


def test_sin_animacion_devuelve_cadena_vacia(entorno):
    """Una ficha sin GIF no debe producir una URL rota que el teléfono intente cargar."""
    assert storage.url_publica("") == ""
