from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

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


class Meal(Base):
    """Una comida registrada. Aislada por user_id (= auth.users.id, sin FK)."""

    __tablename__ = "meals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    etiqueta: Mapped[str | None] = mapped_column(String(40), nullable=True)
    logged_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    items: Mapped[list["MealItem"]] = relationship(
        back_populates="meal", cascade="all, delete-orphan"
    )


class MealItem(Base):
    """Un ítem de una comida, con sus macros. Hereda la pertenencia de su Meal."""

    __tablename__ = "meal_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    meal_id: Mapped[int] = mapped_column(
        ForeignKey("meals.id", ondelete="CASCADE"), nullable=False
    )
    nombre: Mapped[str] = mapped_column(String(160), nullable=False)
    calorias: Mapped[int] = mapped_column(Integer, nullable=False)
    prot_g: Mapped[float] = mapped_column(Float, nullable=False)
    carbs_g: Mapped[float] = mapped_column(Float, nullable=False)
    fat_g: Mapped[float] = mapped_column(Float, nullable=False)

    meal: Mapped["Meal"] = relationship(back_populates="items")
