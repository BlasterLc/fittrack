import os

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse

from api.auth import get_current_user
from api.routers import catalog, dashboard, entrenamientos, food, perfil, peso, progreso, routines

# /docs, /redoc y /openapi.json solo con ENABLE_DOCS=1 (local); en producción
# no se publican para no regalar el mapa completo de la API.
_docs = os.getenv("ENABLE_DOCS") == "1"
app = FastAPI(
    title="FitTrack API",
    docs_url="/docs" if _docs else None,
    redoc_url="/redoc" if _docs else None,
    openapi_url="/openapi.json" if _docs else None,
)

# WEB_ORIGIN se lee aparte de Config (que exige DATABASE_URL/SUPABASE_URL/etc.
# para instanciarse) porque el middleware se registra al importar el modulo,
# antes de que exista una request de la que depender. Sin la variable seteada
# (como en local/tests hoy), el middleware simplemente no se agrega.
_web_origin = os.getenv("WEB_ORIGIN")
# rstrip: una barra final en la variable de Railway ("https://x.com/" en vez
# de "https://x.com") no matchea el header Origin del navegador, que nunca la
# trae, y CORS se rompe en silencio.
if _web_origin:
    _web_origin = _web_origin.rstrip("/")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[_web_origin],
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )
# Tope de cuerpo: FastAPI lee y parsea todo el JSON antes de autenticar y de
# aplicar los max_length de pydantic, así que el límite va antes, en ASGI.
MAX_BODY_BYTES = 8 * 1024 * 1024


class LimiteCuerpo:
    def __init__(self, app, maximo: int = MAX_BODY_BYTES) -> None:
        self.app = app
        self.maximo = maximo

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        largo = dict(scope["headers"]).get(b"content-length")
        if largo is not None and largo.isdigit() and int(largo) > self.maximo:
            await self._rechazar(send)
            return

        recibidos = 0

        async def limitado():
            nonlocal recibidos
            mensaje = await receive()
            if mensaje["type"] == "http.request":
                recibidos += len(mensaje.get("body", b""))
                if recibidos > self.maximo:
                    raise _CuerpoExcedido()
            return mensaje

        try:
            await self.app(scope, limitado, send)
        except _CuerpoExcedido:
            await self._rechazar(send)

    @staticmethod
    async def _rechazar(send) -> None:
        await send(
            {
                "type": "http.response.start",
                "status": 413,
                "headers": [(b"content-type", b"application/json")],
            }
        )
        await send(
            {
                "type": "http.response.body",
                "body": b'{"detail":"Cuerpo demasiado grande"}',
            }
        )


class _CuerpoExcedido(Exception):
    pass


app.add_middleware(LimiteCuerpo)
app.include_router(catalog.router)
app.include_router(dashboard.router)
app.include_router(entrenamientos.router)
app.include_router(food.router)
app.include_router(perfil.router)
app.include_router(peso.router)
app.include_router(progreso.router)
app.include_router(routines.router)


@app.get("/api/health")
def salud() -> dict[str, str]:
    return {"estado": "ok"}


# Destino del link de confirmación de correo que manda Supabase. Nunca se armó
# deep-linking de vuelta a la app a propósito (más complejidad de la que esta
# fase necesitaba): esto reemplaza el "Site URL" por defecto de Supabase
# (http://localhost:3000, un remanente sin usar de la creación del proyecto),
# que rompía con "localhost rechazó la conexión" y dejaba a quien se registra
# sin saber si la cuenta quedó confirmada o no.
_HTML_CONFIRMADO = """<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Correo confirmado — FitTrack</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #0e0e10;
        color: #f0f2f6;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        text-align: center;
        padding: 24px;
      }
      .tarjeta { max-width: 360px; }
      .marca { color: #5f74e4; font-weight: 700; font-size: 15px; margin-bottom: 24px; }
      h1 { font-size: 22px; margin: 0 0 12px; }
      p { color: #8a8d95; font-size: 15px; line-height: 1.5; margin: 0; }
    </style>
  </head>
  <body>
    <div class="tarjeta">
      <div class="marca">FitTrack</div>
      <h1>Tu correo quedó confirmado</h1>
      <p>Ya puedes cerrar esta pestaña y volver a la app para iniciar sesión.</p>
    </div>
  </body>
</html>
"""


@app.get("/confirmado", response_class=HTMLResponse)
def confirmado() -> str:
    return _HTML_CONFIRMADO


@app.get("/api/me")
def me(user_id: str = Depends(get_current_user)) -> dict[str, str]:
    return {"user_id": user_id}
