"""Traducción fija de las categorías del dataset.

Son pocos valores y conviene acertarles: se escriben a mano en lugar de
pasarlos por un modelo de lenguaje.
"""

BODY_PART = {
    "back": "Espalda",
    "cardio": "Cardio",
    "chest": "Pecho",
    "lower arms": "Antebrazos",
    "lower legs": "Pantorrillas",
    "neck": "Cuello",
    "shoulders": "Hombros",
    "upper arms": "Brazos",
    "upper legs": "Piernas",
    "waist": "Abdomen",
}

EQUIPMENT = {
    "assisted": "Asistido",
    "band": "Banda elástica",
    "barbell": "Barra",
    "body weight": "Peso corporal",
    "bosu ball": "Balón bosu",
    "cable": "Polea",
    "dumbbell": "Mancuerna",
    "elliptical machine": "Elíptica",
    "ez barbell": "Barra Z",
    "hammer": "Martillo",
    "kettlebell": "Pesa rusa",
    "leverage machine": "Máquina",
    "medicine ball": "Balón medicinal",
    "olympic barbell": "Barra olímpica",
    "resistance band": "Banda de resistencia",
    "roller": "Rodillo",
    "rope": "Cuerda",
    "skierg machine": "Máquina de esquí",
    "sled machine": "Prensa",
    "smith machine": "Máquina Smith",
    "stability ball": "Balón de estabilidad",
    "stationary bike": "Bicicleta estática",
    "stepmill machine": "Escaladora",
    "tire": "Neumático",
    "trap bar": "Barra hexagonal",
    "upper body ergometer": "Ergómetro de brazos",
    "weighted": "Con lastre",
    "wheel roller": "Rueda abdominal",
}

TARGET = {
    "abductors": "Abductores",
    "abs": "Abdominales",
    "adductors": "Aductores",
    "biceps": "Bíceps",
    "calves": "Pantorrillas",
    "cardiovascular system": "Sistema cardiovascular",
    "delts": "Deltoides",
    "forearms": "Antebrazos",
    "glutes": "Glúteos",
    "hamstrings": "Isquiotibiales",
    "lats": "Dorsales",
    "levator scapulae": "Elevador de la escápula",
    "pectorals": "Pectorales",
    "quads": "Cuádriceps",
    "serratus anterior": "Serrato anterior",
    "spine": "Espalda baja",
    "traps": "Trapecios",
    "triceps": "Tríceps",
    "upper back": "Espalda alta",
}


# Los secundarios traen su propio vocabulario, más anatómico que el de TARGET:
# el mismo músculo aparece como "quads" en un campo y "quadriceps" en el otro.
# Las dos formas apuntan al mismo término en español a propósito.
SECONDARY = {
    "abdominals": "Abdominales",
    "ankle stabilizers": "Estabilizadores del tobillo",
    "ankles": "Tobillos",
    "back": "Espalda",
    "biceps": "Bíceps",
    "brachialis": "Braquial",
    "calves": "Pantorrillas",
    "chest": "Pecho",
    # "Core" se entiende, pero deja el inglés dentro de una ficha en español.
    "core": "Zona media",
    "deltoids": "Deltoides",
    "feet": "Pies",
    "forearms": "Antebrazos",
    "glutes": "Glúteos",
    "grip muscles": "Músculos de agarre",
    "groin": "Ingle",
    "hamstrings": "Isquiotibiales",
    "hands": "Manos",
    "hip flexors": "Flexores de cadera",
    "inner thighs": "Aductores",
    "latissimus dorsi": "Dorsal ancho",
    "lats": "Dorsales",
    "lower abs": "Abdominales inferiores",
    "lower back": "Espalda baja",
    "obliques": "Oblicuos",
    "quadriceps": "Cuádriceps",
    "rear deltoids": "Deltoides posteriores",
    "rhomboids": "Romboides",
    "rotator cuff": "Manguito rotador",
    "shins": "Tibiales",
    "shoulders": "Hombros",
    "soleus": "Sóleo",
    "sternocleidomastoid": "Esternocleidomastoideo",
    "trapezius": "Trapecios",
    "traps": "Trapecios",
    "triceps": "Tríceps",
    "upper back": "Espalda alta",
    "upper chest": "Pecho superior",
    "wrist extensors": "Extensores de muñeca",
    "wrist flexors": "Flexores de muñeca",
    "wrists": "Muñecas",
}


def traducir(tabla: dict[str, str], valor: str) -> str:
    """Devuelve la traducción, o el valor capitalizado si no está en la tabla.

    No falla ante un valor desconocido: el dataset podría incorporar
    categorías nuevas y la ingesta no debe romperse por eso.
    """
    if valor is None:
        return ""
    return tabla.get(valor.strip().lower(), valor.strip().capitalize())
