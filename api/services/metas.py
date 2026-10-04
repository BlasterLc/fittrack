"""Cálculo de las metas diarias a partir de la ficha del usuario.

Módulo puro: no toca la base de datos ni conoce el modelo. Recibe datos
sueltos y devuelve números, así los valores —que es lo que el usuario mira
todos los días— se pueden probar sin montar un perfil.

Metabolismo basal, Mifflin-St Jeor:

    Hombres:  10 x peso_kg + 6,25 x altura_cm - 5 x edad + 5
    Mujeres:  10 x peso_kg + 6,25 x altura_cm - 5 x edad - 161

Después se multiplica por el factor de actividad para obtener el
mantenimiento, y sobre eso se aplica el ajuste del objetivo. Los macros
salen en cascada: primero la proteína por kilo de peso, después las grasas
como porcentaje de las calorías, y los carbohidratos son lo que sobra. Así
los cuatro números nunca se contradicen entre sí.
"""

import datetime as dt
from dataclasses import dataclass

# Constante de Mifflin-St Jeor segun el sexo.
AJUSTE_SEXO = {"hombre": 5, "mujer": -161}

FACTORES_ACTIVIDAD = {"poco": 1.2, "moderado": 1.55, "alto": 1.725}

# El deficit es mas agresivo que el superavit a proposito: subir de peso
# rapido agrega grasa, no musculo.
AJUSTES_OBJETIVO = {"bajar": -0.20, "mantener": 0.0, "ganar": 0.10}

# Gramos de proteina por kilo de peso. En deficit sube porque es lo que
# protege la masa muscular.
PROTEINA_POR_KG = {"bajar": 2.0, "mantener": 1.6, "ganar": 1.8}

PORCENTAJE_GRASAS = 0.25

KCAL_POR_GRAMO = {"prot": 4, "carb": 4, "fat": 9}


@dataclass(frozen=True)
class Metas:
    """Las cuatro metas del día, más el mantenimiento del que salieron.

    El mantenimiento se devuelve para que la pantalla pueda explicar de dónde
    sale el número en vez de mostrarlo sin justificación.
    """

    calorias: int
    prot_g: int
    carb_g: int
    fat_g: int
    mantenimiento: int


def edad_en(fecha_nacimiento: dt.date, hoy: dt.date) -> int:
    """Años cumplidos a la fecha dada."""
    cumplio_este_anio = (hoy.month, hoy.day) >= (fecha_nacimiento.month, fecha_nacimiento.day)
    return hoy.year - fecha_nacimiento.year - (0 if cumplio_este_anio else 1)


def _basal(sexo: str, peso_kg: float, altura_cm: int, edad: int) -> float:
    comun = 10 * peso_kg + 6.25 * altura_cm - 5 * edad
    return comun + AJUSTE_SEXO[sexo]


def calcular(
    *,
    sexo: str,
    fecha_nacimiento: dt.date,
    altura_cm: int,
    peso_kg: float,
    actividad: str,
    objetivo: str,
    hoy: dt.date | None = None,
) -> Metas:
    """Las metas del usuario. Todos los datos son obligatorios.

    Quien llama se encarga de que el perfil esté completo: acá no hay caso
    "faltan datos", justamente para que el cálculo no tenga que decidir nada.
    """
    hoy = hoy or dt.date.today()
    edad = edad_en(fecha_nacimiento, hoy)

    mantenimiento = round(_basal(sexo, peso_kg, altura_cm, edad) * FACTORES_ACTIVIDAD[actividad])
    calorias = round(mantenimiento * (1 + AJUSTES_OBJETIVO[objetivo]) / 10) * 10

    prot_g = round(PROTEINA_POR_KG[objetivo] * peso_kg)
    fat_g = round(calorias * PORCENTAJE_GRASAS / KCAL_POR_GRAMO["fat"])
    carb_kcal = calorias - prot_g * KCAL_POR_GRAMO["prot"] - fat_g * KCAL_POR_GRAMO["fat"]
    # En un perfil extremo (mucha proteina por kilo con muy pocas calorias)
    # la cascada puede restar mas de lo que hay: un gramaje negativo no es
    # un valor valido para mostrar, asi que se pone un piso en cero.
    carb_g = max(0, round(carb_kcal / KCAL_POR_GRAMO["carb"]))

    return Metas(
        calorias=calorias,
        prot_g=prot_g,
        carb_g=carb_g,
        fat_g=fat_g,
        mantenimiento=mantenimiento,
    )
