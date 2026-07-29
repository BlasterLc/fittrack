from datetime import date, datetime

from pydantic import BaseModel, Field, computed_field

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


class EjercicioDeRutina(EjercicioResumen):
    """Ficha del catálogo más lo que hiciste la última vez en esta rutina.

    Los tres son nulos hasta el primer entrenamiento del ejercicio: ahí es
    cuando la Fase 6 los escribe.
    """

    sets_default: int | None = None
    reps_default: int | None = None
    weight_default: float | None = None


class ResultadoBusqueda(BaseModel):
    total: int
    resultados: list[EjercicioResumen]


class FiltrosDisponibles(BaseModel):
    """Valores que la app ofrece en los controles de filtro del catálogo.

    Las listas completas son los chips que se dibujan; las `_disponibles`
    son los que siguen dando resultados con los filtros ya activos. El
    resto se atenúa en vez de desaparecer, para que la fila no salte.
    """

    grupos_musculares: list[str]
    equipamientos: list[str]
    grupos_disponibles: list[str]
    equipamientos_disponibles: list[str]


class Calorias(BaseModel):
    consumidas: int
    meta: int


class Macros(BaseModel):
    prot: float
    carb: float
    fat: float


class MetasMacros(BaseModel):
    prot: int
    carb: int
    fat: int


class EntrenamientoResumen(BaseModel):
    series: int
    duracion_min: int


class PesoResumen(BaseModel):
    kg: float
    fecha: str


class ResumenDia(BaseModel):
    calorias: Calorias
    macros: Macros
    # Null si el perfil está incompleto: ahí los macros quedan informativos,
    # como antes de que existieran las metas propias.
    metas_macros: MetasMacros | None
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


class RutinaEnLista(BaseModel):
    """Una fila de la lista de rutinas."""

    id: int
    nombre: str
    archived_at: datetime | None
    total_ejercicios: int
    grupos_musculares: list[str]


class RutinaDetalle(BaseModel):
    """La rutina abierta en el editor, con las fichas del catálogo."""

    id: int
    nombre: str
    archived_at: datetime | None
    ejercicios: list[EjercicioDeRutina]
    # Cuántos apuntaban a fichas que la ingesta ya borró. El editor lo avisa.
    ejercicios_faltantes: int


class GuardarRutinaRequest(BaseModel):
    nombre: str
    catalog_ids: list[str]


class ArchivarRutinaRequest(BaseModel):
    archivada: bool


class MetasOut(BaseModel):
    calorias: int
    prot_g: int
    carb_g: int
    fat_g: int


class PerfilOut(BaseModel):
    """El perfil tal como lo consume la app."""

    nombre: str | None
    sexo: str | None
    fecha_nacimiento: date | None
    altura_cm: int | None
    peso_kg: float | None
    actividad: str | None
    objetivo: str | None
    # Si están los seis datos que necesita el cálculo.
    completo: bool
    # Si los números de `metas` fueron escritos a mano. Se llama distinto que
    # el campo del PUT a propósito: allá es el objeto con los números.
    metas_son_manuales: bool
    metas: MetasOut | None
    mantenimiento: int | None


class PrevisualizacionOut(BaseModel):
    """Las metas de una ficha que todavía no se guardó."""

    completo: bool
    metas: MetasOut | None
    mantenimiento: int | None


class MetasManualesIn(BaseModel):
    calorias: int
    prot_g: int
    carb_g: int
    fat_g: int


class GuardarPerfilRequest(BaseModel):
    """Describe el estado final del perfil: lo que no llega, se borra."""

    nombre: str | None = None
    sexo: str | None = None
    fecha_nacimiento: date | None = None
    altura_cm: int | None = None
    peso_kg: float | None = None
    actividad: str | None = None
    objetivo: str | None = None
    # En null borra las metas escritas a mano y vuelve al cálculo automático.
    metas_manuales: MetasManualesIn | None = None


class SerieRequest(BaseModel):
    orden: int
    reps: int = Field(ge=1, le=30)
    weight_kg: float = Field(ge=0, le=200)
    completed_at: datetime


class EjercicioSesionRequest(BaseModel):
    catalog_id: str
    orden: int
    series: list[SerieRequest] = Field(min_length=1)


class GuardarEntrenamientoRequest(BaseModel):
    client_id: str
    routine_id: int | None = None
    started_at: datetime
    ended_at: datetime
    ejercicios: list[EjercicioSesionRequest] = Field(min_length=1)
    # catalog_id de los ejercicios agregados sobre la marcha que el usuario
    # confirmó sumar a la rutina.
    agregar_a_rutina: list[str] = Field(default_factory=list)


class SerieGuardada(BaseModel):
    orden: int
    reps: int
    weight_kg: float


class EjercicioGuardado(BaseModel):
    catalog_id: str
    nombre_es: str
    series: list[SerieGuardada]


class EntrenamientoGuardado(BaseModel):
    id: int
    duracion_min: int
    total_series: int
    total_ejercicios: int
    ejercicios: list[EjercicioGuardado]
    # catalog_id que ya no existen en el catálogo. Se guarda el resto y la app
    # avisa cuáles quedaron fuera, en vez de perder el entrenamiento entero.
    omitidos: list[str]
