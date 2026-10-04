from datetime import datetime, timedelta, timezone

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
from api.services import ratelimit

VENTANA_DIAS_LOGGED_AT = 7


def _resolver_logged_at(logged_at: datetime | None, actual: datetime) -> datetime:
    """`actual` es el valor a mantener si el cliente no manda logged_at:
    "ahora" al crear, el valor ya guardado al editar."""
    if logged_at is None:
        return actual
    ahora = datetime.now(timezone.utc)
    if logged_at.tzinfo is None:
        logged_at = logged_at.replace(tzinfo=timezone.utc)
    if logged_at > ahora:
        raise HTTPException(status_code=422, detail="La fecha no puede ser futura.")
    # +1 día de margen: el picker del cliente trabaja en granularidad de día
    # completo, así que el día más viejo que ofrece puede caer levemente
    # antes de "ahora - 7 días" exactos. El mensaje y el picker siguen
    # hablando de 7 días; este margen es solo para no rechazar un uso normal.
    if logged_at < ahora - timedelta(days=VENTANA_DIAS_LOGGED_AT + 1):
        raise HTTPException(
            status_code=422,
            detail=f"La fecha no puede tener más de {VENTANA_DIAS_LOGGED_AT} días.",
        )
    return logged_at


router = APIRouter(
    prefix="/api/food",
    tags=["comida"],
    dependencies=[Depends(get_current_user)],
)


@router.post("/analyze", response_model=AnalizarComidaResponse)
def analizar(
    body: AnalizarComidaRequest, user_id: str = Depends(get_current_user)
) -> AnalizarComidaResponse:
    if not body.texto and not body.imagen_base64:
        raise HTTPException(status_code=422, detail="Se requiere texto o imagen_base64")
    ratelimit.verificar(user_id)
    analisis = servicio_comida.analizar(texto=body.texto, imagen_base64=body.imagen_base64)
    return AnalizarComidaResponse(items=analisis.items, etiqueta=analisis.etiqueta)


@router.post("/log", response_model=ComidaOut)
def registrar(
    body: RegistrarComidaRequest,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Meal:
    comida = Meal(
        user_id=user_id,
        etiqueta=body.etiqueta,
        logged_at=_resolver_logged_at(body.logged_at, datetime.now(timezone.utc)),
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


@router.delete("/{comida_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar(
    comida_id: int,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    comida = db.get(Meal, comida_id)
    if comida is None or comida.user_id != user_id:
        raise HTTPException(status_code=404, detail="Comida no encontrada")
    db.delete(comida)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


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
    comida.logged_at = _resolver_logged_at(body.logged_at, comida.logged_at)
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
