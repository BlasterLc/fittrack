import os

import pytest
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Debe ejecutarse antes de leer el entorno: api.config también llama a
# load_dotenv(), pero se importa más abajo y para entonces ya es tarde.
load_dotenv()

os.environ["DATABASE_URL"] = os.environ["TEST_DATABASE_URL"]
os.environ.setdefault("SUPABASE_URL", "https://demo.supabase.co")
os.environ.setdefault("SUPABASE_JWT_SECRET", "secreto-de-prueba")
os.environ.setdefault("SUPABASE_STORAGE_BUCKET", "exercise-gifs")

from api.database import Base, get_db  # noqa: E402  (debe importarse tras fijar el entorno)
from api.main import app  # noqa: E402

engine = create_engine(os.environ["TEST_DATABASE_URL"])
TestSession = sessionmaker(bind=engine, autocommit=False, autoflush=False)


@pytest.fixture(autouse=True)
def recrear_tablas():
    """Deja la base vacía antes de cada prueba."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db_session():
    sesion = TestSession()
    try:
        yield sesion
    finally:
        sesion.close()


@pytest.fixture
def client(db_session):
    from fastapi.testclient import TestClient

    def _get_db():
        yield db_session

    app.dependency_overrides[get_db] = _get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
