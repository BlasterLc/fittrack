from api.scripts.mapeos import BODY_PART, EQUIPMENT, SECONDARY, TARGET, traducir


def test_traduce_valores_conocidos():
    assert traducir(BODY_PART, "chest") == "Pecho"
    assert traducir(EQUIPMENT, "barbell") == "Barra"
    assert traducir(TARGET, "pectorals") == "Pectorales"
    assert traducir(SECONDARY, "rotator cuff") == "Manguito rotador"


def test_valor_desconocido_se_devuelve_capitalizado():
    assert traducir(BODY_PART, "tentacles") == "Tentacles"


# Vocabulario completo del dataset hasaneyldrm/exercises-dataset. Se escribe
# aquí porque data/exercises.json no se versiona: el test debe correr en un
# clon limpio. Si el dataset incorpora un valor nuevo, el último test avisa.
PARTES = {
    "back", "cardio", "chest", "lower arms", "lower legs",
    "neck", "shoulders", "upper arms", "upper legs", "waist",
}
EQUIPOS = {
    "assisted", "band", "barbell", "body weight", "bosu ball", "cable",
    "dumbbell", "elliptical machine", "ez barbell", "hammer", "kettlebell",
    "leverage machine", "medicine ball", "olympic barbell", "resistance band",
    "roller", "rope", "skierg machine", "sled machine", "smith machine",
    "stability ball", "stationary bike", "stepmill machine", "tire",
    "trap bar", "upper body ergometer", "weighted", "wheel roller",
}
OBJETIVOS = {
    "abductors", "abs", "adductors", "biceps", "calves",
    "cardiovascular system", "delts", "forearms", "glutes", "hamstrings",
    "lats", "levator scapulae", "pectorals", "quads", "serratus anterior",
    "spine", "traps", "triceps", "upper back",
}
# Vocabulario propio: el dataset nombra los secundarios con otras palabras que
# los objetivos ("quadriceps" y no "quads", "trapezius" y no "traps"), así que
# no alcanza con reusar TARGET. Las dos formas traducen al mismo término.
SECUNDARIOS = {
    "abdominals", "ankle stabilizers", "ankles", "back", "biceps",
    "brachialis", "calves", "chest", "core", "deltoids", "feet", "forearms",
    "glutes", "grip muscles", "groin", "hamstrings", "hands", "hip flexors",
    "inner thighs", "latissimus dorsi", "lats", "lower abs", "lower back",
    "obliques", "quadriceps", "rear deltoids", "rhomboids", "rotator cuff",
    "shins", "shoulders", "soleus", "sternocleidomastoid", "trapezius",
    "traps", "triceps", "upper back", "upper chest", "wrist extensors",
    "wrist flexors", "wrists",
}


def test_cubre_todas_las_partes_del_cuerpo():
    assert PARTES <= set(BODY_PART), PARTES - set(BODY_PART)


def test_cubre_todos_los_equipamientos():
    assert EQUIPOS <= set(EQUIPMENT), EQUIPOS - set(EQUIPMENT)


def test_cubre_todos_los_musculos_objetivo():
    assert OBJETIVOS <= set(TARGET), OBJETIVOS - set(TARGET)


def test_cubre_todos_los_musculos_secundarios():
    assert SECUNDARIOS <= set(SECONDARY), SECUNDARIOS - set(SECONDARY)


def test_las_dos_formas_de_un_musculo_traducen_igual():
    """El dataset nombra el mismo músculo distinto según el campo.

    Si "quads" y "quadriceps" cayeran en términos distintos, la ficha diría
    una cosa como objetivo y otra como secundario para el mismo músculo.
    """
    for objetivo, secundario in [
        ("quads", "quadriceps"),
        ("traps", "trapezius"),
        ("delts", "deltoids"),
        ("lats", "lats"),
        ("upper back", "upper back"),
    ]:
        assert traducir(TARGET, objetivo) == traducir(SECONDARY, secundario), objetivo


def test_ninguna_traduccion_deja_el_ingles():
    """Una entrada que solo capitaliza el inglés es un hueco disfrazado."""
    iguales = [
        (k, v)
        for tabla in (BODY_PART, EQUIPMENT, TARGET, SECONDARY)
        for k, v in tabla.items()
        if k.lower() == v.lower() and k != "cardio"
    ]
    assert not iguales, iguales


def test_el_dataset_no_trae_categorias_nuevas():
    """Si el dataset cambia, este test avisa antes que la ingesta."""
    import json
    from pathlib import Path

    origen = Path("data/exercises.json")
    if not origen.exists():
        return  # el dataset no se versiona; solo se valida si fue descargado

    fichas = json.loads(origen.read_text())
    assert {f["body_part"] for f in fichas} <= PARTES
    assert {f["equipment"] for f in fichas} <= EQUIPOS
    assert {f["target"] for f in fichas} <= OBJETIVOS
    assert {m for f in fichas for m in (f.get("secondary_muscles") or [])} <= SECUNDARIOS
