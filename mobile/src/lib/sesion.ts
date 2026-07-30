import AsyncStorage from '@react-native-async-storage/async-storage';

const CLAVE = 'fittrack:sesion';

// Límites de lo que se puede registrar. Los kilos arrancan en 2,5 y no en 0:
// registrar "0 kg" no significaba nada útil ni siquiera en peso corporal, y
// dejaba elegir un valor que la app tenía que interpretar aparte.
export const KG_MIN = 2.5;
export const KG_MAX = 200;
export const REPS_MIN = 1;
export const REPS_MAX = 30;

// Con qué nace una fila cuando el ejercicio nunca se hizo antes.
export const REPS_INICIAL = 10;
export const KILOS_INICIAL = 20;

export type SerieBorrador = {
  reps: number;
  kg: number;
  // null mientras la serie está planificada y todavía no se hizo. La marca de
  // tiempo la pone el ✓, y es lo único que distingue una serie hecha de una
  // que quedó pendiente: solo las hechas se guardan y solo ellas cuentan para
  // el descanso y para el fin del entrenamiento.
  completadaEn: string | null;
};

export type EjercicioBorrador = {
  catalogId: string;
  nombre: string;
  gifUrl: string;
  equipamiento: string;
  agregado: boolean;
  // Lo que hiciste la última vez, copiado al empezar. Va en el borrador y no
  // se vuelve a pedir: sin señal no hay a quién preguntarle. Alimenta la
  // columna «Previa» de la tabla y los valores con que nacen las filas.
  repsDefault: number | null;
  kgDefault: number | null;
  series: SerieBorrador[];
};

export type BorradorSesion = {
  clientId: string;
  rutinaId: number;
  nombreRutina: string;
  iniciadoEn: string;
  terminadoEn: string | null;
  indiceActual: number;
  ejercicios: EjercicioBorrador[];
};

export async function leerBorrador(): Promise<BorradorSesion | null> {
  const crudo = await AsyncStorage.getItem(CLAVE);
  if (!crudo) return null;
  try {
    return JSON.parse(crudo) as BorradorSesion;
  } catch {
    // Un borrador corrupto no puede dejar la app trabada en Gym.
    await AsyncStorage.removeItem(CLAVE);
    return null;
  }
}

export async function escribirBorrador(borrador: BorradorSesion): Promise<void> {
  await AsyncStorage.setItem(CLAVE, JSON.stringify(borrador));
}

export async function borrarBorrador(): Promise<void> {
  await AsyncStorage.removeItem(CLAVE);
}

export function esDeHoy(iso: string): boolean {
  const fecha = new Date(iso);
  const hoy = new Date();
  return (
    fecha.getFullYear() === hoy.getFullYear() &&
    fecha.getMonth() === hoy.getMonth() &&
    fecha.getDate() === hoy.getDate()
  );
}

/** Las series efectivamente hechas. Las planificadas no existen para nadie más. */
export function seriesHechas(ejercicio: EjercicioBorrador): SerieBorrador[] {
  return ejercicio.series.filter((s) => s.completadaEn !== null);
}

/** Cuántas series se hicieron en todo el entrenamiento. */
export function totalSeriesHechas(borrador: BorradorSesion): number {
  return borrador.ejercicios.reduce((n, e) => n + seriesHechas(e).length, 0);
}

/**
 * El valor donde nace una fila: el default de la rutina, o el inicial.
 *
 * Se normaliza siempre, incluso lo que viene del servidor: hay rutinas con
 * `weight_default` en 0 guardado antes de que el mínimo pasara a 2,5, y sin
 * esto la fila nacería con un valor que la app ya no deja elegir.
 */
export function valorInicial(guardado: number | null, tipo: 'reps' | 'kg'): number {
  if (tipo === 'reps') return normalizarReps(guardado ?? REPS_INICIAL);
  return normalizarKg(guardado ?? KILOS_INICIAL);
}

/** Redondea a la baja al medio kilo y lo deja dentro de los límites. */
export function normalizarKg(valor: number): number {
  if (!Number.isFinite(valor)) return KG_MIN;
  return Math.min(KG_MAX, Math.max(KG_MIN, Math.round(valor * 2) / 2));
}

/** Entero de repeticiones dentro de los límites. */
export function normalizarReps(valor: number): number {
  if (!Number.isFinite(valor)) return REPS_MIN;
  return Math.min(REPS_MAX, Math.max(REPS_MIN, Math.round(valor)));
}

/**
 * Lee lo que se tecleó en un campo numérico.
 *
 * Acepta coma además de punto: el teclado decimal en español manda coma, y sin
 * esto «82,5» se leería como NaN y el campo volvería solo al valor anterior.
 */
export function leerNumero(texto: string): number {
  return Number.parseFloat(texto.replace(',', '.'));
}

/** Sin decimal cuando es redondo: «80», pero «82.5». */
export function formatoKg(kg: number): string {
  return Number.isInteger(kg) ? String(kg) : kg.toFixed(1);
}

/** El fin del entrenamiento: la última serie hecha, NUNCA `now()`. */
export function finDelBorrador(borrador: BorradorSesion): string {
  const marcas = borrador.ejercicios.flatMap((e) =>
    seriesHechas(e).map((s) => s.completadaEn as string),
  );
  return marcas.length > 0 ? marcas.sort().at(-1)! : borrador.iniciadoEn;
}
