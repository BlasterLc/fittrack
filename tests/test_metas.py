import datetime as dt

import pytest

from api.services import metas


def test_el_ejemplo_del_spec_da_los_numeros_esperados():
    """Hombre 78 kg, 176 cm, 28 años, actividad moderada, ganar masa.

    Verificado a mano en el spec:
        basal         = 10x78 + 6,25x176 - 5x28 + 5 = 1745
        mantenimiento = 1745 x 1,55                 = 2705
        calorias      = 2705 x 1,10 redondeado a 10 = 2980
    """
    resultado = metas.calcular(
        sexo="hombre",
        fecha_nacimiento=dt.date(1998, 3, 14),
        altura_cm=176,
        peso_kg=78.0,
        actividad="moderado",
        objetivo="ganar",
        hoy=dt.date(2026, 7, 27),
    )

    assert resultado.mantenimiento == 2705
    assert resultado.calorias == 2980
    assert resultado.prot_g == 140
    assert resultado.fat_g == 83
    assert resultado.carb_g == 418


def test_las_calorias_siempre_terminan_en_cero():
    """Se redondea a multiplos de 10: la formula no tiene precision de unidad."""
    resultado = metas.calcular(
        sexo="mujer",
        fecha_nacimiento=dt.date(2000, 1, 1),
        altura_cm=163,
        peso_kg=59.0,
        actividad="poco",
        objetivo="mantener",
        hoy=dt.date(2026, 7, 27),
    )

    assert resultado.calorias % 10 == 0


def test_la_formula_distingue_hombre_de_mujer():
    comun = dict(
        fecha_nacimiento=dt.date(1998, 3, 14),
        altura_cm=176,
        peso_kg=78.0,
        actividad="moderado",
        objetivo="mantener",
        hoy=dt.date(2026, 7, 27),
    )

    hombre = metas.calcular(sexo="hombre", **comun)
    mujer = metas.calcular(sexo="mujer", **comun)

    # La constante de Mifflin-St Jeor son 166 kcal de diferencia en el basal.
    assert hombre.mantenimiento > mujer.mantenimiento


def test_mas_actividad_da_mas_calorias():
    comun = dict(
        sexo="hombre",
        fecha_nacimiento=dt.date(1998, 3, 14),
        altura_cm=176,
        peso_kg=78.0,
        objetivo="mantener",
        hoy=dt.date(2026, 7, 27),
    )

    poco = metas.calcular(actividad="poco", **comun)
    moderado = metas.calcular(actividad="moderado", **comun)
    alto = metas.calcular(actividad="alto", **comun)

    assert poco.calorias < moderado.calorias < alto.calorias


def test_el_objetivo_mueve_las_calorias_sobre_el_mantenimiento():
    comun = dict(
        sexo="hombre",
        fecha_nacimiento=dt.date(1998, 3, 14),
        altura_cm=176,
        peso_kg=78.0,
        actividad="moderado",
        hoy=dt.date(2026, 7, 27),
    )

    bajar = metas.calcular(objetivo="bajar", **comun)
    mantener = metas.calcular(objetivo="mantener", **comun)
    ganar = metas.calcular(objetivo="ganar", **comun)

    assert bajar.calorias < mantener.calorias < ganar.calorias
    # El deficit es mas agresivo que el superavit, a proposito.
    assert mantener.calorias - bajar.calorias > ganar.calorias - mantener.calorias


def test_bajar_de_peso_pide_mas_proteina_por_kilo():
    """En deficit la proteina protege la masa muscular."""
    comun = dict(
        sexo="hombre",
        fecha_nacimiento=dt.date(1998, 3, 14),
        altura_cm=176,
        peso_kg=78.0,
        actividad="moderado",
        hoy=dt.date(2026, 7, 27),
    )

    assert metas.calcular(objetivo="bajar", **comun).prot_g == 156  # 2,0 x 78
    assert metas.calcular(objetivo="ganar", **comun).prot_g == 140  # 1,8 x 78
    assert metas.calcular(objetivo="mantener", **comun).prot_g == 125  # 1,6 x 78


