from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from api.auth import get_current_user
from api.database import get_db
from api.models import Meal, MealItem
from api.schemas import (
    AnalizarComidaRequest,
    AnalizarComidaResponse,
    ComidaOut,
    RegistrarComidaRequest,
)
from api.services import comida as servicio_comida

router = APIRouter(
    prefix="/api/food",
    tags=["comida"],
    dependencies=[Depends(get_current_user)],
)


@router.post("/analyze", response_model=AnalizarComidaResponse)
def analizar(body: AnalizarComidaRequest) -> AnalizarComidaResponse:
    if not body.texto and not body.imagen_base64:
        raise HTTPException(status_code=422, detail="Se requiere texto o imagen_base64")
    items = servicio_comida.analizar(texto=body.texto, imagen_base64=body.imagen_base64)
    return AnalizarComidaResponse(items=items)


@router.post("/log", response_model=ComidaOut)
def registrar(
    body: RegistrarComidaRequest,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Meal:
    comida = Meal(
        user_id=user_id,
        etiqueta=body.etiqueta,
        logged_at=datetime.now(timezone.utc),
    )
    comida.items = [
        MealItem(
            nombre=i.nombre,
            calorias=i.calorias,
            prot_g=i.prot_g,
            carbs_g=i.carbs_g,
            fat_g=i.fat_g,
        )
        for i in body.items
    ]
    db.add(comida)
    db.commit()
    db.refresh(comida)
    return comida


@router.get("", response_model=list[ComidaOut])
def historial(
    desde: datetime,
    hasta: datetime,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Meal]:
    comidas = (
        db.execute(
            select(Meal)
            .where(
                Meal.user_id == user_id,
                Meal.logged_at >= desde,
                Meal.logged_at < hasta,
            )
            .order_by(Meal.logged_at.desc())
        )
        .scalars()
        .all()
    )
    return list(comidas)


@router.patch("/{comida_id}", response_model=ComidaOut)
def editar(
    comida_id: int,
    body: RegistrarComidaRequest,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Meal:
    comida = db.get(Meal, comida_id)
    if comida is None or comida.user_id != user_id:
        raise HTTPException(status_code=404, detail="Comida no encontrada")
    comida.etiqueta = body.etiqueta
    comida.items = [
        MealItem(
            nombre=i.nombre,
            calorias=i.calorias,
            prot_g=i.prot_g,
            carbs_g=i.carbs_g,
            fat_g=i.fat_g,
        )
        for i in body.items
    ]
    db.commit()
    db.refresh(comida)
    return comida
