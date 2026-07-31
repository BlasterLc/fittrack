import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Pressable,
  StyleSheet,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import Svg, { Polyline, Circle } from 'react-native-svg';
import { useProgresionEjercicio } from '@/hooks/useProgreso';
import { formatoKg } from '@/lib/sesion';
import { colors, spacing, fonts, fontSize } from '@/theme/tokens';

const ANCHO_POR_PUNTO = 36;
const ANCHO_MINIMO = 180;
const ALTO = 90;
const PADDING_VERTICAL = 10;
// Dispara la carga de la página siguiente cuando el borde izquierdo del
// gráfico está a menos de esto del inicio del scroll.
const UMBRAL_BORDE = 40;

export function GraficoProgresion({ catalogId }: { catalogId: string }) {
  const progresion = useProgresionEjercicio(catalogId);
  // Evita disparar fetchNextPage() más de una vez por acercamiento al borde,
  // mientras la página anterior sigue en vuelo.
  const cargandoMas = useRef(false);
  // Ancho real del contenedor visible, medido con onLayout.
  const [anchoViewport, setAnchoViewport] = useState<number | null>(null);

  // La API devuelve de la más reciente a la más vieja; el gráfico se lee de
  // izquierda (vieja) a derecha (reciente), como el resto de la app.
  const sesiones = useMemo(
    () => (progresion.data?.pages.flat() ?? []).slice().reverse(),
    [progresion.data],
  );

  const ancho = Math.max(sesiones.length * ANCHO_POR_PUNTO, ANCHO_MINIMO);

  // En Android el `ScrollView` no rebota como en iOS: si el contenido todavía
  // no desborda el viewport, `onScroll` nunca se dispara y la paginación
  // queda inalcanzable. Si ya sabemos el ancho real y el gráfico entero cabe
  // sin desbordar, se pide la página siguiente de una, sin esperar un gesto
  // que no puede ocurrir.
  useEffect(() => {
    if (
      anchoViewport !== null &&
      ancho <= anchoViewport &&
      progresion.hasNextPage &&
      !progresion.isFetchingNextPage &&
      !cargandoMas.current
    ) {
      cargandoMas.current = true;
      progresion.fetchNextPage().finally(() => {
        cargandoMas.current = false;
      });
    }
  }, [ancho, anchoViewport, progresion.hasNextPage, progresion.isFetchingNextPage]);

  if (progresion.isPending) {
    return (
      <View style={styles.bloque}>
        <Text style={styles.titulo}>Progresión</Text>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (progresion.isError && sesiones.length === 0) {
    return (
      <View style={styles.bloque}>
        <Text style={styles.titulo}>Progresión</Text>
        <Text style={styles.vacio}>No pudimos cargar la progresión</Text>
        <Pressable
          style={styles.reintentar}
          onPress={() => progresion.refetch()}
          accessibilityRole="button"
        >
          <Text style={styles.reintentarTexto}>Reintentar</Text>
        </Pressable>
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

  // A partir de aquí sesiones.length > 0: el gráfico se dibuja igual aunque
  // `isError` sea true por un fallo al pedir una página siguiente. Perder el
  // gráfico ya cargado por un error de paginación sería peor que mostrarlo
  // desactualizado.

  const pesos = sesiones.map((s) => s.max_weight_kg);
  const minimo = Math.min(...pesos);
  const maximo = Math.max(...pesos);
  const sinVariacion = maximo === minimo;

  const puntos = sesiones.map((s, i) => {
    const x =
      sesiones.length === 1 ? ancho / 2 : (i / (sesiones.length - 1)) * (ancho - 16) + 8;
    const y = sinVariacion
      ? ALTO / 2
      : ALTO -
        PADDING_VERTICAL -
        ((s.max_weight_kg - minimo) / (maximo - minimo)) * (ALTO - 2 * PADDING_VERTICAL);
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
        {formatoKg(ultimo.max_weight_kg)} kg{' '}
        <Text style={styles.ultimoEtiqueta}>último máximo</Text>
      </Text>

      <View onLayout={(e) => setAnchoViewport(e.nativeEvent.layout.width)}>
        {progresion.isFetchingNextPage && (
          <ActivityIndicator style={styles.cargandoMas} size="small" color={colors.muted} />
        )}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          onScroll={alScrollear}
          scrollEventThrottle={32}
          maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        >
          <Svg
            width={ancho}
            height={ALTO}
            accessibilityLabel={`Progresión: ${sesiones.length} sesiones, de ${formatoKg(minimo)} a ${formatoKg(maximo)} kg`}
          >
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
  reintentar: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // `primaryText` y nunca `primary`: como color de texto, `primary` no llega
  // a 4,5:1 en ningún fondo de la app.
  reintentarTexto: { color: colors.primaryText, fontFamily: fonts.semibold, fontSize: fontSize.base },
});
