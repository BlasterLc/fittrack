import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, spacing, fonts, fontSize } from '@/theme/tokens';

// Extraído de comida.tsx: lo usan la pestaña Comida y la pestaña Gym. Si cada
// una dibujara el suyo, el mismo control existiría dos veces con dos
// definiciones y una terminaría divergiendo.
//
// El componente no impone margen externo (marginHorizontal/marginBottom):
// esa es responsabilidad del contenedor que lo usa, para poder encajarlo en
// distintos layouts sin duplicar espaciado.
export function Segmentado<T extends string>({
  opciones,
  valor,
  onCambio,
}: {
  opciones: { valor: T; label: string }[];
  valor: T;
  onCambio: (valor: T) => void;
}) {
  return (
    <View style={styles.segmento}>
      {opciones.map((o) => {
        const activo = o.valor === valor;
        return (
          <Pressable
            key={o.valor}
            style={[styles.segItem, activo && styles.segItemActivo]}
            onPress={() => onCambio(o.valor)}
            accessibilityRole="tab"
            accessibilityState={{ selected: activo }}
          >
            <Text style={[styles.segTexto, activo && styles.segTextoActivo]}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  segmento: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.line,
  },
  segItem: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: 8 },
  segItemActivo: { backgroundColor: colors.primary },
  segTexto: { color: colors.muted, fontFamily: fonts.medium, fontSize: fontSize.base },
  segTextoActivo: { color: colors.ink, fontFamily: fonts.semibold },
});
