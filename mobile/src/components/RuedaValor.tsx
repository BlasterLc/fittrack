import { useRef } from 'react';
import { ScrollView, Text, View, StyleSheet, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import { colors, fonts } from '@/theme/tokens';

const ALTO_ITEM = 44;
const VISIBLES = 3;

/**
 * Rueda de valores, al estilo del Picker.tsx de v1: un ScrollView con
 * snapToInterval. Los valores llegan de mayor a menor, así deslizar hacia
 * arriba muestra números más grandes.
 *
 * Lleva accessibilityRole="adjustable" porque una rueda a puro gesto es
 * inservible con TalkBack, y es el patrón nativo para un valor ajustable.
 *
 * `contentOffset` solo posiciona el scroll al montar: si `valor` cambia
 * desde afuera con el componente ya montado (por ejemplo al cambiar de
 * ejercicio) la rueda no se mueve sola. Eso es responsabilidad de quien la
 * use: si cada ejercicio activo necesita su propia posición, hay que
 * remontar la rueda con un `key` (p. ej. el `catalogId` del ejercicio), no
 * confiar en que el prop la reposicione. Entre series del mismo ejercicio
 * no aplica: el valor arranca en lo mismo que la serie anterior, según el
 * spec, así que no cambia desde afuera.
 */
export function RuedaValor({
  valores,
  valor,
  onCambio,
  etiqueta,
  sufijo,
}: {
  valores: number[];
  valor: number;
  onCambio: (valor: number) => void;
  etiqueta: string;
  sufijo: string;
}) {
  const scroll = useRef<ScrollView>(null);
  const indice = Math.max(0, valores.indexOf(valor));

  function alDetenerse(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const i = Math.round(e.nativeEvent.contentOffset.y / ALTO_ITEM);
    const elegido = valores[Math.min(Math.max(i, 0), valores.length - 1)];
    if (elegido !== valor) onCambio(elegido);
  }

  function mover(paso: number) {
    const siguiente = valores[Math.min(Math.max(indice + paso, 0), valores.length - 1)];
    onCambio(siguiente);
    scroll.current?.scrollTo({ y: valores.indexOf(siguiente) * ALTO_ITEM, animated: true });
  }

  return (
    <View style={styles.caja}>
      <Text style={styles.etiqueta}>{etiqueta}</Text>
      <ScrollView
        ref={scroll}
        style={{ height: ALTO_ITEM * VISIBLES }}
        contentContainerStyle={{ paddingVertical: ALTO_ITEM }}
        snapToInterval={ALTO_ITEM}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        contentOffset={{ x: 0, y: indice * ALTO_ITEM }}
        onMomentumScrollEnd={alDetenerse}
        accessibilityRole="adjustable"
        accessibilityLabel={`${etiqueta}: ${valor} ${sufijo}`}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => mover(e.nativeEvent.actionName === 'increment' ? -1 : 1)}
      >
        {valores.map((v) => (
          <View key={v} style={styles.item}>
            <Text style={[styles.texto, v === valor && styles.activo]}>{v}</Text>
          </View>
        ))}
      </ScrollView>
      <Text style={styles.sufijo}>{sufijo}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  caja: { flex: 1, backgroundColor: colors.sesionBg, borderRadius: 10, paddingVertical: 6 },
  etiqueta: { color: colors.sesionInk, fontFamily: fonts.regular, fontSize: 11, textAlign: 'center' },
  item: { height: ALTO_ITEM, alignItems: 'center', justifyContent: 'center' },
  // `muted` no llega a 4,5:1 sobre `sesionBg` (ver tokens.ts): acá va
  // `sesionMuted`, que sí.
  texto: { color: colors.sesionMuted, fontFamily: fonts.medium, fontSize: 17, fontVariant: ['tabular-nums'] },
  activo: { color: colors.ink, fontFamily: fonts.bold, fontSize: 24 },
  sufijo: { color: colors.sesionInk, fontFamily: fonts.regular, fontSize: 11, textAlign: 'center' },
});
