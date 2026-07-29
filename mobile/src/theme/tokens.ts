export const colors = {
  bg: '#0e0e10',
  surface: '#1a1a1d',
  surface2: '#232327',
  line: '#2e2f34',
  ink: '#f0f2f6',
  muted: '#8a8d95',
  primary: '#5f74e4',
  // El índigo de marca SOLO sirve como relleno (con `ink` encima). Como texto
  // no llega a 4,5:1 en ningún fondo salvo `bg`, y ahí pasa por un 4%: da 4,69
  // sobre bg, 4,22 sobre surface y 3,81 sobre surface2. Este es el mismo tono
  // aclarado para usarlo como texto: 6,68 / 6,02 / 5,42.
  primaryText: '#7b90ff',
  accent: '#e0b341', // solo semántico
  // Acciones que pierden datos. Separado de accent porque el ámbar ya lo usan
  // los carbohidratos, y un color con dos significados no significa nada.
  danger: '#e5484d',
  prot: '#5f74e4',
  carb: '#c18500',
  fat: '#00a38f',
  // Superficie de la sesión de entrenamiento: estrategia "committed", el índigo
  // ocupa la pantalla entera para que el modo se lea sin leer. Solo acá.
  sesionBg: '#232a63',
  sesionSurface: '#1a1f4d',
  // Separadores: no delimitan nada tocable, así que no les aplica el 3:1 y
  // pueden quedar tenues.
  sesionLine: '#3a44a0',
  // El contorno de un control SÍ necesita 3:1 (WCAG 1.4.11), y `sesionLine`
  // da 1,59:1 sobre `sesionBg`: «Terminar» y «+ Agregar serie» son botones
  // contorneados, así que el borde es su único límite visual y era invisible.
  // Este da 3,62:1 sobre `sesionBg` y 4,25:1 sobre `sesionSurface`.
  sesionBorde: '#7080d4',
  sesionInk: '#dfe3ff',
  // `muted` da 4,00:1 sobre `sesionBg` (falla el 4,5:1 de texto normal, es un
  // fondo más claro que los del resto de la app). Este gris es apenas más
  // claro y da 4,65:1: mismo rol de "sin énfasis", pero acá nomás.
  sesionMuted: '#9599a3',
  // Mismo problema que `sesionMuted`, pero con `danger`: da 3,98:1 sobre
  // `sesionSurface` y 3,39:1 sobre `sesionBg` (Tarea 11, tarjeta de la serie
  // activa), y ambos fallan el 4,5:1 de texto normal aunque en el resto de la
  // app (sobre `bg`/`surface`) sí llega. Este rojo es más claro y da 5,42:1 /
  // 4,61:1 en esos mismos fondos: mismo rol de "acción que pierde datos",
  // pero solo dentro de la sesión.
  sesionDanger: '#eb7478',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const fonts = {
  regular: 'Rubik_400Regular',
  medium: 'Rubik_500Medium',
  semibold: 'Rubik_600SemiBold',
  bold: 'Rubik_700Bold',
} as const;

export const fontSize = {
  sm: 13,
  base: 15,
  lg: 18,
  xl: 24,
  xxl: 34,
} as const;
