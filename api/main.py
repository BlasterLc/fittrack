from fastapi import Depends, FastAPI

from api.auth import get_current_user
from api.routers import catalog, dashboard, entrenamientos, food, perfil, routines

app = FastAPI(title="FitTrack API")
app.include_router(catalog.router)
app.include_router(dashboard.router)
app.include_router(entrenamientos.router)
app.include_router(food.router)
app.include_router(perfil.router)
app.include_router(routines.router)


@app.get("/api/health")
def salud() -> dict[str, str]:
    return {"estado": "ok"}


@app.get("/api/me")
def me(user_id: str = Depends(get_current_user)) -> dict[str, str]:
    return {"user_id": user_id}
