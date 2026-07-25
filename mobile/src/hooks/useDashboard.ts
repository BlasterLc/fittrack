import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';

export type ResumenDia = {
  calorias: { consumidas: number; meta: number };
  macros: { prot: number; carb: number; fat: number };
  entrenamiento: { series: number; duracion_min: number } | null;
  peso: { kg: number; fecha: string } | null;
};

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => apiGet<ResumenDia>('/api/dashboard'),
  });
}
