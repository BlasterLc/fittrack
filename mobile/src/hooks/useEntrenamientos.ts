import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPost } from '@/lib/api';
import { finDelBorrador, seriesHechas, type BorradorSesion } from '@/lib/sesion';

export type EntrenamientoGuardado = {
  id: number;
  duracion_min: number;
  total_series: number;
  total_ejercicios: number;
  ejercicios: { catalog_id: string; nombre_es: string; series: { orden: number; reps: number; weight_kg: number }[] }[];
  omitidos: string[];
};

function aCuerpo(borrador: BorradorSesion, agregarARutina: string[]) {
  return {
    client_id: borrador.clientId,
    routine_id: borrador.rutinaId,
    started_at: borrador.iniciadoEn,
    // El fin es la última serie, no ahora: un borrador retomado de otro día
    // guardaría un entrenamiento de 72 horas.
    ended_at: borrador.terminadoEn ?? finDelBorrador(borrador),
    // Solo lo que se hizo de verdad: las series planificadas que quedaron sin
    // marcar no son parte del entrenamiento, y un ejercicio que quedó entero
    // sin hacer no viaja. El backend además exige al menos una serie por
    // ejercicio, así que mandar una lista vacía sería un 422.
    ejercicios: borrador.ejercicios
      .map((e) => ({ ejercicio: e, hechas: seriesHechas(e) }))
      .filter(({ hechas }) => hechas.length > 0)
      .map(({ ejercicio, hechas }, i) => ({
        catalog_id: ejercicio.catalogId,
        orden: i,
        series: hechas.map((s, j) => ({
          orden: j,
          reps: s.reps,
          weight_kg: s.kg,
          completed_at: s.completadaEn,
        })),
      })),
    agregar_a_rutina: agregarARutina,
  };
}

/**
 * Guarda el entrenamiento en el backend.
 *
 * Invalida `['dashboard']` porque Hoy incluye el entrenamiento del día
 * (Tarea 6), e invalida `['rutinas']` porque guardar reescribe los
 * `*_default` de la rutina (Tarea 4): sin esto, volver al detalle de la
 * rutina mostraría los defaults viejos. El prefijo `['rutinas']` alcanza
 * para la lista y el detalle, igual que en `useRutinas.ts`.
 */
export function useGuardarEntrenamiento() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: ({ borrador, agregarARutina }: { borrador: BorradorSesion; agregarARutina: string[] }) =>
      apiPost<EntrenamientoGuardado>('/api/workouts', aCuerpo(borrador, agregarARutina)),
    onSuccess: () => {
      cliente.invalidateQueries({ queryKey: ['dashboard'] });
      cliente.invalidateQueries({ queryKey: ['rutinas'] });
    },
  });
}
