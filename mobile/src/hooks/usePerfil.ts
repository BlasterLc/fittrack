import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut } from '@/lib/api';
import type { FichaBorrador, Perfil, Previsualizacion } from '@/lib/perfil';

export function usePerfil() {
  return useQuery({
    queryKey: ['perfil'],
    queryFn: () => apiGet<Perfil>('/api/profile'),
  });
}

export function useGuardarPerfil() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (ficha: FichaBorrador) => apiPut<Perfil>('/api/profile', ficha),
    onSuccess: (perfil) => {
      // El perfil recién guardado ya viene en la respuesta: se siembra en vez
      // de pedirlo de nuevo.
      cliente.setQueryData(['perfil'], perfil);
      // El dashboard muestra la meta de calorías, así que cambió.
      cliente.invalidateQueries({ queryKey: ['dashboard'] });
      // Un peso nuevo desde Perfil crea un registro en el historial (ver
      // services/perfil.py): Progreso tiene que verlo sin esperar un remount.
      cliente.invalidateQueries({ queryKey: ['progreso', 'peso'] });
    },
  });
}

/**
 * Las metas que darían los datos del borrador, sin guardarlos.
 *
 * Va como consulta y no como mutación porque es una lectura: se cachea por
 * borrador, así volver atrás en el asistente no dispara otra llamada. Quien
 * la use tiene que pasar el borrador ya "debounceado" (ver useDebounce): sin
 * eso, cada tecla del campo de peso sería una petición.
 */
export function usePrevisualizacion(ficha: FichaBorrador, habilitada = true) {
  return useQuery({
    queryKey: ['perfil', 'preview', ficha],
    queryFn: () => apiPost<Previsualizacion>('/api/profile/preview', ficha),
    enabled: habilitada,
    // Los datos de una ficha dada no cambian nunca: la fórmula es pura.
    staleTime: Infinity,
  });
}
