import unicodedata


def normalizar(texto: str) -> str:
    """Deja el texto comparable: sin acentos, en minúsculas y sin espacios de más.

    La ñ se convierte en n. Es lo esperable al buscar desde un teclado de
    teléfono, donde escribir acentos es incómodo.
    """
    if not texto:
        return ""
    descompuesto = unicodedata.normalize("NFD", texto)
    sin_acentos = "".join(c for c in descompuesto if unicodedata.category(c) != "Mn")
    return " ".join(sin_acentos.lower().split())
