import datetime as dt

import pytest

from api.models import Profile

USUARIO = "11111111-1111-1111-1111-111111111111"
OTRO_USUARIO = "22222222-2222-2222-2222-222222222222"


def test_un_perfil_guarda_los_datos_de_su_usuario(db_session):
    perfil = Profile(
        user_id=USUARIO,
        nombre="Matías",
        sexo="hombre",
        fecha_nacimiento=dt.date(1998, 3, 14),
        altura_cm=176,
        peso_kg=78.0,
        actividad="moderado",
        objetivo="ganar",
    )
    db_session.add(perfil)
    db_session.commit()

    guardado = db_session.get(Profile, USUARIO)
    assert guardado.nombre == "Matías"
    assert guardado.altura_cm == 176
    assert guardado.peso_kg == 78.0
    # Las metas manuales arrancan vacías: se usan las calculadas.
    assert guardado.meta_calorias is None


def test_un_perfil_puede_estar_a_medias(db_session):
    """La app funciona con el perfil incompleto, así que casi todo es nulo."""
    perfil = Profile(user_id=USUARIO, nombre="Matías")
    db_session.add(perfil)
    db_session.commit()

    guardado = db_session.get(Profile, USUARIO)
    assert guardado.sexo is None
    assert guardado.peso_kg is None
