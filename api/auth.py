import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient

from api.config import Config

_bearer = HTTPBearer(auto_error=False)

_jwks_client: PyJWKClient | None = None


def _get_jwks_client(jwks_url: str) -> PyJWKClient:
    """Cliente JWKS cacheado (una sola vez por proceso). Descarga y guarda
    las llaves públicas del proyecto de Supabase para validar los tokens
    firmados de forma asimétrica."""
    global _jwks_client
    if _jwks_client is None:
        _jwks_client = PyJWKClient(jwks_url)
    return _jwks_client


def get_current_user(
    credenciales: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> str:
    """Valida el JWT emitido por Supabase Auth y devuelve el UUID del usuario.

    Confía en Supabase para la identidad. Soporta las dos formas de firma:

    - **ES256/RS256 (asimétrica):** es como firma Supabase los tokens reales.
      Se valida contra las llaves públicas publicadas en el JWKS del proyecto.
    - **HS256 (secreto compartido):** solo con `ALLOW_HS256_TESTS=1` (tests);
      en producción se rechaza. Los tokens de prueba se firman con
      `SUPABASE_JWT_SECRET` sin tocar la red.

    En ambos casos comprueba la firma, la audiencia y la expiración, y
    devuelve el claim `sub`. No consulta ninguna tabla de usuarios: no existe.
    """
    no_autenticado = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido o expirado"
    )
    if credenciales is None:
        raise no_autenticado

    token = credenciales.credentials
    config = Config()
    try:
        algoritmo = jwt.get_unverified_header(token).get("alg")
        if algoritmo == "HS256":
            # Rama solo de pruebas: en producción un secreto filtrado o débil
            # permitiría forjar cualquier identidad, así que está apagada.
            if not (config.allow_hs256_tests and config.supabase_jwt_secret):
                raise no_autenticado
            datos = jwt.decode(
                token,
                config.supabase_jwt_secret,
                algorithms=["HS256"],
                audience="authenticated",
                options={"require": ["exp", "sub"]},
            )
        else:
            jwks_url = f"{config.supabase_url}/auth/v1/.well-known/jwks.json"
            llave = _get_jwks_client(jwks_url).get_signing_key_from_jwt(token)
            datos = jwt.decode(
                token,
                llave.key,
                algorithms=["ES256", "RS256"],
                audience="authenticated",
                issuer=f"{config.supabase_url.rstrip('/')}/auth/v1",
                options={"require": ["exp", "sub"]},
            )
    except jwt.PyJWTError:
        raise no_autenticado

    user_id = datos.get("sub")
    if not user_id:
        raise no_autenticado
    return user_id
