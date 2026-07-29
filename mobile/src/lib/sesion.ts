import AsyncStorage from '@react-native-async-storage/async-storage';

const CLAVE = 'fittrack:sesion';

// Los valores de las ruedas, en un solo lugar. Van de mayor a menor porque
// así deslizar hacia arriba muestra números más grandes, igual que el
// Picker.tsx de v1.
export const REPS = Array.from({ length: 30 }, (_, i) => 30 - i);
export const KILOS = Array.from({ length: 81 }, (_, i) => 200 - i * 2.5);

// Cuando el ejercicio nunca se hizo antes no hay default que usar.
export const REPS_INICIAL = 10;
export const KILOS_INICIAL = 20;

export type SerieBorrador = { reps: number; kg: number; completadaEn: string };

export type EjercicioBorrador = {
  catalogId: string;
  nombre: string;
  gifUrl: string;
  equipamiento: string;
  agregado: boolean;
  // Lo que hiciste la última vez, copiado al empezar. Va en el borrador y no
  // se vuelve a pedir: sin señal no hay a quién preguntarle.
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

/** El valor donde arranca la rueda: el default de la rutina, o el inicial. */
export function valorInicial(
  guardado: number | null,
  tipo: 'reps' | 'kg',
  equipamiento: string,
): number {
  if (guardado !== null) return guardado;
  if (tipo === 'reps') return REPS_INICIAL;
  return equipamiento === 'Peso corporal' ? 0 : KILOS_INICIAL;
}

/** El fin del entrenamiento: la última serie completada, NUNCA `now()`. */
export function finDelBorrador(borrador: BorradorSesion): string {
  const marcas = borrador.ejercicios.flatMap((e) => e.series.map((s) => s.completadaEn));
  return marcas.length > 0 ? marcas.sort().at(-1)! : borrador.iniciadoEn;
}
