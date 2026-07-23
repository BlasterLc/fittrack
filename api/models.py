from sqlalchemy import String, Text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from api.database import Base


class CatalogExercise(Base):
    """Ficha de ejercicio proveniente del dataset, ya traducida."""

    __tablename__ = "catalog_exercises"

    id: Mapped[str] = mapped_column(String(8), primary_key=True)

    nombre_en: Mapped[str] = mapped_column(String(160), nullable=False)
    nombre_es: Mapped[str] = mapped_column(String(160), nullable=False)
    # Sin acentos ni mayúsculas: es la columna contra la que se busca.
    nombre_norm: Mapped[str] = mapped_column(String(160), nullable=False, index=True)

    body_part: Mapped[str] = mapped_column(String(40), nullable=False)
    body_part_es: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    equipment: Mapped[str] = mapped_column(String(40), nullable=False)
    equipment_es: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    target: Mapped[str] = mapped_column(String(40), nullable=False)
    target_es: Mapped[str] = mapped_column(String(40), nullable=False)

    secondary_muscles: Mapped[list[str]] = mapped_column(ARRAY(String(40)), default=list)
    instrucciones_es: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list)

    # Ruta o URL pública del GIF en Supabase Storage (bucket exercise-gifs).
    gif_path: Mapped[str] = mapped_column(String(255), nullable=False)
    atribucion: Mapped[str] = mapped_column(String(120), nullable=False)
