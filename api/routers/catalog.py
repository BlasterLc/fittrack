from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from api.auth import get_current_user
from api.database import get_db
from api.models import CatalogExercise
from api.schemas import EjercicioFicha, FiltrosDisponibles, ResultadoBusqueda
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
    limite: int = Query(catalog.LIMITE_POR_DEFECTO, ge=1, le=catalog.LIMITE_MAXIMO),
    desplazamiento: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> ResultadoBusqueda:
    encontrados = catalog.buscar(
        db,
        q=q,
        body_part=body_part,
        equipment=equipment,
        limite=limite,
        desplazamiento=desplazamiento,
    )
    total = catalog.contar(db, q=q, body_part=body_part, equipment=equipment)
    return ResultadoBusqueda(total=total, resultados=encontrados)


# Debe quedar declarada ANTES de /{ejercicio_id}: si no, FastAPI la toma
# como una ficha con id "filtros" y responde 404.
@router.get("/filtros", response_model=FiltrosDisponibles)
def filtros_disponibles(db: Session = Depends(get_db)) -> FiltrosDisponibles:
    return FiltrosDisponibles(**catalog.filtros(db))


@router.get("/{ejercicio_id}", response_model=EjercicioFicha)
def ficha(ejercicio_id: str, db: Session = Depends(get_db)) -> CatalogExercise:
    ejercicio = db.get(CatalogExercise, ejercicio_id)
    if ejercicio is None:
        raise HTTPException(status_code=404, detail="Ejercicio no encontrado")
    return ejercicio
