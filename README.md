# FitTrack v2

Aplicación de seguimiento de entrenamiento y nutrición para un grupo cerrado: los usuarios se invitan desde el panel de Supabase, no hay registro público.

Reconstrucción completa de [fittrack](https://github.com/BlasterLc/fittrack), que queda archivado como referencia.

## Qué hace

- **Entrenamiento.** Rutinas propias, catálogo de 1.324 ejercicios con animaciones e instrucciones en español, y una pantalla de sesión para usar dentro del gimnasio: se marcan las series y se ajustan peso y repeticiones sin salir de ahí.
- **Nutrición.** Se describe la comida por texto, foto o voz; Claude estima calorías y macros; el usuario corrige y confirma antes de guardar.
- **Progreso.** Mapa anual de asistencia, series semanales por grupo muscular con rango objetivo, evolución del peso corporal e historial de entrenamientos.

## Stack

| Capa | Tecnología |
|---|---|
| App | React Native + Expo (iOS y Android) |
| API | FastAPI + SQLAlchemy 2.0 + Pydantic v2 |
| Base de datos | Supabase (PostgreSQL) |
| Identidad | Supabase Auth — la API valida el JWT, no lo emite |
| Animaciones | Supabase Storage, bucket público servido por CDN |
| Nutrición | Claude Haiku 4.5 |
| Infraestructura | Railway (API) + Supabase (datos, identidad y archivos) |

## Estructura

```
api/    Backend FastAPI. API pura, no sirve archivos estáticos.
app/    Aplicación React Native con Expo.
```

## Puesta en marcha

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env    # completar los valores
uvicorn api.main:app --reload
pytest -q
```

Las pruebas corren contra un PostgreSQL local (`TEST_DATABASE_URL`), nunca contra Supabase.

### Variables de entorno

| Variable | Dónde hace falta | Para qué |
|---|---|---|
| `DATABASE_URL` | local y producción | Postgres de Supabase, vía **Session pooler** y con prefijo `postgresql+psycopg://` |
| `SUPABASE_URL` | local y producción | Base de las URLs de Storage |
| `SUPABASE_JWT_SECRET` | local y producción | Valida la firma de los JWT que emite Supabase Auth |
| `SUPABASE_STORAGE_BUCKET` | opcional | Por defecto `exercise-gifs` |
| `TEST_DATABASE_URL` | solo local | Postgres local para las pruebas |
| `SUPABASE_SERVICE_ROLE_KEY` | solo local | La usa el script de subida de animaciones; **no se carga en producción** |
| `MEDIA_DIR` | solo local | De dónde lee los GIFs el script de subida |
| `ANTHROPIC_API_KEY` | solo local | Opcional: script de traducción del catálogo |

La conexión directa a Supabase (`db.<ref>.supabase.co`) es solo IPv6 y no funciona ni en WSL ni en Railway: hay que usar el **Session pooler**.

### Carga inicial del catálogo

Se ejecuta a mano una sola vez; no forma parte del arranque ni del despliegue.

```bash
python -m api.scripts.descargar     # dataset + 1.324 animaciones (~123 MB)
python -m api.scripts.ingestar      # catálogo a Postgres (idempotente)
python -m api.scripts.subir_gifs    # animaciones a Supabase Storage (idempotente)
```

`data/nombres_es.json` ya viene versionado con los 1.318 nombres traducidos, así que no hace falta volver a traducir ni tener `ANTHROPIC_API_KEY`.

## Datos de ejercicios

El catálogo proviene de [hasaneyldrm/exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset).

Las animaciones son propiedad de **Gym visual** (<https://gymvisual.com/>) y se redistribuyen con su permiso, a 180×180 y conservando la atribución. Cualquier uso de ese material debe respetar los [términos de Gym visual](https://gymvisual.com/content/3-terms-and-conditions-of-use).

## Licencia

Proyecto personal, sin licencia de distribución.
