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
    "cable": "Polea",
    "dumbbell": "Mancuerna",
    "ez barbell": "Barra Z",
    "kettlebell": "Pesa rusa",
    "leverage machine": "Máquina",
    "medicine ball": "Balón medicinal",
    "olympic barbell": "Barra olímpica",
    "resistance band": "Banda de resistencia",
    "smith machine": "Máquina Smith",
    "stability ball": "Balón de estabilidad",
    "weighted": "Con lastre",
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


def traducir(tabla: dict[str, str], valor: str) -> str:
    """Devuelve la traducción, o el valor capitalizado si no está en la tabla.

    No falla ante un valor desconocido: el dataset podría incorporar
    categorías nuevas y la ingesta no debe romperse por eso.
    """
    if valor is None:
        return ""
    return tabla.get(valor.strip().lower(), valor.strip().capitalize())
