import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';

export type DiaEntrenado = { started_at: string; minutos: number };
export type SeriesDeGrupo = { grupo: string; series: number };
export type SesionDeProgresion = { started_at: string; max_weight_kg: number };

export type SerieDeHistorial = { orden: number; reps: number; weight_kg: number };
export type EjercicioDeHistorial = {
  catalog_id: string;
  nombre_es: string;
  series: SerieDeHistorial[];
};
export type EntrenamientoDeHistorial = {
  id: number;
  nombre_rutina: string | null;
  started_at: string;
  duracion_min: number;
  total_series: number;
  total_ejercicios: number;
  ejercicios: EjercicioDeHistorial[];
};

/** Medianoche local del día de esa fecha. */
function medianoche(fecha: Date): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
}

/**
 * La semana en curso, de lunes 00:00 local al lunes siguiente.
 *
 * `getDay()` devuelve 0 para el domingo, así que `(dia + 6) % 7` deja el lunes
 * en 0 y el domingo en 6. Sin eso, el domingo empezaría una semana nueva.
 */
export function ventanaDeLaSemana(ahora = new Date()): { desde: string; hasta: string } {
  const desdeElLunes = (ahora.getDay() + 6) % 7;
  const hoy = medianoche(ahora);
  const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - desdeElLunes);
  const fin = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + 7);
  return { desde: inicio.toISOString(), hasta: fin.toISOString() };
}

/**
 * El año hacia atrás, que es lo que se le pide siempre al mapa.
 *
 * Son ~150 filas incluso entrenando cinco veces por semana, así que no vale la
 * pena una request previa para averiguar desde cuándo hay datos: se pide todo y
 * la pantalla decide cuánto dibuja.
 */
export function ventanaDelAno(ahora = new Date()): { desde: string; hasta: string } {
  const hoy = medianoche(ahora);
  const inicio = new Date(hoy.getFullYear() - 1, hoy.getMonth(), hoy.getDate());
  const fin = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1);
  return { desde: inicio.toISOString(), hasta: fin.toISOString() };
}

/** Clave de día local. NO se puede usar toISOString(): eso da el día UTC. */
export function claveDeDia(fecha: Date): string {
  return `${fecha.getFullYear()}-${fecha.getMonth()}-${fecha.getDate()}`;
}

export function useMapa() {
  const { desde, hasta } = ventanaDelAno();
  return useQuery({
    // `desde` entra en la clave para que cruzar la medianoche con la app
    // abierta no siga sirviendo la ventana de ayer.
    queryKey: ['progreso', 'mapa', desde],
    queryFn: () =>
      apiGet<DiaEntrenado[]>(
        `/api/progress/heatmap?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`,
      ),
  });
}

export function useSeriesPorGrupo() {
  const { desde, hasta } = ventanaDeLaSemana();
  return useQuery({
    queryKey: ['progreso', 'grupos', desde],
    queryFn: () =>
      apiGet<SeriesDeGrupo[]>(
        `/api/progress/sets-by-muscle?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`,
      ),
  });
}

/** Cuántos entrenamientos trae cada página del historial. */
const PAGINA = 20;

/**
 * El historial, paginado hacia atrás por cursor.
 *
 * A diferencia del catálogo (que pagina por desplazamiento numérico, porque
 * el backend le devuelve un `total` contra el que comparar), acá la respuesta
 * es solo el arreglo de entrenamientos, sin total. El cursor es el
 * `started_at` del último recibido: paginar por número de página se
 * desordena si entra un entrenamiento nuevo mientras se navega hacia atrás.
 * Una página incompleta (menos de `PAGINA` filas) es la señal de que no hay
 * más atrás, en vez del cociente contra un total.
 */
export function useHistorial() {
  return useInfiniteQuery({
    queryKey: ['progreso', 'historial'],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      apiGet<EntrenamientoDeHistorial[]>(
        `/api/workouts?limite=${PAGINA}` +
          (pageParam ? `&hasta=${encodeURIComponent(pageParam)}` : ''),
      ),
    // Una página incompleta significa que no hay más atrás. Sin esto, la app
    // seguiría pidiendo páginas vacías para siempre.
    getNextPageParam: (ultima) =>
      ultima.length < PAGINA ? undefined : ultima[ultima.length - 1].started_at,
  });
}

/** Cuántas sesiones trae cada página del gráfico de progresión. */
const LIMITE_PROGRESION = 12;

/**
 * El peso máximo por sesión de un ejercicio, paginado hacia atrás por cursor.
 *
 * A diferencia de `useMapa` (que mide la ventana en semanas calendario), aquí
 * la ventana son las últimas SESIONES donde apareció el ejercicio: un
 * ejercicio puede hacerse cada varias semanas y una ventana calendario
 * dejaría casi todo vacío.
 */
export function useProgresionEjercicio(catalogId: string) {
  return useInfiniteQuery({
    queryKey: ['progreso', 'ejercicio', catalogId],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      apiGet<SesionDeProgresion[]>(
        `/api/progress/exercise/${catalogId}?limite=${LIMITE_PROGRESION}` +
          (pageParam ? `&hasta=${encodeURIComponent(pageParam)}` : ''),
      ),
    getNextPageParam: (ultima) =>
      ultima.length < LIMITE_PROGRESION ? undefined : ultima[ultima.length - 1].started_at,
  });
}
