import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EncabezadoPantalla } from '@/components/EncabezadoPantalla';
import { useDashboard } from '@/hooks/useDashboard';
import { colors, spacing, fonts, fontSize } from '@/theme/tokens';

export default function Hoy() {
  const { data, isLoading, isError } = useDashboard();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <EncabezadoPantalla titulo="Hoy" />

      {isLoading && <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />}
      {isError && <Text style={styles.error}>No pudimos cargar tu día.</Text>}

      {data && (
        <ScrollView contentContainerStyle={styles.body}>
          <Fila
            etiqueta="Calorías"
            valor={`${data.calorias.consumidas} / ${data.calorias.meta}`}
            vacio={data.calorias.consumidas === 0}
          />
          <Fila etiqueta="Proteína" valor={`${data.macros.prot} g`} vacio={data.macros.prot === 0} color={colors.prot} />
          <Fila etiqueta="Carbohidratos" valor={`${data.macros.carb} g`} vacio={data.macros.carb === 0} color={colors.carb} />
          <Fila etiqueta="Grasas" valor={`${data.macros.fat} g`} vacio={data.macros.fat === 0} color={colors.fat} />
          <Fila
            etiqueta="Entrenamiento"
            valor={data.entrenamiento ? `${data.entrenamiento.series} series · ${data.entrenamiento.duracion_min} min` : 'Sin entrenar'}
            vacio={!data.entrenamiento}
          />
          <Fila
            etiqueta="Peso"
            valor={data.peso ? `${data.peso.kg} kg` : 'Sin registrar'}
            vacio={!data.peso}
          />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Fila({
  etiqueta,
  valor,
  vacio,
  color,
}: {
  etiqueta: string;
  valor: string;
  vacio?: boolean;
  color?: string;
}) {
  return (
    <View style={styles.fila}>
      <View style={styles.etiquetaWrap}>
        {color && <View style={[styles.punto, { backgroundColor: color }]} />}
        <Text style={styles.etiqueta}>{etiqueta}</Text>
      </View>
      <Text style={[styles.valor, vacio && styles.valorVacio]}>{valor}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  body: { paddingHorizontal: spacing.xl },
  fila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  etiquetaWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  punto: { width: 8, height: 8, borderRadius: 4 },
  etiqueta: { color: colors.muted, fontFamily: fonts.regular, fontSize: fontSize.base },
  valor: { color: colors.ink, fontFamily: fonts.medium, fontSize: fontSize.base, fontVariant: ['tabular-nums'] },
  valorVacio: { color: colors.muted },
  error: { color: colors.accent, fontFamily: fonts.regular, fontSize: fontSize.base, paddingHorizontal: spacing.xl, marginTop: spacing.lg },
});
