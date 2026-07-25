import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPost } from '@/lib/api';

export type ItemComida = {
  nombre: string;
  calorias: number;
  prot_g: number;
  carbs_g: number;
  fat_g: number;
};

export function useAnalizarComida() {
  return useMutation({
    mutationFn: (body: { texto?: string; imagen_base64?: string }) =>
      apiPost<{ items: ItemComida[] }>('/api/food/analyze', body),
  });
}

export function useRegistrarComida() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { items: ItemComida[]; etiqueta?: string }) =>
      apiPost<{ id: number }>('/api/food/log', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

// Nombres chilenos, sugeridos según la hora.
export function etiquetaPorHora(fecha = new Date()): string {
  const h = fecha.getHours();
  if (h >= 5 && h < 11) return 'Desayuno';
  if (h >= 11 && h < 15) return 'Almuerzo';
  if (h >= 15 && h < 20) return 'Once';
  if (h >= 20) return 'Cena';
  return 'Colación';
}
