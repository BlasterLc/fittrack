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
