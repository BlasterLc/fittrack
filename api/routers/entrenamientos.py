from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from api.auth import get_current_user
from api.database import get_db
from api.schemas import EntrenamientoGuardado, GuardarEntrenamientoRequest
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
