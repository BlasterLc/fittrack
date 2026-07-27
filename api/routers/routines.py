from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from api.auth import get_current_user
from api.database import get_db
from api.schemas import (
    ArchivarRutinaRequest,
    GuardarRutinaRequest,
    RutinaDetalle,
    RutinaEnLista,
)
from api.services import routines as servicio

router = APIRouter(
    prefix="/api/routines",
    tags=["rutinas"],
    dependencies=[Depends(get_current_user)],
)

NO_ENCONTRADA = "Rutina no encontrada"


def _traducir(error: Exception) -> HTTPException:
    """422 si el cliente mandó algo inválido, 404 si pidió algo que no existe."""
    if isinstance(error, servicio.EjercicioDesconocido):
        return HTTPException(status_code=404, detail=str(error))
    return HTTPException(status_code=422, detail=str(error))


@router.get("", response_model=list[RutinaEnLista])
def listar(
    archivadas: bool = False,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    return servicio.listar(db, user_id, archivadas=archivadas)


@router.post("", response_model=RutinaDetalle, status_code=status.HTTP_201_CREATED)
def crear(
    body: GuardarRutinaRequest,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    try:
        rutina = servicio.crear(db, user_id, body.nombre, body.catalog_ids)
    except (servicio.RutinaInvalida, servicio.EjercicioDesconocido) as error:
        raise _traducir(error) from error
    return servicio.detalle(db, user_id, rutina.id)


@router.get("/{rutina_id}", response_model=RutinaDetalle)
def detalle(
    rutina_id: int,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    encontrada = servicio.detalle(db, user_id, rutina_id)
    if encontrada is None:
        raise HTTPException(status_code=404, detail=NO_ENCONTRADA)
    return encontrada


@router.put("/{rutina_id}", response_model=RutinaDetalle)
def reemplazar(
    rutina_id: int,
    body: GuardarRutinaRequest,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    try:
        rutina = servicio.reemplazar(
            db, user_id, rutina_id, body.nombre, body.catalog_ids
        )
    except (servicio.RutinaInvalida, servicio.EjercicioDesconocido) as error:
        raise _traducir(error) from error
    if rutina is None:
        raise HTTPException(status_code=404, detail=NO_ENCONTRADA)
    return servicio.detalle(db, user_id, rutina_id)


@router.patch("/{rutina_id}", response_model=RutinaDetalle)
def archivar(
    rutina_id: int,
    body: ArchivarRutinaRequest,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    rutina = servicio.archivar(db, user_id, rutina_id, archivada=body.archivada)
    if rutina is None:
        raise HTTPException(status_code=404, detail=NO_ENCONTRADA)
    return servicio.detalle(db, user_id, rutina_id)
