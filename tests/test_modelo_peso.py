def test_weight_entry_persiste_con_fecha_del_servidor(db_session):
    from api.models import WeightEntry

    registro = WeightEntry(user_id="11111111-1111-1111-1111-111111111111", kg=78.5)
    db_session.add(registro)
    db_session.commit()
    db_session.refresh(registro)

    assert registro.id is not None
    assert registro.kg == 78.5
    assert registro.recorded_at is not None


def test_weight_entry_permite_varios_registros_el_mismo_usuario(db_session):
    from api.models import WeightEntry

    db_session.add(WeightEntry(user_id="u1", kg=78.0))
    db_session.add(WeightEntry(user_id="u1", kg=78.4))
    db_session.commit()

    assert db_session.query(WeightEntry).filter_by(user_id="u1").count() == 2
