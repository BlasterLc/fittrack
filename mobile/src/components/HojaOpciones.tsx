import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import { colors, spacing, fonts, fontSize } from '@/theme/tokens';

// Una sola hoja para sexo, actividad y objetivo. Genérica en el valor para
// que cada pantalla no declare su propia versión y terminen divergiendo.
export function HojaOpciones<T extends string>({
  visible,
  titulo,
  opciones,
  valor,
  onElegir,
  onCerrar,
}: {
  visible: boolean;
  titulo: string;
  opciones: { valor: T; label: string; detalle?: string }[];
  valor: T | null;
  onElegir: (valor: T) => void;
  onCerrar: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCerrar}>
      <View style={styles.fondo}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCerrar} />
        <View style={styles.hoja}>
          <View style={styles.cabecera}>
            <Text style={styles.titulo}>{titulo}</Text>
            <Pressable onPress={onCerrar} hitSlop={12}>
              <Text style={styles.cerrar}>Listo</Text>
            </Pressable>
          </View>

          {opciones.map((o) => {
            const activa = o.valor === valor;
            return (
              <Pressable
                key={o.valor}
                style={({ pressed }) => [
                  styles.opcion,
                  activa && styles.opcionActiva,
                  pressed && styles.opcionPresionada,
                ]}
                onPress={() => {
                  onElegir(o.valor);
                  onCerrar();
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: activa }}
              >
                <View style={styles.opcionTextos}>
                  <Text style={[styles.opcionLabel, activa && styles.opcionLabelActiva]}>
                    {o.label}
                  </Text>
                  {o.detalle && <Text style={styles.opcionDetalle}>{o.detalle}</Text>}
                </View>
                {activa && <Text style={styles.tilde}>✓</Text>}
              </Pressable>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fondo: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  hoja: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: spacing.xxl,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  cabecera: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  titulo: { color: colors.ink, fontFamily: fonts.semibold, fontSize: fontSize.lg },
  cerrar: { color: colors.primary, fontFamily: fonts.medium, fontSize: fontSize.base },
  opcion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    // 48dp de alto mínimo por el táctil de Android, con aire para el detalle.
    paddingVertical: spacing.lg,
    minHeight: 48,
  },
  opcionActiva: { backgroundColor: colors.surface2 },
  opcionPresionada: { opacity: 0.7 },
  opcionTextos: { flex: 1, gap: 2 },
  opcionLabel: { color: colors.ink, fontFamily: fonts.medium, fontSize: fontSize.base },
  opcionLabelActiva: { fontFamily: fonts.semibold },
  opcionDetalle: { color: colors.muted, fontFamily: fonts.regular, fontSize: fontSize.sm },
  tilde: { color: colors.primary, fontFamily: fonts.semibold, fontSize: fontSize.lg },
});
