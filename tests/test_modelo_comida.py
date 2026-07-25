def test_meal_persiste_con_items(db_session):
    from api.models import Meal, MealItem

    comida = Meal(user_id="11111111-1111-1111-1111-111111111111", etiqueta="Cena")
    comida.items = [
        MealItem(nombre="Arroz", calorias=200, prot_g=4, carbs_g=44, fat_g=1),
        MealItem(nombre="Pollo", calorias=180, prot_g=30, carbs_g=0, fat_g=6),
    ]
    db_session.add(comida)
    db_session.commit()
    db_session.refresh(comida)

    assert comida.id is not None
    assert comida.logged_at is not None
    assert len(comida.items) == 2
    assert comida.items[0].nombre == "Arroz"


def test_borrar_meal_borra_sus_items(db_session):
    from api.models import Meal, MealItem

    comida = Meal(user_id="u1")
    comida.items = [MealItem(nombre="Pan", calorias=80, prot_g=3, carbs_g=15, fat_g=1)]
    db_session.add(comida)
    db_session.commit()
    db_session.delete(comida)
    db_session.commit()

    assert db_session.query(MealItem).count() == 0
