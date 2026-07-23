from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from api.config import Config


class Base(DeclarativeBase):
    pass


_engine = None
_SessionLocal = None


def get_engine():
    """Crea el engine una sola vez, la primera vez que se necesita."""
    global _engine, _SessionLocal
    if _engine is None:
        _engine = create_engine(Config().database_url, pool_pre_ping=True)
        _SessionLocal = sessionmaker(bind=_engine, autocommit=False, autoflush=False)
    return _engine


def get_db() -> Generator[Session, None, None]:
    get_engine()
    db = _SessionLocal()
    try:
        yield db
    finally:
        db.close()
