import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { colors, spacing, fonts, fontSize } from '@/theme/tokens';

// Compartidos por el asistente y la pantalla de perfil. Si cada pantalla
// tuviera su copia, una terminaría divergiendo: es exactamente lo que pasó
// con los encabezados antes de extraer EncabezadoPantalla.

export function Fila({
  etiqueta,
  valor,
  onPress,
}: {
  etiqueta: string;
  valor: string | null;
  onPress?: () => void;
}) {
  return (
    <Pressable style={styles.fila} onPress={onPress} disabled={!onPress}>
      <Text style={styles.filaEtiqueta}>{etiqueta}</Text>
      <Text style={[styles.filaValor, !valor && styles.filaVacio]}>{valor ?? 'Sin definir'}</Text>
    </Pressable>
  );
}

export function FilaNumero({
  etiqueta,
  unidad,
  valor,
  decimal,
  onCambio,
}: {
  etiqueta: string;
  unidad: string;
  valor: number | null;
  decimal?: boolean;
  onCambio: (valor: number | null) => void;
}) {
  return (
    <View style={styles.fila}>
      <Text style={styles.filaEtiqueta}>{etiqueta}</Text>
      <View style={styles.filaEntrada}>
        <TextInput
          style={styles.numero}
          value={valor === null ? '' : String(valor)}
          onChangeText={(t) => {
            const limpio = t.replace(',', '.');
            const n = decimal ? parseFloat(limpio) : parseInt(limpio, 10);
            onCambio(Number.isFinite(n) ? n : null);
          }}
          keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
          placeholder="—"
          placeholderTextColor={colors.muted}
          maxLength={5}
        />
        <Text style={styles.unidad}>{unidad}</Text>
      </View>
    </View>
  );
}

export function Tarjeta({
  label,
  detalle,
  activa,
  onPress,
}: {
  label: string;
  detalle: string;
  activa: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.tarjeta, activa && styles.tarjetaActiva]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: activa }}
    >
      <Text style={[styles.tarjetaLabel, activa && styles.tarjetaLabelActiva]}>{label}</Text>
      <Text style={styles.tarjetaDetalle}>{detalle}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    minHeight: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  filaEtiqueta: { color: colors.muted, fontFamily: fonts.regular, fontSize: fontSize.base },
  filaValor: { color: colors.ink, fontFamily: fonts.medium, fontSize: fontSize.base },
  filaVacio: { color: colors.muted },
  filaEntrada: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  numero: {
    color: colors.ink,
    fontFamily: fonts.medium,
    fontSize: fontSize.base,
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
    minWidth: 60,
    paddingVertical: spacing.sm,
  },
  unidad: { color: colors.muted, fontFamily: fonts.regular, fontSize: fontSize.base },
  tarjeta: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    padding: spacing.lg,
    marginBottom: spacing.md,
    gap: 2,
  },
  tarjetaActiva: { borderColor: colors.primary, backgroundColor: colors.surface2 },
  tarjetaLabel: { color: colors.ink, fontFamily: fonts.medium, fontSize: fontSize.base },
  tarjetaLabelActiva: { fontFamily: fonts.semibold },
  tarjetaDetalle: { color: colors.muted, fontFamily: fonts.regular, fontSize: fontSize.sm },
});
