from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from api.auth import get_current_user
from api.database import get_db
from api.schemas import DiaEntrenado, SeriesDeGrupo
from api.services import progreso as servicio

router = APIRouter(
    prefix="/api/progress",
    tags=["progreso"],
    dependencies=[Depends(get_current_user)],
)


@router.get("/heatmap", response_model=list[DiaEntrenado])
def heatmap(
    desde: datetime,
    hasta: datetime,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    """Los entrenamientos de la ventana, para el mapa de asistencia."""
    try:
        return servicio.mapa(db, user_id, desde, hasta)
    except servicio.VentanaInvalida as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)
        ) from error


@router.get("/sets-by-muscle", response_model=list[SeriesDeGrupo])
def series_por_grupo(
    desde: datetime,
    hasta: datetime,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    """Series por grupo muscular en la ventana pedida."""
    try:
        return servicio.series_por_grupo(db, user_id, desde, hasta)
    except servicio.VentanaInvalida as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)
        ) from error