def test_los_macros_suman_las_calorias_de_la_meta():
    """Se derivan en cascada, asi que no pueden contradecir el total."""
    resultado = metas.calcular(
        sexo="hombre",
        fecha_nacimiento=dt.date(1998, 3, 14),
        altura_cm=176,
        peso_kg=78.0,
        actividad="alto",
        objetivo="bajar",
        hoy=dt.date(2026, 7, 27),
    )

    suma = resultado.prot_g * 4 + resultado.carb_g * 4 + resultado.fat_g * 9
    # Tolerancia por los redondeos a gramo entero.
    assert abs(suma - resultado.calorias) <= 10


def test_la_edad_sale_de_la_fecha_de_nacimiento():
    """El dia anterior al cumpleaños todavia no suma el año."""
    assert metas.edad_en(dt.date(1998, 3, 14), dt.date(2026, 3, 13)) == 27
    assert metas.edad_en(dt.date(1998, 3, 14), dt.date(2026, 3, 14)) == 28


def test_los_carbohidratos_no_bajan_de_cero():
    """En un perfil extremo la cascada puede restar mas de lo que hay.

    Mujer, 30 kg, 100 cm, 90 años, poca actividad, bajar de peso:
        basal         = 10x30 + 6,25x100 - 5x90 - 161 = 314
        mantenimiento = 314 x 1,2                      = 377 (redondeado)
        calorias      = 377 x 0,80 redondeado a 10     = 300
        proteina      = 2,0 x 30                        = 60 g
        grasas        = (300 x 0,25) / 9                = 8 g (redondeado)
        carbohidratos = (300 - 60x4 - 8x9) / 4           = -3 g sin piso

    Un gramaje negativo no es un valor valido para mostrar, asi que la
    cascada nunca puede devolver menos de cero.
    """
    resultado = metas.calcular(
        sexo="mujer",
        fecha_nacimiento=dt.date(1936, 7, 27),
        altura_cm=100,
        peso_kg=30.0,
        actividad="poco",
        objetivo="bajar",
        hoy=dt.date(2026, 7, 27),
    )

    assert resultado.calorias == 300
    assert resultado.prot_g == 60
    assert resultado.fat_g == 8
    assert resultado.carb_g == 0


def test_un_sexo_desconocido_lanza_keyerror():
    """No hay caso silencioso: un valor que no sea hombre/mujer debe fallar

    ruidoso, igual que un valor desconocido de actividad u objetivo. Si la
    validacion de la Tarea 3 alguna vez tiene un hueco, mejor un KeyError
    que un numero plausible pero calculado con la formula equivocada.
    """
    with pytest.raises(KeyError):
        metas.calcular(
            sexo="otro",
            fecha_nacimiento=dt.date(1998, 3, 14),
            altura_cm=176,
            peso_kg=78.0,
            actividad="moderado",
            objetivo="mantener",
            hoy=dt.date(2026, 7, 27),
        )


def test_las_constantes_de_actividad_y_objetivo_tienen_valores_exactos():
    """Ancla los factores que "mas actividad da mas calorias" solo ordena.

    Mismo caso base que el ejemplo del spec (hombre, 78 kg, 176 cm, 28 años,
    basal = 1745), calculado a mano para cada factor:

        poco (1,2):    mantenimiento = 1745 x 1,2   = 2094
                       calorias (mantener, +0%)     = 2094 -> 2090 (a 10)
        alto (1,725):  mantenimiento = 1745 x 1,725 = 3010,125 -> 3010
                       calorias (mantener, +0%)     = 3010
        moderado + mantener: mantenimiento = 1745 x 1,55 = 2704,75 -> 2705
                       calorias = 2705 x 1,0 = 270,5 -> 270 (a 10, redondeo
                       bancario: 270,5 cae al par mas cercano) -> 2700
    """
    comun = dict(
        sexo="hombre",
        fecha_nacimiento=dt.date(1998, 3, 14),
        altura_cm=176,
        peso_kg=78.0,
        objetivo="mantener",
        hoy=dt.date(2026, 7, 27),
    )

    poco = metas.calcular(actividad="poco", **comun)
    assert poco.mantenimiento == 2094
    assert poco.calorias == 2090

    alto = metas.calcular(actividad="alto", **comun)
    assert alto.mantenimiento == 3010
    assert alto.calorias == 3010

    moderado = metas.calcular(actividad="moderado", **comun)
    assert moderado.mantenimiento == 2705
    assert moderado.calorias == 2700
