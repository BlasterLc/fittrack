import { View, Text, ScrollView, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EncabezadoPantalla } from '@/components/EncabezadoPantalla';
import { MapaAsistencia } from '@/components/MapaAsistencia';
import { SeriesPorGrupo } from '@/components/SeriesPorGrupo';
import { HistorialEntrenamientos } from '@/components/HistorialEntrenamientos';
import { useMapa, useSeriesPorGrupo, useHistorial } from '@/hooks/useProgreso';
import { colors, spacing, fonts, fontSize } from '@/theme/tokens';

/**
 * Envuelve un bloque para que falle solo.
 *
 * Los tres llegan por endpoints separados: que se caiga el historial no puede
 * dejar la pestaña en blanco, y el mapa no debería esperar al historial para
 * dibujarse.
 */
function Bloque({
  cargando,
  error,
  children,
}: {
  cargando: boolean;
  error: boolean;
  children: React.ReactNode;
}) {
  if (cargando) return <View style={styles.esqueleto} />;
  if (error) {
    return (
      <View style={styles.error}>
        {/* Ámbar y no rojo: el rojo queda para lo que pierde datos. */}
        <Text style={styles.errorTexto}>No pudimos cargar esta parte. Desliza para reintentar.</Text>
      </View>
    );
  }
  return <>{children}</>;
}

export default function Progreso() {
  const mapa = useMapa();
  const grupos = useSeriesPorGrupo();
  const historial = useHistorial();

  // Refresca los tres en paralelo: no hay dependencia entre ellos y esperar
  // uno para pedir el siguiente solo alargaría el gesto sin motivo.
  const refrescando = mapa.isRefetching || grupos.isRefetching || historial.isRefetching;
  const refrescar = () => {
    mapa.refetch();
    grupos.refetch();
    historial.refetch();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <EncabezadoPantalla titulo="Progreso" />
      <ScrollView
        contentContainerStyle={styles.cuerpo}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} />}
      >
        <Bloque cargando={mapa.isPending} error={mapa.isError}>
          <MapaAsistencia dias={mapa.data ?? []} />
        </Bloque>

        <Bloque cargando={grupos.isPending} error={grupos.isError}>
          <SeriesPorGrupo grupos={grupos.data ?? []} />
        </Bloque>

        <Bloque cargando={historial.isPending} error={historial.isError}>
          <HistorialEntrenamientos
            // `useInfiniteQuery` devuelve páginas: se aplanan para agrupar por
            // mes, porque un mes puede quedar partido entre dos páginas.
            entrenamientos={historial.data?.pages.flat() ?? []}
            hayMas={historial.hasNextPage}
            cargandoMas={historial.isFetchingNextPage}
            onVerMas={() => historial.fetchNextPage()}
          />
        </Bloque>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  cuerpo: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.xl },
  // Esqueleto y no un spinner al medio de la pantalla: los tres bloques llegan
  // por separado y el usuario ve la forma de lo que viene.
  esqueleto: { height: 120, borderRadius: 12, backgroundColor: colors.surface },
  error: { padding: spacing.md, borderWidth: 1, borderColor: colors.accent, borderRadius: 10 },
  errorTexto: { color: colors.accent, fontFamily: fonts.regular, fontSize: fontSize.sm },
});
