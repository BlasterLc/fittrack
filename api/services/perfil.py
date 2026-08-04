"""Validación y persistencia del perfil. El cálculo vive en services/metas.py."""

import datetime as dt
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from api.models import Profile, WeightEntry
from api.services import metas as calculo
from api.services import peso as peso_servicio

SEXOS = {"hombre", "mujer"}
ACTIVIDADES = set(calculo.FACTORES_ACTIVIDAD)
OBJETIVOS = set(calculo.AJUSTES_OBJETIVO)

ALTURA_CM = (100, 250)
EDAD = (14, 100)
LARGO_NOMBRE = 60

# El peso ya no es un atributo de Profile: sale del historial. Los otros
# cinco siguen siendo los que necesita el cálculo.
CAMPOS_DEL_CALCULO = ("sexo", "fecha_nacimiento", "altura_cm", "actividad", "objetivo")

CAMPOS_METAS = ("calorias", "prot_g", "carb_g", "fat_g")


class PerfilInvalido(ValueError):
    """Algún dato está fuera de rango o no es un valor aceptado."""


@dataclass(frozen=True)
class PerfilResuelto:
    """El perfil junto con las metas que corresponden mostrar.

    `metas` es None cuando el perfil está incompleto y no hay metas escritas a
    mano: ahí quien llama decide el respaldo. `peso_kg` es el registro más
    reciente del historial, no un atributo de `perfil`: puede existir aunque
    `perfil` sea None (alguien cargó un peso desde Progreso sin haber tocado
    nunca la pantalla de Perfil).
    """

    perfil: Profile | None
    peso_kg: float | None
    metas: calculo.Metas | None
    completo: bool
    son_manuales: bool


def _validar(datos: dict) -> None:
    nombre = datos.get("nombre")
    if nombre is not None and len(nombre) > LARGO_NOMBRE:
        raise PerfilInvalido(f"El nombre no puede superar los {LARGO_NOMBRE} caracteres")

    sexo = datos.get("sexo")
    if sexo is not None and sexo not in SEXOS:
        raise PerfilInvalido("Sexo no reconocido")

    actividad = datos.get("actividad")
    if actividad is not None and actividad not in ACTIVIDADES:
        raise PerfilInvalido("Nivel de actividad no reconocido")

    objetivo = datos.get("objetivo")
    if objetivo is not None and objetivo not in OBJETIVOS:
        raise PerfilInvalido("Objetivo no reconocido")

    altura = datos.get("altura_cm")
    if altura is not None and not ALTURA_CM[0] <= altura <= ALTURA_CM[1]:
        raise PerfilInvalido(f"La altura debe estar entre {ALTURA_CM[0]} y {ALTURA_CM[1]} cm")

    peso = datos.get("peso_kg")
    if peso is not None and not peso_servicio.PESO_KG[0] <= peso <= peso_servicio.PESO_KG[1]:
        raise PerfilInvalido(
            f"El peso debe estar entre {peso_servicio.PESO_KG[0]:.0f} "
            f"y {peso_servicio.PESO_KG[1]:.0f} kg"
        )

    nacimiento = datos.get("fecha_nacimiento")
    if nacimiento is not None:
        hoy = dt.date.today()
        if nacimiento > hoy:
            raise PerfilInvalido("La fecha de nacimiento no puede ser futura")
        edad = calculo.edad_en(nacimiento, hoy)
        if not EDAD[0] <= edad <= EDAD[1]:
            raise PerfilInvalido(f"La edad debe estar entre {EDAD[0]} y {EDAD[1]} años")

    manuales = datos.get("metas_manuales")
    if manuales is not None:
        faltan = [c for c in CAMPOS_METAS if manuales.get(c) is None]
        if faltan:
            raise PerfilInvalido("Las cuatro metas van juntas o ninguna")
        if any(manuales[c] <= 0 for c in CAMPOS_METAS):
            raise PerfilInvalido("Las metas deben ser mayores que cero")


def obtener(sesion: Session, user_id: str) -> Profile | None:
    """El perfil del usuario, o None. Nunca devuelve el de otro."""
    return sesion.execute(select(Profile).where(Profile.user_id == user_id)).scalar_one_or_none()


