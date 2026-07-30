from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from api.auth import get_current_user
from api.config import Config
from api.database import get_db
from api.models import Meal, MealItem
from api.schemas import Calorias, Macros, MetasMacros, ResumenDia
from api.services import entrenamientos as servicio_entrenamientos
from api.services import perfil as servicio_perfil

router = APIRouter(
    prefix="/api",
    tags=["dashboard"],
    dependencies=[Depends(get_current_user)],
)


@router.get("/dashboard", response_model=ResumenDia)
def resumen_del_dia(
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ResumenDia:
    """Resumen del día del usuario. Suma las comidas de hoy y el entrenamiento
    de hoy; peso sigue en null hasta su fase."""
    ahora = datetime.now(timezone.utc)
    inicio = ahora.replace(hour=0, minute=0, second=0, microsecond=0)
    fin = inicio + timedelta(days=1)

    filas = db.execute(
        select(MealItem.calorias, MealItem.prot_g, MealItem.carbs_g, MealItem.fat_g)
        .join(Meal, MealItem.meal_id == Meal.id)
        .where(
            Meal.user_id == user_id,
            Meal.logged_at >= inicio,
            Meal.logged_at < fin,
        )
    ).all()

    resuelto = servicio_perfil.resolver(db, user_id)
    # Sin perfil completo se usa la constante global, que es como funcionaba
    # antes: nadie queda peor que antes de tener metas propias.
    meta_calorias = resuelto.metas.calorias if resuelto.metas else Config().calorie_goal
    metas_macros = (
        MetasMacros(
            prot=resuelto.metas.prot_g,
            carb=resuelto.metas.carb_g,
            fat=resuelto.metas.fat_g,
        )
        if resuelto.metas
        else None
    )

    return ResumenDia(
        calorias=Calorias(
            consumidas=sum(f.calorias for f in filas),
            meta=meta_calorias,
        ),
        macros=Macros(
            prot=sum(f.prot_g for f in filas),
            carb=sum(f.carbs_g for f in filas),
            fat=sum(f.fat_g for f in filas),
        ),
        metas_macros=metas_macros,
        entrenamiento=servicio_entrenamientos.resumen_del_dia(db, user_id, inicio, fin),
        peso=None,
    )
