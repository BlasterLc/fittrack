from fastapi import APIRouter, Depends

from api.auth import get_current_user
from api.config import Config
from api.schemas import Calorias, Macros, ResumenDia

router = APIRouter(
    prefix="/api",
    tags=["dashboard"],
    dependencies=[Depends(get_current_user)],
)


@router.get("/dashboard", response_model=ResumenDia)
def resumen_del_dia() -> ResumenDia:
    """Resumen del día. En la Fase 3 devuelve la forma final vacía:
    la meta de calorías desde Config y el resto en cero/null. Las fases
    4-7 conectan las fuentes reales (comida, entrenamientos, peso) sin
    cambiar este contrato."""
    return ResumenDia(
        calorias=Calorias(consumidas=0, meta=Config().calorie_goal),
        macros=Macros(prot=0, carb=0, fat=0),
        entrenamiento=None,
        peso=None,
    )
