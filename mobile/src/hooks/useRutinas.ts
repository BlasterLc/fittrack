import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPatch, apiPost, apiPut } from '@/lib/api';
import type { EjercicioResumen } from '@/hooks/useCatalogo';

export type RutinaEnLista = {
  id: number;
  nombre: string;
  archived_at: string | null;
  total_ejercicios: number;
  grupos_musculares: string[];
};

export type EjercicioDeRutina = EjercicioResumen & {
  sets_default: number | null;
  reps_default: number | null;
  weight_default: number | null;
};

export type RutinaDetalle = {
  id: number;
  nombre: string;
  archived_at: string | null;
  ejercicios: EjercicioDeRutina[];
  ejercicios_faltantes: number;
};

export type GuardarRutina = { nombre: string; catalog_ids: string[] };

export function useRutinas(archivadas: boolean) {
  return useQuery({
    queryKey: ['rutinas', { archivadas }],
    queryFn: () => apiGet<RutinaEnLista[]>(`/api/routines?archivadas=${archivadas}`),
  });
}

/**
 * El detalle de una rutina, como descriptor suelto.
 *
 * Existe aparte del hook porque «Empezar» lo necesita de forma imperativa, al
 * tocar: la lista solo trae resúmenes y el borrador de la sesión se arma con
 * los ejercicios y sus defaults. Compartir el descriptor mantiene una sola
 * `queryKey`, así que el fetch imperativo aprovecha lo que el hook ya cacheó.
 */
export function rutinaDetalleQuery(id: number | null) {
  return {
    queryKey: ['rutinas', 'detalle', id],
    queryFn: () => apiGet<RutinaDetalle>(`/api/routines/${id}`),
  };
}

export function useRutina(id: number | null) {
  return useQuery({
    ...rutinaDetalleQuery(id),
    // id null significa "rutina nueva": no hay nada que traer.
    enabled: id !== null,
  });
}

export function useCrearRutina() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (body: GuardarRutina) => apiPost<RutinaDetalle>('/api/routines', body),
    onSuccess: () => cliente.invalidateQueries({ queryKey: ['rutinas'] }),
  });
}

export function useGuardarRutina(id: number) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (body: GuardarRutina) =>
      apiPut<RutinaDetalle>(`/api/routines/${id}`, body),
    onSuccess: () => cliente.invalidateQueries({ queryKey: ['rutinas'] }),
  });
}

export function useArchivarRutina() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: ({ id, archivada }: { id: number; archivada: boolean }) =>
      apiPatch<RutinaDetalle>(`/api/routines/${id}`, { archivada }),
    onSuccess: () => cliente.invalidateQueries({ queryKey: ['rutinas'] }),
  });
}
