from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from api.auth import get_current_user
from api.database import get_db
from api.models import CatalogExercise
from api.schemas import EjercicioFicha, ResultadoBusqueda
from api.services import catalog

router = APIRouter(
    prefix="/api/catalog",
    tags=["catalogo"],
    dependencies=[Depends(get_current_user)],
)


@router.get("/search", response_model=ResultadoBusqueda)
def buscar(
    q: str | None = None,
    body_part: str | None = None,
    equipment: str | None = None,
    db: Session = Depends(get_db),
) -> ResultadoBusqueda:
    encontrados = catalog.buscar(db, q=q, body_part=body_part, equipment=equipment)
    return ResultadoBusqueda(total=len(encontrados), resultados=encontrados)


@router.get("/{ejercicio_id}", response_model=EjercicioFicha)
def ficha(ejercicio_id: str, db: Session = Depends(get_db)) -> CatalogExercise:
    ejercicio = db.get(CatalogExercise, ejercicio_id)
    if ejercicio is None:
        raise HTTPException(status_code=404, detail="Ejercicio no encontrado")
    return ejercicio
