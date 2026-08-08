from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from api.auth import get_current_user
from api.database import get_db
from api.schemas import DiaEntrenado, ResumenExportable, SeriesDeGrupo, SesionDeProgresion
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


@router.get("/exercise/{catalog_id}", response_model=list[SesionDeProgresion])
def progresion_ejercicio(
    catalog_id: str,
    limite: int = Query(default=12, ge=1, le=100),
    hasta: datetime | None = None,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    """El peso máximo levantado por sesión, para el gráfico de progresión."""
    return servicio.progresion_ejercicio(db, user_id, catalog_id, limite, hasta)


@router.get("/export", response_model=ResumenExportable)
def exportar(
    desde: datetime,
    hasta: datetime,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """El resumen completo de la ventana, para exportar a PDF."""
    try:
        return servicio.resumen_exportable(db, user_id, desde, hasta)
    except servicio.VentanaInvalida as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)
        ) from error
