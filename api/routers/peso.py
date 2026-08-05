from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from api.auth import get_current_user
from api.database import get_db
from api.models import WeightEntry
from api.schemas import CrearRegistroPesoRequest, RegistroPeso
from api.services import peso as servicio

router = APIRouter(
    prefix="/api/weight",
    tags=["peso"],
    dependencies=[Depends(get_current_user)],
)


@router.post("", response_model=RegistroPeso, status_code=status.HTTP_201_CREATED)
def crear(
    body: CrearRegistroPesoRequest,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WeightEntry:
    try:
        return servicio.crear(db, user_id, body.kg)
    except servicio.PesoInvalido as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.get("", response_model=list[RegistroPeso])
def listar(
    limite: int = Query(default=12, ge=1, le=100),
    hasta: datetime | None = None,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[WeightEntry]:
    return servicio.listar(db, user_id, limite, hasta)


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def borrar(
    entry_id: int,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    if not servicio.borrar(db, user_id, entry_id):
        raise HTTPException(status_code=404, detail="Registro de peso no encontrado")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
