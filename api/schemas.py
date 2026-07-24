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

    secondary_muscles: list[str]
    instrucciones_es: list[str]
    atribucion: str


class ResultadoBusqueda(BaseModel):
    total: int
    resultados: list[EjercicioResumen]
