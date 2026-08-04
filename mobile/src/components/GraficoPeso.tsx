// mobile/src/components/GraficoPeso.tsx
import { GraficoLineas } from '@/components/GraficoLineas';
import { type RegistroPeso } from '@/hooks/useProgreso';
import { formatoKg } from '@/lib/sesion';

export function GraficoPeso({
  registros,
  cargando,
  error,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  onReintentar,
}: {
  /** De más viejo a más reciente, igual que espera GraficoLineas. */
  registros: RegistroPeso[];
  cargando: boolean;
  error: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => Promise<unknown>;
  onReintentar: () => void;
}) {
  const puntos = registros.map((r) => ({ valor: r.kg }));
  const ultimo = registros[registros.length - 1];
  const valores = registros.map((r) => r.kg);
  const minimo = valores.length ? Math.min(...valores) : 0;
  const maximo = valores.length ? Math.max(...valores) : 0;

  return (
    <GraficoLineas
      titulo="Peso"
      puntos={puntos}
      ultimoValorTexto={ultimo ? `${formatoKg(ultimo.kg)} kg` : ''}
      ultimoEtiqueta="último registro"
      accessibilityLabel={`Peso: ${registros.length} registros, de ${formatoKg(minimo)} a ${formatoKg(maximo)} kg`}
      cargando={cargando}
      error={error}
      vacioTexto="Sin registros de peso todavía"
      hasNextPage={hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
      fetchNextPage={fetchNextPage}
      onReintentar={onReintentar}
    />
  );
}
