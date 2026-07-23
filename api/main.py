from fastapi import Depends, FastAPI

from api.auth import get_current_user

app = FastAPI(title="FitTrack API")


@app.get("/api/health")
def salud() -> dict[str, str]:
    return {"estado": "ok"}


@app.get("/api/me")
def me(user_id: str = Depends(get_current_user)) -> dict[str, str]:
    return {"user_id": user_id}
