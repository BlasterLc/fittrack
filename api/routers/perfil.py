from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from api.auth import get_current_user
from api.database import get_db
from api.schemas import GuardarPerfilRequest, MetasOut, PerfilOut
from api.services import perfil as servicio

router = APIRouter(
    prefix="/api/profile",
    tags=["perfil"],
    dependencies=[Depends(get_current_user)],
)


def _armar_respuesta(resuelto: servicio.PerfilResuelto) -> PerfilOut:
    """Traduce el resultado del servicio a la forma que consume la app."""
    perfil = resuelto.perfil
    metas = (
        MetasOut(
            calorias=resuelto.metas.calorias,
            prot_g=resuelto.metas.prot_g,
            carb_g=resuelto.metas.carb_g,
            fat_g=resuelto.metas.fat_g,
        )
        if resuelto.metas
        else None
    )

    return PerfilOut(
        nombre=perfil.nombre if perfil else None,
        sexo=perfil.sexo if perfil else None,
        fecha_nacimiento=perfil.fecha_nacimiento if perfil else None,
        altura_cm=perfil.altura_cm if perfil else None,
        peso_kg=perfil.peso_kg if perfil else None,
        actividad=perfil.actividad if perfil else None,
        objetivo=perfil.objetivo if perfil else None,
        completo=resuelto.completo,
        metas_son_manuales=resuelto.son_manuales,
        metas=metas,
        # El cero solo aparece en un caso: metas escritas a mano sobre un
        # perfil al que le faltan datos, así que no hay mantenimiento que
        # calcular. Ahí la pantalla no debe mostrar "0 kcal", debe no mostrar
        # nada, y por eso viaja como null.
        mantenimiento=(
            resuelto.metas.mantenimiento
            if resuelto.metas and resuelto.metas.mantenimiento
            else None
        ),
    )


@router.get("", response_model=PerfilOut)
def traer(
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PerfilOut:
    return _armar_respuesta(servicio.resolver(db, user_id))


@router.put("", response_model=PerfilOut)
def guardar(
    body: GuardarPerfilRequest,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PerfilOut:
    datos = body.model_dump()
    try:
        servicio.guardar(db, user_id, datos)
    except servicio.PerfilInvalido as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    return _armar_respuesta(servicio.resolver(db, user_id))
