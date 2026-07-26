from datetime import datetime

from pydantic import BaseModel, computed_field

from api.services import storage


class EjercicioResumen(BaseModel):
    """Fila de la lista de resultados. No incluye instrucciones."""

    id: str
    nombre_es: str
    body_part_es: str
    equipment_es: str
    target_es: str
    gif_path: str

    model_config = {"from_attributes": True}

    @computed_field
    @property
    def gif_url(self) -> str:
        """URL lista para el componente de imagen de la app."""
        return storage.url_publica(self.gif_path)


class EjercicioFicha(EjercicioResumen):
    """Ficha completa, con técnica y músculos secundarios."""

    secondary_muscles_es: list[str]
    instrucciones_es: list[str]
    atribucion: str


class ResultadoBusqueda(BaseModel):
    total: int
    resultados: list[EjercicioResumen]


class FiltrosDisponibles(BaseModel):
    """Valores que la app ofrece en los controles de filtro del catálogo."""

    grupos_musculares: list[str]
    equipamientos: list[str]


class Calorias(BaseModel):
    consumidas: int
    meta: int


class Macros(BaseModel):
    prot: float
    carb: float
    fat: float


class EntrenamientoResumen(BaseModel):
    series: int
    duracion_min: int


class PesoResumen(BaseModel):
    kg: float
    fecha: str


class ResumenDia(BaseModel):
    calorias: Calorias
    macros: Macros
    entrenamiento: EntrenamientoResumen | None
    peso: PesoResumen | None


class ItemComida(BaseModel):
    nombre: str
    calorias: int
    prot_g: float
    carbs_g: float
    fat_g: float


class AnalizarComidaRequest(BaseModel):
    texto: str | None = None
    imagen_base64: str | None = None


class AnalizarComidaResponse(BaseModel):
    items: list[ItemComida]


class RegistrarComidaRequest(BaseModel):
    items: list[ItemComida]
    etiqueta: str | None = None


class ItemComidaOut(ItemComida):
    id: int
    model_config = {"from_attributes": True}


class ComidaOut(BaseModel):
    id: int
    etiqueta: str | None
    logged_at: datetime
    items: list[ItemComidaOut]
    model_config = {"from_attributes": True}
