import { View, Text, StyleSheet } from 'react-native';
import type { Metas } from '@/lib/perfil';
import { colors, spacing, fonts, fontSize } from '@/theme/tokens';

// Los colores de los macros son los mismos del historial de comida, para que
// el numero de una pantalla y el de la otra hablen el mismo idioma.
export function MetasResumen({
  metas,
  mantenimiento,
  sonManuales,
}: {
  metas: Metas;
  mantenimiento: number | null;
  sonManuales: boolean;
}) {
  return (
    <View>
      <Text style={styles.calorias}>{metas.calorias.toLocaleString('es-CL')}</Text>
      <Text style={styles.caloriasUnidad}>kcal por día</Text>

      <View style={styles.macros}>
        <Macro label="Proteína" gramos={metas.prot_g} color={colors.prot} />
        <Macro label="Carbohidratos" gramos={metas.carb_g} color={colors.carb} />
        <Macro label="Grasas" gramos={metas.fat_g} color={colors.fat} />
      </View>

      <Text style={styles.origen}>
        {sonManuales
          ? 'Escritas por ti.'
          : mantenimiento
            ? `Mantenimiento estimado ${mantenimiento.toLocaleString('es-CL')} kcal, ajustado por tu objetivo.`
            : 'Calculadas a partir de tus datos.'}
      </Text>
    </View>
  );
}

function Macro({ label, gramos, color }: { label: string; gramos: number; color: string }) {
  return (
    <View style={styles.macro}>
      <View style={[styles.punto, { backgroundColor: color }]} />
      <Text style={styles.macroLabel}>{label}</Text>
      <Text style={styles.macroValor}>{gramos} g</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  calorias: {
    color: colors.ink,
    fontFamily: fonts.bold,
    fontSize: 48,
    fontVariant: ['tabular-nums'],
    lineHeight: 52,
  },
  caloriasUnidad: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: fontSize.base,
    marginBottom: spacing.lg,
  },
  macros: { gap: spacing.md },
  macro: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  punto: { width: 8, height: 8, borderRadius: 4 },
  macroLabel: { flex: 1, color: colors.muted, fontFamily: fonts.regular, fontSize: fontSize.base },
  macroValor: {
    color: colors.ink,
    fontFamily: fonts.medium,
    fontSize: fontSize.base,
    fontVariant: ['tabular-nums'],
  },
  origen: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: fontSize.sm,
    marginTop: spacing.lg,
    lineHeight: 19,
  },
});
