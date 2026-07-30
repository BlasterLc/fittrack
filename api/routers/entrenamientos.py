from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from api.auth import get_current_user
from api.database import get_db
from api.schemas import (
    EntrenamientoDeHistorial,
    EntrenamientoGuardado,
    GuardarEntrenamientoRequest,
)
from api.services import entrenamientos as servicio

router = APIRouter(
    prefix="/api/workouts",
    tags=["entrenamientos"],
    dependencies=[Depends(get_current_user)],
)


@router.post("", response_model=EntrenamientoGuardado, status_code=status.HTTP_201_CREATED)
def guardar(
    body: GuardarEntrenamientoRequest,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    try:
        return servicio.guardar(db, user_id, body.model_dump())
    except servicio.EntrenamientoInvalido as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.get("", response_model=list[EntrenamientoDeHistorial])
def listar(
    hasta: datetime | None = None,
    limite: int = Query(default=20, ge=1, le=servicio.LIMITE_MAXIMO),
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    """Historial de entrenamientos, del más nuevo al más viejo.

    `hasta` pagina hacia atrás: se manda el `started_at` del último recibido.
    """
    return servicio.historial(db, user_id, hasta, limite)
