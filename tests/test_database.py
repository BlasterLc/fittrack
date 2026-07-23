from sqlalchemy import text

from api.database import Base, get_db


def test_get_db_entrega_una_sesion_utilizable(db_session):
    resultado = db_session.execute(text("SELECT 1")).scalar()
    assert resultado == 1


def test_base_declara_metadata():
    assert Base.metadata is not None
    assert callable(get_db)
