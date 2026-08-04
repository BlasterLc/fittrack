import { useEffect, useRef, useState } from 'react';
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
import { colors, spacing, fonts, fontSize } from '@/theme/tokens';

const ANCHO_POR_PUNTO = 36;
const ANCHO_MINIMO = 180;
const ALTO = 90;
const PADDING_VERTICAL = 10;
// Dispara la carga de la página siguiente cuando el borde izquierdo del
// gráfico está a menos de esto del inicio del scroll.
const UMBRAL_BORDE = 40;

export type PuntoLinea = { valor: number };

/**
 * Gráfico de línea paginado hacia atrás, genérico en el valor de cada punto.
 *
 * Extraído de GraficoProgresion (Fase 7b). Conserva intacto el fix de
 * Android: el `ScrollView` no rebota como en iOS, así que si el contenido
 * todavía no desborda el viewport, `onScroll` nunca se dispara y la
 * paginación queda inalcanzable. Se mide el viewport real con `onLayout` y,
 * si el gráfico entero cabe sin desbordar, se pide la página siguiente de
 * una, sin esperar un gesto que no puede ocurrir.
 */
export function GraficoLineas({
  titulo,
  puntos,
  ultimoValorTexto,
  ultimoEtiqueta,
  accessibilityLabel,
  cargando,
  error,
  vacioTexto,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  onReintentar,
}: {
  titulo: string;
  /** De la más vieja a la más reciente, igual que el resto de la app. */
  puntos: PuntoLinea[];
  ultimoValorTexto: string;
  ultimoEtiqueta: string;
  accessibilityLabel: string;
  cargando: boolean;
  error: boolean;
  vacioTexto: string;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => Promise<unknown>;
  onReintentar: () => void;
}) {
  // Evita disparar fetchNextPage() más de una vez por acercamiento al borde,
  // mientras la página anterior sigue en vuelo.
  const cargandoMas = useRef(false);
  // Ancho real del contenedor visible, medido con onLayout.
  const [anchoViewport, setAnchoViewport] = useState<number | null>(null);

  const ancho = Math.max(puntos.length * ANCHO_POR_PUNTO, ANCHO_MINIMO);

  useEffect(() => {
    if (
      anchoViewport !== null &&
      ancho <= anchoViewport &&
      hasNextPage &&
      !isFetchingNextPage &&
      !cargandoMas.current
    ) {
      cargandoMas.current = true;
      fetchNextPage().finally(() => {
        cargandoMas.current = false;
      });
    }
  }, [ancho, anchoViewport, hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (cargando) {
    return (
      <View style={styles.bloque}>
        <Text style={styles.titulo}>{titulo}</Text>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (error && puntos.length === 0) {
    return (
      <View style={styles.bloque}>
        <Text style={styles.titulo}>{titulo}</Text>
        <Text style={styles.vacio}>No pudimos cargar el gráfico</Text>
        <Pressable style={styles.reintentar} onPress={onReintentar} accessibilityRole="button">
          <Text style={styles.reintentarTexto}>Reintentar</Text>
        </Pressable>
      </View>
    );
  }

  if (puntos.length === 0) {
    return (
      <View style={styles.bloque}>
        <Text style={styles.titulo}>{titulo}</Text>
        <Text style={styles.vacio}>{vacioTexto}</Text>
      </View>
    );
  }

  // A partir de aquí puntos.length > 0: el gráfico se dibuja igual aunque
  // `error` sea true por un fallo al pedir una página siguiente. Perder el
  // gráfico ya cargado por un error de paginación sería peor que mostrarlo
  // desactualizado.

  const valores = puntos.map((p) => p.valor);
  const minimo = Math.min(...valores);
  const maximo = Math.max(...valores);
  const sinVariacion = maximo === minimo;

  const coordenadas = puntos.map((p, i) => {
    const x =
      puntos.length === 1 ? ancho / 2 : (i / (puntos.length - 1)) * (ancho - 16) + 8;
    const y = sinVariacion
      ? ALTO / 2
      : ALTO -
        PADDING_VERTICAL -
        ((p.valor - minimo) / (maximo - minimo)) * (ALTO - 2 * PADDING_VERTICAL);
    return { x, y };
  });

  function alScrollear(evento: NativeSyntheticEvent<NativeScrollEvent>) {
    const cercaDelBorde = evento.nativeEvent.contentOffset.x < UMBRAL_BORDE;
    if (cercaDelBorde && hasNextPage && !isFetchingNextPage && !cargandoMas.current) {
      cargandoMas.current = true;
      fetchNextPage().finally(() => {
        cargandoMas.current = false;
      });
    }
  }

  return (
    <View style={styles.bloque}>
      <Text style={styles.titulo}>{titulo}</Text>
      <Text style={styles.ultimoValor}>
        {ultimoValorTexto} <Text style={styles.ultimoEtiqueta}>{ultimoEtiqueta}</Text>
      </Text>

      <View onLayout={(e) => setAnchoViewport(e.nativeEvent.layout.width)}>
        {isFetchingNextPage && (
          <ActivityIndicator style={styles.cargandoMas} size="small" color={colors.muted} />
        )}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          onScroll={alScrollear}
          scrollEventThrottle={32}
          maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        >
          <Svg width={ancho} height={ALTO} accessibilityLabel={accessibilityLabel}>
            {coordenadas.length > 1 && (
              <Polyline
                points={coordenadas.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke={colors.primaryText}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {coordenadas.map((p, i) => (
              <Circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={i === coordenadas.length - 1 ? 4 : 3}
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
