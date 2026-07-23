from pydantic import BaseModel


class EjercicioResumen(BaseModel):
    """Fila de la lista de resultados. No incluye instrucciones."""

    id: str
    nombre_es: str
    body_part_es: str
    equipment_es: str
    target_es: str
    gif_path: str

    model_config = {"from_attributes": True}


class EjercicioFicha(EjercicioResumen):
    """Ficha completa, con técnica y músculos secundarios."""

    secondary_muscles: list[str]
    instrucciones_es: list[str]
    atribucion: str


class ResultadoBusqueda(BaseModel):
    total: int
    resultados: list[EjercicioResumen]
