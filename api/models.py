from datetime import datetime

from sqlalchemy import (
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
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
    secondary_muscles_es: Mapped[list[str]] = mapped_column(ARRAY(String(40)), default=list)
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


class Routine(Base):
    """Una rutina: lista ordenada de ejercicios del catálogo, con nombre.

    Aislada por user_id (= auth.users.id, sin FK), igual que Meal.
    """

    __tablename__ = "routines"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    nombre: Mapped[str] = mapped_column(String(80), nullable=False)
    # Se archiva, nunca se elimina: así el historial de entrenamientos de la
    # Fase 6 no puede quedar huérfano.
    archived_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    ejercicios: Mapped[list["RoutineExercise"]] = relationship(
        back_populates="rutina",
        cascade="all, delete-orphan",
        order_by="RoutineExercise.orden",
    )


class RoutineExercise(Base):
    """Un ejercicio dentro de una rutina, en una posición."""

    __tablename__ = "routine_exercises"
    __table_args__ = (
        # Un ejercicio, una sola vez por rutina. Es lo que permite que el
        # catálogo use checks en vez de botones que suman de a uno.
        UniqueConstraint("routine_id", "catalog_id", name="uq_rutina_ejercicio"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    routine_id: Mapped[int] = mapped_column(
        ForeignKey("routines.id", ondelete="CASCADE"), nullable=False
    )
    # Sin ForeignKey a propósito: la ingesta del catálogo converge borrando lo
    # que sobra. Con RESTRICT fallaría la ingesta; con CASCADE vaciaría rutinas
    # en silencio. Se valida en el servicio. El índice queda puesto para la
    # Fase 7, donde se consulta la progresión de un ejercicio a través de las
    # rutinas.
    catalog_id: Mapped[str] = mapped_column(String(8), nullable=False, index=True)
    orden: Mapped[int] = mapped_column(Integer, nullable=False)

    # Se crean ahora aunque 5b no las use: las llena la Fase 6 al terminar el
    # primer entrenamiento, y así no hay que tocar el esquema de producción.
    sets_default: Mapped[int | None] = mapped_column(Integer, nullable=True)
    reps_default: Mapped[int | None] = mapped_column(Integer, nullable=True)
    weight_default: Mapped[float | None] = mapped_column(Float, nullable=True)

    rutina: Mapped["Routine"] = relationship(back_populates="ejercicios")
