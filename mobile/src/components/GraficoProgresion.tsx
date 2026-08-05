import { useMemo } from 'react';
import { GraficoLineas } from '@/components/GraficoLineas';
import { useProgresionEjercicio } from '@/hooks/useProgreso';
import { formatoKg } from '@/lib/sesion';

export function GraficoProgresion({ catalogId }: { catalogId: string }) {
  const progresion = useProgresionEjercicio(catalogId);

  // La API devuelve de la más reciente a la más vieja; el gráfico se lee de
  // izquierda (vieja) a derecha (reciente), como el resto de la app.
  const sesiones = useMemo(
    () => (progresion.data?.pages.flat() ?? []).slice().reverse(),
    [progresion.data],
  );

  const puntos = sesiones.map((s) => ({ valor: s.max_weight_kg }));
  const ultimo = sesiones[sesiones.length - 1];
  const pesos = sesiones.map((s) => s.max_weight_kg);
  const minimo = pesos.length ? Math.min(...pesos) : 0;
  const maximo = pesos.length ? Math.max(...pesos) : 0;

  return (
    <GraficoLineas
      titulo="Progresión"
      puntos={puntos}
      ultimoValorTexto={ultimo ? `${formatoKg(ultimo.max_weight_kg)} kg` : ''}
      ultimoEtiqueta="último máximo"
      accessibilityLabel={`Progresión: ${sesiones.length} sesiones, de ${formatoKg(minimo)} a ${formatoKg(maximo)} kg`}
      cargando={progresion.isPending}
      error={progresion.isError}
      errorTexto="No pudimos cargar la progresión"
      vacioTexto="Sin registros todavía"
      hasNextPage={progresion.hasNextPage}
      isFetchingNextPage={progresion.isFetchingNextPage}
      fetchNextPage={progresion.fetchNextPage}
      onReintentar={() => progresion.refetch()}
    />
  );
}
