import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';

export type ResumenDia = {
  calorias: { consumidas: number; meta: number };
  macros: { prot: number; carb: number; fat: number };
  entrenamiento: { series: number; duracion_min: number } | null;
  peso: { kg: number; fecha: string } | null;
};

/**
 * La ventana del día del usuario, en horario local.
 *
 * `new Date(año, mes, día)` construye medianoche LOCAL, y `toISOString()` la
 * pasa al UTC equivalente. Es el mismo cálculo que ya hacía el historial de
 * comidas, y va acá para que las dos pantallas no discrepen sobre qué día es
 * hoy: cortando en medianoche UTC, en Chile todo lo hecho después de las
 * 20:00 contaba para el día siguiente.
 */
export function ventanaDeHoy(ahora = new Date()): { desde: string; hasta: string } {
  const inicio = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  const fin = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + 1);
  return { desde: inicio.toISOString(), hasta: fin.toISOString() };
}

export function useDashboard() {
  const { desde, hasta } = ventanaDeHoy();
  return useQuery({
    // La fecha entra en la clave: si la app queda abierta y cruza la
    // medianoche, la consulta de ayer no se puede seguir sirviendo como si
    // fuera la de hoy.
    queryKey: ['dashboard', desde],
    queryFn: () =>
      apiGet<ResumenDia>(
        `/api/dashboard?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`,
      ),
  });
}
