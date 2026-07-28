import datetime as dt

import pytest

from api.models import Profile
from api.services import perfil as servicio

USUARIO = "11111111-1111-1111-1111-111111111111"
OTRO_USUARIO = "22222222-2222-2222-2222-222222222222"

DATOS_COMPLETOS = {
    "nombre": "Matías",
    "sexo": "hombre",
    "fecha_nacimiento": dt.date(1998, 3, 14),
    "altura_cm": 176,
    "peso_kg": 78.0,
    "actividad": "moderado",
    "objetivo": "ganar",
}


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


def test_guardar_crea_el_perfil_si_no_existe(db_session):
    guardado = servicio.guardar(db_session, USUARIO, DATOS_COMPLETOS)

    assert guardado.user_id == USUARIO
    assert guardado.nombre == "Matías"
    assert db_session.get(Profile, USUARIO) is not None


def test_guardar_converge_y_borra_lo_que_no_llega(db_session):
    """El cuerpo describe el estado final, igual que el PUT de rutinas."""
    servicio.guardar(db_session, USUARIO, DATOS_COMPLETOS)

    servicio.guardar(db_session, USUARIO, {**DATOS_COMPLETOS, "peso_kg": None})

    assert db_session.get(Profile, USUARIO).peso_kg is None


def test_resolver_devuelve_las_metas_calculadas(db_session):
    servicio.guardar(db_session, USUARIO, DATOS_COMPLETOS)

    resuelto = servicio.resolver(db_session, USUARIO, hoy=dt.date(2026, 7, 27))

    assert resuelto.completo is True
    assert resuelto.son_manuales is False
    assert resuelto.metas.calorias == 2980


def test_resolver_sin_perfil_no_explota(db_session):
    resuelto = servicio.resolver(db_session, USUARIO)

    assert resuelto.completo is False
    assert resuelto.metas is None
    assert resuelto.perfil is None


def test_un_perfil_incompleto_no_tiene_metas(db_session):
    servicio.guardar(db_session, USUARIO, {**DATOS_COMPLETOS, "actividad": None})

    resuelto = servicio.resolver(db_session, USUARIO)

    assert resuelto.completo is False
    assert resuelto.metas is None


def test_las_metas_manuales_mandan_sobre_el_calculo(db_session):
    servicio.guardar(
        db_session,
        USUARIO,
        {
            **DATOS_COMPLETOS,
            "metas_manuales": {"calorias": 2500, "prot_g": 150, "carb_g": 300, "fat_g": 70},
        },
    )

    resuelto = servicio.resolver(db_session, USUARIO, hoy=dt.date(2026, 7, 27))

    assert resuelto.son_manuales is True
    assert resuelto.metas.calorias == 2500
    assert resuelto.metas.prot_g == 150


def test_cambiar_el_peso_no_pisa_las_metas_manuales(db_session):
    """Nada se recalcula solo: una decisión explícita del usuario se respeta."""
    servicio.guardar(
        db_session,
        USUARIO,
        {
            **DATOS_COMPLETOS,
            "metas_manuales": {"calorias": 2500, "prot_g": 150, "carb_g": 300, "fat_g": 70},
        },
    )

    perfil_guardado = db_session.get(Profile, USUARIO)
    servicio.guardar(
        db_session,
        USUARIO,
        {
            **DATOS_COMPLETOS,
            "peso_kg": 82.0,
            "metas_manuales": {
                "calorias": perfil_guardado.meta_calorias,
                "prot_g": perfil_guardado.meta_prot_g,
                "carb_g": perfil_guardado.meta_carb_g,
                "fat_g": perfil_guardado.meta_fat_g,
            },
        },
    )

    resuelto = servicio.resolver(db_session, USUARIO)
    assert resuelto.metas.calorias == 2500


def test_guardar_con_metas_en_none_vuelve_al_calculo(db_session):
    servicio.guardar(
        db_session,
        USUARIO,
        {
            **DATOS_COMPLETOS,
            "metas_manuales": {"calorias": 2500, "prot_g": 150, "carb_g": 300, "fat_g": 70},
        },
    )

    servicio.guardar(db_session, USUARIO, {**DATOS_COMPLETOS, "metas_manuales": None})

    resuelto = servicio.resolver(db_session, USUARIO, hoy=dt.date(2026, 7, 27))
    assert resuelto.son_manuales is False
    assert resuelto.metas.calorias == 2980


def test_el_perfil_de_otro_usuario_no_se_ve(db_session):
    servicio.guardar(db_session, OTRO_USUARIO, DATOS_COMPLETOS)

    assert servicio.resolver(db_session, USUARIO).perfil is None


@pytest.mark.parametrize(
    "campo, valor",
    [
        ("altura_cm", 99),
        ("altura_cm", 251),
        ("peso_kg", 29.0),
        ("peso_kg", 301.0),
        ("sexo", "otro"),
        ("actividad", "altisimo"),
        ("objetivo", "engordar"),
        ("nombre", "N" * 61),
    ],
)
def test_guardar_rechaza_datos_invalidos(db_session, campo, valor):
    with pytest.raises(servicio.PerfilInvalido):
        servicio.guardar(db_session, USUARIO, {**DATOS_COMPLETOS, campo: valor})


def test_guardar_rechaza_una_fecha_de_nacimiento_futura(db_session):
    manana = dt.date.today() + dt.timedelta(days=1)

    with pytest.raises(servicio.PerfilInvalido):
        servicio.guardar(db_session, USUARIO, {**DATOS_COMPLETOS, "fecha_nacimiento": manana})


def test_guardar_rechaza_una_edad_fuera_de_rango(db_session):
    """La fórmula no es válida en niños."""
    hace_diez_años = dt.date.today() - dt.timedelta(days=365 * 10)

    with pytest.raises(servicio.PerfilInvalido):
        servicio.guardar(
            db_session, USUARIO, {**DATOS_COMPLETOS, "fecha_nacimiento": hace_diez_años}
        )


def test_guardar_rechaza_metas_manuales_incompletas(db_session):
    """Van las cuatro juntas o ninguna."""
    with pytest.raises(servicio.PerfilInvalido):
        servicio.guardar(
            db_session,
            USUARIO,
            {**DATOS_COMPLETOS, "metas_manuales": {"calorias": 2500, "prot_g": 150}},
        )
