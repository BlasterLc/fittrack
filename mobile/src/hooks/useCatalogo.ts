import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';

export type EjercicioResumen = {
  id: string;
  nombre_es: string;
  body_part_es: string;
  equipment_es: string;
  target_es: string;
  gif_path: string;
  gif_url: string;
};

export type EjercicioFicha = EjercicioResumen & {
  secondary_muscles: string[];
  instrucciones_es: string[];
  atribucion: string;
};

export type FiltrosDisponibles = {
  grupos_musculares: string[];
  equipamientos: string[];
};

type PaginaBusqueda = { total: number; resultados: EjercicioResumen[] };

const POR_PAGINA = 50;
const UN_DIA = 24 * 60 * 60 * 1000;

export function useFiltros() {
  return useQuery({
    queryKey: ['catalogo', 'filtros'],
    queryFn: () => apiGet<FiltrosDisponibles>('/api/catalog/filtros'),
    // Solo cambian si se vuelve a correr la ingesta.
    staleTime: UN_DIA,
  });
}

export function useBuscarCatalogo(q: string, grupo: string | null, equipo: string | null) {
  return useInfiniteQuery({
    queryKey: ['catalogo', { q, grupo, equipo }],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (grupo) params.set('body_part', grupo);
      if (equipo) params.set('equipment', equipo);
      params.set('limite', String(POR_PAGINA));
      params.set('desplazamiento', String(pageParam));
      return apiGet<PaginaBusqueda>(`/api/catalog/search?${params.toString()}`);
    },
    // El backend no da "próxima página": se infiere sumando lo ya cargado
    // y comparando contra el total. undefined le dice a TanStack Query
    // que no hay más para pedir.
    getNextPageParam: (ultima, todas) => {
      const cargados = todas.reduce((suma, p) => suma + p.resultados.length, 0);
      return cargados < ultima.total ? cargados : undefined;
    },
  });
}

export function useFicha(id: string) {
  return useQuery({
    queryKey: ['catalogo', 'ficha', id],
    queryFn: () => apiGet<EjercicioFicha>(`/api/catalog/${id}`),
    enabled: Boolean(id),
  });
}
