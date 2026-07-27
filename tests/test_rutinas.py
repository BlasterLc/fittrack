import pytest
from sqlalchemy.exc import IntegrityError

from api.models import Routine, RoutineExercise
from api.scripts.ingestar import ingestar
from api.services import routines as servicio

USUARIO = "11111111-1111-1111-1111-111111111111"
OTRO_USUARIO = "22222222-2222-2222-2222-222222222222"

FICHAS = [
    {
        "id": "0025", "name": "barbell bench press", "body_part": "chest",
        "equipment": "barbell", "target": "pectorals",
        "secondary_muscles": [], "gif_url": "videos/0025-a.gif",
        "instruction_steps": {"es": ["Paso uno."]},
    },
    {
        "id": "0033", "name": "barbell shoulder press", "body_part": "shoulders",
        "equipment": "barbell", "target": "delts",
        "secondary_muscles": [], "gif_url": "videos/0033-b.gif",
        "instruction_steps": {"es": ["Paso uno."]},
    },
    {
        "id": "0043", "name": "barbell curl", "body_part": "upper arms",
        "equipment": "barbell", "target": "biceps",
        "secondary_muscles": [], "gif_url": "videos/0043-c.gif",
        "instruction_steps": {"es": ["Paso uno."]},
    },
]


@pytest.fixture
def catalogo(db_session):
    ingestar(db_session, FICHAS, {})
    return db_session


def test_una_rutina_guarda_sus_ejercicios_en_orden(db_session):
    rutina = Routine(user_id=USUARIO, nombre="Empuje A")
    rutina.ejercicios = [
        RoutineExercise(catalog_id="0025", orden=0),
        RoutineExercise(catalog_id="0033", orden=1),
    ]
    db_session.add(rutina)
    db_session.commit()

    guardada = db_session.get(Routine, rutina.id)
    assert guardada.nombre == "Empuje A"
    assert guardada.archived_at is None
    assert [e.catalog_id for e in guardada.ejercicios] == ["0025", "0033"]


def test_el_mismo_ejercicio_no_entra_dos_veces(db_session):
    """UNIQUE (routine_id, catalog_id): es lo que habilita los checks del catálogo."""
    rutina = Routine(user_id=USUARIO, nombre="Empuje A")
    rutina.ejercicios = [
        RoutineExercise(catalog_id="0025", orden=0),
        RoutineExercise(catalog_id="0025", orden=1),
    ]
    db_session.add(rutina)

    with pytest.raises(IntegrityError):
        db_session.commit()


def test_borrar_la_rutina_borra_sus_ejercicios(db_session):
    rutina = Routine(user_id=USUARIO, nombre="Temporal")
    rutina.ejercicios = [RoutineExercise(catalog_id="0025", orden=0)]
    db_session.add(rutina)
    db_session.commit()

    db_session.delete(rutina)
    db_session.commit()

    assert db_session.query(RoutineExercise).count() == 0


def _crear(sesion, user_id, nombre, ids, archivada=False):
    from datetime import datetime, timezone

    rutina = Routine(user_id=user_id, nombre=nombre)
    rutina.ejercicios = [
        RoutineExercise(catalog_id=c, orden=i) for i, c in enumerate(ids)
    ]
    if archivada:
        rutina.archived_at = datetime.now(timezone.utc)
    sesion.add(rutina)
    sesion.commit()
    return rutina


def test_listar_devuelve_conteo_y_grupos_musculares(catalogo):
    _crear(catalogo, USUARIO, "Empuje A", ["0025", "0033", "0043"])

    filas = servicio.listar(catalogo, USUARIO)

    assert len(filas) == 1
    assert filas[0]["nombre"] == "Empuje A"
    assert filas[0]["total_ejercicios"] == 3
    # Alfabético, sin repetidos: dos rutinas que cubren lo mismo se ven iguales.
    assert filas[0]["grupos_musculares"] == ["Brazos", "Hombros", "Pecho"]


def test_listar_no_muestra_rutinas_de_otro_usuario(catalogo):
    _crear(catalogo, OTRO_USUARIO, "Ajena", ["0025"])

    assert servicio.listar(catalogo, USUARIO) == []


