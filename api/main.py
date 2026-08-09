from fastapi import Depends, FastAPI
from fastapi.responses import HTMLResponse

from api.auth import get_current_user
from api.routers import catalog, dashboard, entrenamientos, food, perfil, peso, progreso, routines

app = FastAPI(title="FitTrack API")
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
