# FitTrack v2

Aplicación personal de seguimiento de entrenamiento y nutrición. Un solo usuario.

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
| Base de datos | PostgreSQL |
| Nutrición | Claude Haiku 4.5 |
| Infraestructura | Railway |

## Estructura

```
api/    Backend FastAPI. API pura, no sirve archivos estáticos.
app/    Aplicación React Native con Expo.
```

## Puesta en marcha

Pendiente: se documenta al completar la fase 1.

## Datos de ejercicios

El catálogo proviene de [hasaneyldrm/exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset).

Las animaciones son propiedad de **Gym visual** (<https://gymvisual.com/>) y se redistribuyen con su permiso, a 180×180 y conservando la atribución. Cualquier uso de ese material debe respetar los [términos de Gym visual](https://gymvisual.com/content/3-terms-and-conditions-of-use).

## Licencia

Proyecto personal, sin licencia de distribución.