def test_listar_oculta_las_archivadas_por_defecto(catalogo):
    _crear(catalogo, USUARIO, "Vieja", ["0025"], archivada=True)
    _crear(catalogo, USUARIO, "Actual", ["0033"])

    activas = servicio.listar(catalogo, USUARIO)
    archivadas = servicio.listar(catalogo, USUARIO, archivadas=True)

    assert [f["nombre"] for f in activas] == ["Actual"]
    assert [f["nombre"] for f in archivadas] == ["Vieja"]


def test_listar_ignora_ejercicios_que_ya_no_estan_en_el_catalogo(catalogo):
    """La ingesta converge borrando: una rutina puede quedar apuntando a nada."""
    _crear(catalogo, USUARIO, "Con hueco", ["0025", "9999"])

    filas = servicio.listar(catalogo, USUARIO)

    assert filas[0]["total_ejercicios"] == 1
    assert filas[0]["grupos_musculares"] == ["Pecho"]


def test_crear_guarda_el_orden_recibido(catalogo):
    rutina = servicio.crear(catalogo, USUARIO, "Empuje A", ["0033", "0025"])

    assert rutina.nombre == "Empuje A"
    assert [e.catalog_id for e in rutina.ejercicios] == ["0033", "0025"]
    assert [e.orden for e in rutina.ejercicios] == [0, 1]


def test_crear_rechaza_un_ejercicio_inexistente(catalogo):
    with pytest.raises(servicio.EjercicioDesconocido) as error:
        servicio.crear(catalogo, USUARIO, "Empuje A", ["0025", "9999"])

    assert "9999" in str(error.value)


def test_crear_rechaza_nombre_vacio(catalogo):
    with pytest.raises(servicio.RutinaInvalida):
        servicio.crear(catalogo, USUARIO, "   ", ["0025"])


def test_crear_rechaza_una_rutina_sin_ejercicios(catalogo):
    with pytest.raises(servicio.RutinaInvalida):
        servicio.crear(catalogo, USUARIO, "Empuje A", [])


def test_crear_rechaza_ejercicios_repetidos(catalogo):
    with pytest.raises(servicio.RutinaInvalida):
        servicio.crear(catalogo, USUARIO, "Empuje A", ["0025", "0025"])


def test_crear_recorta_los_espacios_del_nombre(catalogo):
    rutina = servicio.crear(catalogo, USUARIO, "  Empuje A  ", ["0025"])
    assert rutina.nombre == "Empuje A"


def test_detalle_trae_los_datos_del_catalogo_en_orden(catalogo):
    creada = servicio.crear(catalogo, USUARIO, "Empuje A", ["0033", "0025"])

    detalle = servicio.detalle(catalogo, USUARIO, creada.id)

    assert detalle["nombre"] == "Empuje A"
    assert [e.id for e in detalle["ejercicios"]] == ["0033", "0025"]
    assert detalle["ejercicios"][0].body_part_es == "Hombros"


def test_detalle_de_otro_usuario_no_existe(catalogo):
    ajena = _crear(catalogo, OTRO_USUARIO, "Ajena", ["0025"])

    assert servicio.detalle(catalogo, USUARIO, ajena.id) is None


def test_detalle_omite_los_ejercicios_borrados_del_catalogo(catalogo):
    rutina = _crear(catalogo, USUARIO, "Con hueco", ["0025", "9999"])

    detalle = servicio.detalle(catalogo, USUARIO, rutina.id)

    assert [e.id for e in detalle["ejercicios"]] == ["0025"]
    # El editor usa esta diferencia para avisar en una línea.
    assert detalle["ejercicios_faltantes"] == 1


def test_detalle_de_una_rutina_cuyos_ejercicios_desaparecieron_todos(catalogo):
    """Caso límite de §3.3 del spec: no puede dar 404 ni reventar.

    La regla de "nunca vacía" se apoya en la validación al guardar, no en una
    restricción de base de datos, así que este estado es alcanzable.
    """
    rutina = _crear(catalogo, USUARIO, "Fantasma", ["9998", "9999"])

    detalle = servicio.detalle(catalogo, USUARIO, rutina.id)

    assert detalle is not None
    assert detalle["nombre"] == "Fantasma"
    assert detalle["ejercicios"] == []
    assert detalle["ejercicios_faltantes"] == 2
