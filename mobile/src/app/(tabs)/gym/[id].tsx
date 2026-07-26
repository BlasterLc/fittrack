import { View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFicha } from '@/hooks/useCatalogo';
import { colors, spacing, fonts, fontSize } from '@/theme/tokens';

// Tope que fija la licencia de Gym visual. No se escala hacia arriba.
const GIF_MAX = 180;

export default function Ficha() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const ficha = useFicha(id);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.barra}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.volver}>‹ Catálogo</Text>
        </Pressable>
      </View>

      {ficha.isPending ? (
        <ActivityIndicator style={styles.centrado} color={colors.primary} />
      ) : ficha.isError ? (
        <View style={styles.centrado}>
          <Text style={styles.vacio}>No pudimos cargar el ejercicio</Text>
          <Pressable onPress={() => ficha.refetch()} hitSlop={10}>
            <Text style={styles.accion}>Reintentar</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.cuerpo}>
          <View style={styles.gifCaja}>
            <Image
              source={{ uri: ficha.data.gif_url }}
              style={styles.gif}
              contentFit="contain"
              cachePolicy="memory-disk"
            />
          </View>

          <Text style={styles.nombre}>{ficha.data.nombre_es}</Text>

          <Dato etiqueta="Grupo muscular" valor={ficha.data.body_part_es} />
          <Dato etiqueta="Equipamiento" valor={ficha.data.equipment_es} />
          <Dato etiqueta="Músculo objetivo" valor={ficha.data.target_es} />
          <Dato
            etiqueta="Secundarios"
            valor={ficha.data.secondary_muscles.join(' · ') || '—'}
          />
          {/* Sale de workout_sets, que existe recién en la Fase 6. */}
          <Dato etiqueta="Récord personal" valor="Sin registros todavía" atenuado />

          <View style={styles.seccion}>
            <Text style={styles.etiquetaSeccion}>Técnica</Text>
            {ficha.data.instrucciones_es.map((paso, i) => (
              <View key={i} style={styles.paso}>
                <View style={styles.numero}>
                  <Text style={styles.numeroTexto}>{i + 1}</Text>
                </View>
                <Text style={styles.pasoTexto}>{paso}</Text>
              </View>
            ))}
          </View>

          {/* La atribución visible es obligatoria por licencia. */}
          <Text style={styles.atribucion}>Animaciones {ficha.data.atribucion}</Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Dato({
  etiqueta,
  valor,
  atenuado = false,
}: {
  etiqueta: string;
  valor: string;
  atenuado?: boolean;
}) {
  return (
    <View style={styles.dato}>
      <Text style={styles.datoEtiqueta}>{etiqueta}</Text>
      <Text style={[styles.datoValor, atenuado && styles.datoValorAtenuado]}>{valor}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  barra: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  volver: { color: colors.muted, fontFamily: fonts.medium, fontSize: fontSize.base },
  centrado: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  vacio: { color: colors.muted, fontFamily: fonts.regular, fontSize: fontSize.base },
  accion: { color: colors.primary, fontFamily: fonts.semibold, fontSize: fontSize.base },
  cuerpo: { paddingBottom: spacing.xxl },
  gifCaja: { alignItems: 'center', paddingVertical: spacing.lg },
  gif: { width: GIF_MAX, height: GIF_MAX, borderRadius: 12, backgroundColor: colors.surface2 },
  nombre: {
    color: colors.ink,
    fontFamily: fonts.bold,
    fontSize: fontSize.xl,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  dato: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  datoEtiqueta: { color: colors.muted, fontFamily: fonts.regular, fontSize: fontSize.sm },
  datoValor: {
    color: colors.ink,
    fontFamily: fonts.semibold,
    fontSize: fontSize.sm,
    flexShrink: 1,
    textAlign: 'right',
  },
  datoValorAtenuado: { color: colors.muted, fontFamily: fonts.regular, fontStyle: 'italic' },
  seccion: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    marginTop: spacing.md,
  },
  etiquetaSeccion: {
    color: colors.muted,
    fontFamily: fonts.medium,
    fontSize: fontSize.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  paso: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  numero: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numeroTexto: { color: colors.muted, fontFamily: fonts.bold, fontSize: 11 },
  pasoTexto: {
    flex: 1,
    color: colors.ink,
    fontFamily: fonts.regular,
    fontSize: fontSize.base,
    lineHeight: 22,
  },
  atribucion: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: fontSize.sm,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    marginTop: spacing.md,
  },
});
