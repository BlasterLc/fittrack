import { useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import Svg, { Polyline, Circle } from 'react-native-svg';
import { useProgresionEjercicio } from '@/hooks/useProgreso';
import { colors, spacing, fonts, fontSize } from '@/theme/tokens';

const ANCHO_POR_PUNTO = 24;
const ANCHO_MINIMO = 180;
const ALTO = 90;
const PADDING_VERTICAL = 10;
// Dispara la carga de la página siguiente cuando el borde izquierdo del
// gráfico está a menos de esto del inicio del scroll.
const UMBRAL_BORDE = 40;

function kg(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function GraficoProgresion({ catalogId }: { catalogId: string }) {
  const progresion = useProgresionEjercicio(catalogId);
  // Evita disparar fetchNextPage() más de una vez por acercamiento al borde,
  // mientras la página anterior sigue en vuelo.
  const cargandoMas = useRef(false);

  // La API devuelve de la más reciente a la más vieja; el gráfico se lee de
  // izquierda (vieja) a derecha (reciente), como el resto de la app.
  const sesiones = useMemo(
    () => (progresion.data?.pages.flat() ?? []).slice().reverse(),
    [progresion.data],
  );

  if (progresion.isPending) {
    return (
      <View style={styles.bloque}>
        <Text style={styles.titulo}>Progresión</Text>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (progresion.isError) {
    return (
      <View style={styles.bloque}>
        <Text style={styles.titulo}>Progresión</Text>
        <Text style={styles.vacio}>No pudimos cargar la progresión</Text>
      </View>
    );
  }

  if (sesiones.length === 0) {
    return (
      <View style={styles.bloque}>
        <Text style={styles.titulo}>Progresión</Text>
        <Text style={styles.vacio}>Sin registros todavía</Text>
      </View>
    );
  }

  const pesos = sesiones.map((s) => s.max_weight_kg);
  const minimo = Math.min(...pesos);
  const maximo = Math.max(...pesos);
  const rango = maximo - minimo || 1;
  const ancho = Math.max(sesiones.length * ANCHO_POR_PUNTO, ANCHO_MINIMO);

  const puntos = sesiones.map((s, i) => {
    const x =
      sesiones.length === 1 ? ancho / 2 : (i / (sesiones.length - 1)) * (ancho - 16) + 8;
    const y =
      ALTO - PADDING_VERTICAL - ((s.max_weight_kg - minimo) / rango) * (ALTO - 2 * PADDING_VERTICAL);
    return { x, y };
  });

  const ultimo = sesiones[sesiones.length - 1];

  function alScrollear(evento: NativeSyntheticEvent<NativeScrollEvent>) {
    const cercaDelBorde = evento.nativeEvent.contentOffset.x < UMBRAL_BORDE;
    if (
      cercaDelBorde &&
      progresion.hasNextPage &&
      !progresion.isFetchingNextPage &&
      !cargandoMas.current
    ) {
      cargandoMas.current = true;
      progresion.fetchNextPage().finally(() => {
        cargandoMas.current = false;
      });
    }
  }

  return (
    <View style={styles.bloque}>
      <Text style={styles.titulo}>Progresión</Text>
      <Text style={styles.ultimoValor}>
        {kg(ultimo.max_weight_kg)} kg <Text style={styles.ultimoEtiqueta}>último máximo</Text>
      </Text>

      <View>
        {progresion.isFetchingNextPage && (
          <ActivityIndicator style={styles.cargandoMas} size="small" color={colors.muted} />
        )}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          onScroll={alScrollear}
          scrollEventThrottle={32}
        >
          <Svg width={ancho} height={ALTO}>
            {puntos.length > 1 && (
              <Polyline
                points={puntos.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke={colors.primaryText}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {puntos.map((p, i) => (
              <Circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={i === puntos.length - 1 ? 4 : 3}
                fill={colors.primaryText}
              />
            ))}
          </Svg>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bloque: {
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  titulo: { color: colors.muted, fontFamily: fonts.regular, fontSize: fontSize.sm },
  ultimoValor: { color: colors.ink, fontFamily: fonts.semibold, fontSize: fontSize.lg },
  ultimoEtiqueta: { color: colors.muted, fontFamily: fonts.regular, fontSize: fontSize.sm },
  vacio: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: fontSize.sm,
    fontStyle: 'italic',
  },
  cargandoMas: { position: 'absolute', top: spacing.xxl, left: spacing.sm, zIndex: 1 },
});