def guardar(sesion: Session, user_id: str, datos: dict) -> Profile:
    """Deja el perfil exactamente como se pide.

    Converge: un campo en None borra el valor que hubiera, igual que el PUT de
    rutinas reemplaza la lista completa. El peso es la EXCEPCIÓN: es de solo
    agregar. Un `peso_kg` en None simplemente no crea un registro nuevo — no
    borra el historial, porque esta pantalla no tiene forma de "borrar el
    peso", para eso está el borrado puntual en Progreso.
    """
    _validar(datos)

    perfil = obtener(sesion, user_id)
    if perfil is None:
        perfil = Profile(user_id=user_id)
        sesion.add(perfil)

    # Un nombre en blanco es lo mismo que no tener nombre, igual que en rutinas.
    perfil.nombre = (datos.get("nombre") or "").strip() or None
    perfil.sexo = datos.get("sexo")
    perfil.fecha_nacimiento = datos.get("fecha_nacimiento")
    perfil.altura_cm = datos.get("altura_cm")
    perfil.actividad = datos.get("actividad")
    perfil.objetivo = datos.get("objetivo")

    peso = datos.get("peso_kg")
    if peso is not None:
        sesion.add(WeightEntry(user_id=user_id, kg=peso))

    manuales = datos.get("metas_manuales")
    perfil.meta_calorias = manuales["calorias"] if manuales else None
    perfil.meta_prot_g = manuales["prot_g"] if manuales else None
    perfil.meta_carb_g = manuales["carb_g"] if manuales else None
    perfil.meta_fat_g = manuales["fat_g"] if manuales else None

    sesion.commit()
    sesion.refresh(perfil)
    return perfil


def resolver(sesion: Session, user_id: str, hoy: dt.date | None = None) -> PerfilResuelto:
    """El perfil y las metas que hay que mostrar, ya decidido cuál gana."""
    perfil = obtener(sesion, user_id)
    ultimo_peso = peso_servicio.mas_reciente(sesion, user_id)
    peso_kg = ultimo_peso.kg if ultimo_peso is not None else None

    if perfil is None:
        return PerfilResuelto(
            perfil=None, peso_kg=peso_kg, metas=None, completo=False, son_manuales=False
        )

    completo = peso_kg is not None and all(
        getattr(perfil, campo) is not None for campo in CAMPOS_DEL_CALCULO
    )

    # Las cuatro juntas o ninguna. `guardar` ya lo garantiza, pero la tabla no
    # tiene un CHECK: una fila editada a mano en el panel de Supabase podría
    # dejar solo algunas, y ahí conviene caer al cálculo antes que reventar.
    if all(getattr(perfil, f"meta_{campo}") is not None for campo in CAMPOS_METAS):
        manuales = calculo.Metas(
            calorias=perfil.meta_calorias,
            prot_g=perfil.meta_prot_g,
            carb_g=perfil.meta_carb_g,
            fat_g=perfil.meta_fat_g,
            # El mantenimiento se sigue calculando si se puede: la pantalla lo
            # muestra para que se vea cuánto se aparta la meta escrita a mano.
            mantenimiento=(
                calculo.calcular(
                    sexo=perfil.sexo,
                    fecha_nacimiento=perfil.fecha_nacimiento,
                    altura_cm=perfil.altura_cm,
                    peso_kg=peso_kg,
                    actividad=perfil.actividad,
                    objetivo=perfil.objetivo,
                    hoy=hoy,
                ).mantenimiento
                if completo
                else 0
            ),
        )
        return PerfilResuelto(
            perfil=perfil, peso_kg=peso_kg, metas=manuales, completo=completo, son_manuales=True
        )

    if not completo:
        return PerfilResuelto(
            perfil=perfil, peso_kg=peso_kg, metas=None, completo=False, son_manuales=False
        )

    calculadas = calculo.calcular(
        sexo=perfil.sexo,
        fecha_nacimiento=perfil.fecha_nacimiento,
        altura_cm=perfil.altura_cm,
        peso_kg=peso_kg,
        actividad=perfil.actividad,
        objetivo=perfil.objetivo,
        hoy=hoy,
    )
    return PerfilResuelto(
        perfil=perfil, peso_kg=peso_kg, metas=calculadas, completo=True, son_manuales=False
    )


def previsualizar(datos: dict, hoy: dt.date | None = None) -> calculo.Metas | None:
    """Las metas que darían estos datos, sin tocar la base.

    Devuelve None si falta alguno de los seis datos del cálculo, igual que
    `resolver`. Ignora `metas_manuales` a propósito: quien consulta la vista
    previa quiere ver qué da el cálculo, que es justamente lo que las metas
    escritas a mano tapan. A diferencia de `resolver`, el peso viene del
    payload posteado, no de la base: no hay nada que consultar todavía.
    """
    _validar(datos)

    if datos.get("peso_kg") is None:
        return None
    if any(datos.get(campo) is None for campo in CAMPOS_DEL_CALCULO):
        return None

    return calculo.calcular(
        sexo=datos["sexo"],
        fecha_nacimiento=datos["fecha_nacimiento"],
        altura_cm=datos["altura_cm"],
        peso_kg=datos["peso_kg"],
        actividad=datos["actividad"],
        objetivo=datos["objetivo"],
        hoy=hoy,
    )
