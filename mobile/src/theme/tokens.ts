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
  accent: '#e0b341', // solo semántico: marca lo que necesita atención o falló
  // Acciones que pierden datos. Separado de accent porque el ámbar ya significa
  // "atención", y una acción destructiva necesita su propia señal inequívoca.
  danger: '#e5484d',
  // Los tres macros: relleno de barra en TarjetaCalorias y punto en MetasResumen,
  // nunca texto. Cada uno esquiva los colores ya reservados (índigo de marca,
  // ámbar de `accent`, rojo de `danger`) para que un macro no se lea como estado.
  // `prot` era `primary` clavado: la barra salía igual que el anillo de calorías.
  // `carb` era un oro casi idéntico a `accent`. Contraste sobre `surface2` (la
  // pista de la barra), que es lo que pide el 3:1 de objeto gráfico: prot 5,02 ·
  // carb 4,72 · fat 4,95.
  prot: '#e06aa0',
  carb: '#d9703a',
  fat: '#00a38f',
  // Superficie de la sesión de entrenamiento: estrategia "committed", el índigo
  // ocupa la pantalla entera para que el modo se lea sin leer. Solo acá.
  //
  // Retocado el 2026-08-09: el matiz original ya coincidía con `primary` (a
  // 3-4° en HSL, no era "el índigo equivocado"), pero saturaba 48-50% de
  // golpe contra un resto de la app casi acromático — de ahí la sensación de
  // "no combina". Mismo matiz (~231°), saturación bajada a ~25% y más oscuro,
  // validado con un mockup comparativo antes de tocar el código. Los cuatro
  // colores de acento de abajo (`sesionBorde`/`sesionInk`/`sesionMuted`/
  // `sesionDanger`) no cambiaron: un fondo más oscuro solo mejora su
  // contraste, nunca lo empeora, así que se recalcularon las cifras de los
  // comentarios pero no los valores.
  sesionBg: '#171926',
  sesionSurface: '#212436',
  // Separadores: no delimitan nada tocable, así que no les aplica el 3:1 y
  // pueden quedar tenues.
  sesionLine: '#2a2e46',
  // El contorno de un control SÍ necesita 3:1 (WCAG 1.4.11), y `sesionLine`
  // da 1,59:1 sobre `sesionBg`: «Terminar» y «+ Agregar serie» son botones
  // contorneados, así que el borde es su único límite visual y era invisible.
  // Este da 4,76:1 sobre `sesionBg` y 4,18:1 sobre `sesionSurface`.
  sesionBorde: '#7080d4',
  sesionInk: '#dfe3ff',
  // `muted` da 4,00:1 sobre `sesionBg` (falla el 4,5:1 de texto normal, es un
  // fondo más claro que los del resto de la app). Este gris es apenas más
  // claro y da 6,12:1 sobre `sesionBg` y 5,38:1 sobre `sesionSurface`: mismo
  // rol de "sin énfasis", pero acá nomás.
  sesionMuted: '#9599a3',
  // Mismo problema que `sesionMuted`, pero con `danger`: da 3,98:1 sobre
  // `sesionSurface` y 3,39:1 sobre `sesionBg` (Tarea 11, tarjeta de la serie
  // activa), y ambos fallan el 4,5:1 de texto normal aunque en el resto de la
  // app (sobre `bg`/`surface`) sí llega. Este rojo es más claro y da 6,07:1
  // sobre `sesionBg` y 5,33:1 sobre `sesionSurface`: mismo rol de "acción que
  // pierde datos", pero solo dentro de la sesión.
  sesionDanger: '#eb7478',
  // Rampa del mapa de asistencia: monótona y de pasos parejos (L 0,37 → 0,52 →
  // 0,69). El tono codifica la DURACIÓN del día, no la cantidad de series:
  // entre 12 y 15 series no hay diferencia perceptible, así que cuatro tonos
  // por cantidad eran precisión falsa.
  mapaVacio: '#232327',
  mapaCorta: '#2f3a70', // menos de 40 min
  mapaNormal: '#4a5cc4', // 40 a 70
  mapaLarga: '#8093f0', // más de 70
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
