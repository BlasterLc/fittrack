from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from api.auth import get_current_user
from api.config import Config
from api.database import get_db
from api.models import Meal, MealItem
from api.schemas import Calorias, Macros, MetasMacros, PesoResumen, ResumenDia, RutinaResumen
from api.services import entrenamientos as servicio_entrenamientos
from api.services import perfil as servicio_perfil
from api.services import peso as servicio_peso

router = APIRouter(
    prefix="/api",
    tags=["dashboard"],
    dependencies=[Depends(get_current_user)],
)


@router.get("/dashboard", response_model=ResumenDia)
def resumen_del_dia(
    desde: datetime | None = None,
    hasta: datetime | None = None,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ResumenDia:
    """Resumen del día del usuario: comidas y entrenamiento de la ventana pedida.

    La ventana la manda el teléfono, igual que en `/api/food`, porque el día
    del usuario empieza a su medianoche y no a la de UTC. Cortando en UTC,
    alguien en Chile (-04) veía todo lo hecho después de las 20:00 contado
    para el día siguiente, y en desacuerdo con el historial de comidas, que
    siempre agrupó por día local.

    Ambos parámetros son opcionales y por separado se ignoran: hace falta el
    par para definir una ventana. Sin ellos se cae al día UTC, que es lo que
    hacía antes, para que una versión vieja de la app siga funcionando
    mientras se actualiza.
    """
    if desde is not None and hasta is not None:
        inicio, fin = desde, hasta
    else:
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

    ultimo_peso = servicio_peso.mas_reciente(db, user_id)
    ultima_rutina = servicio_entrenamientos.ultima_rutina_activa(db, user_id)

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
        peso=(
            PesoResumen(kg=ultimo_peso.kg, fecha=ultimo_peso.recorded_at.isoformat())
            if ultimo_peso is not None
            else None
        ),
        ultima_rutina=(
            RutinaResumen(id=ultima_rutina.id, nombre=ultima_rutina.nombre)
            if ultima_rutina is not None
            else None
        ),
    )
