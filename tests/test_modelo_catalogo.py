from api.models import CatalogExercise


def test_guarda_y_recupera_un_ejercicio_con_arrays(db_session):
    ejercicio = CatalogExercise(
        id="0025",
        nombre_en="barbell bench press",
        nombre_es="Press de banca con barra",
        nombre_norm="press de banca con barra",
        body_part="chest",
        body_part_es="Pecho",
        equipment="barbell",
        equipment_es="Barra",
        target="pectorals",
        target_es="Pectorales",
        secondary_muscles=["triceps", "shoulders"],
        instrucciones_es=["Primer paso.", "Segundo paso."],
        gif_path="0025-EIeI8Vf.gif",
        atribucion="© Gym visual — gymvisual.com",
    )
    db_session.add(ejercicio)
    db_session.commit()

    recuperado = db_session.get(CatalogExercise, "0025")
    assert recuperado.nombre_es == "Press de banca con barra"
    assert recuperado.secondary_muscles == ["triceps", "shoulders"]
    assert len(recuperado.instrucciones_es) == 2
