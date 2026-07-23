import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from api.config import Config

_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    credenciales: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> str:
    """Valida el JWT emitido por Supabase Auth y devuelve el UUID del usuario.

    Confía en Supabase para la identidad: comprueba la firma (HS256 con el
    secreto del proyecto), la audiencia y la expiración, y devuelve el claim
    `sub`. No consulta ninguna tabla de usuarios: no existe.
    """
    no_autenticado = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido o expirado"
    )
    if credenciales is None:
        raise no_autenticado
    try:
        datos = jwt.decode(
            credenciales.credentials,
            Config().supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except jwt.PyJWTError:
        raise no_autenticado
    user_id = datos.get("sub")
    if not user_id:
        raise no_autenticado
    return user_id
