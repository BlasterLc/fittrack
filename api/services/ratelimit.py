"""Límite de uso por usuario para endpoints que cuestan dinero (Anthropic).

Ventana deslizante en memoria: sirve con una sola instancia de Railway. Con
varias réplicas cada una llevaría su propia cuenta (el límite efectivo sería
N veces mayor); en ese caso hay que moverlo a Postgres o Redis.
"""

import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException, status

# (máximo de llamadas, ventana en segundos)
LIMITES_ANALISIS = ((10, 60), (60, 3600), (200, 86400))

_llamadas: dict[str, deque[float]] = defaultdict(deque)
_lock = threading.Lock()


def verificar(user_id: str, limites=LIMITES_ANALISIS) -> None:
    """Registra una llamada de `user_id` o levanta 429 si excede algún límite."""
    ahora = time.monotonic()
    mas_larga = max(ventana for _, ventana in limites)
    # Los endpoints síncronos corren en un threadpool: sin lock, ráfagas
    # paralelas pasan todas el chequeo antes de que alguna registre su llamada.
    with _lock:
        historial = _llamadas[user_id]
        while historial and ahora - historial[0] > mas_larga:
            historial.popleft()
        for maximo, ventana in limites:
            recientes = sum(1 for t in historial if ahora - t <= ventana)
            if recientes >= maximo:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Demasiados análisis seguidos. Intenta de nuevo más tarde.",
                )
        historial.append(ahora)
        # Evita que crezca el dict con usuarios inactivos.
        if len(_llamadas) > 1000:
            for uid in [u for u, h in _llamadas.items() if not h or ahora - h[-1] > mas_larga]:
                del _llamadas[uid]


def reiniciar() -> None:
    """Para las pruebas."""
    _llamadas.clear()
