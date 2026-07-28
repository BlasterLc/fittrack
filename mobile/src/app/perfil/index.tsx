import { View, Text, StyleSheet, ActivityIndicator, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { usePerfil } from '@/hooks/usePerfil';
import { MetasResumen } from '@/components/MetasResumen';
import { colors, spacing, fonts, fontSize } from '@/theme/tokens';

export default function Perfil() {
  const router = useRouter();
  const { data: perfil, isLoading, isError } = usePerfil();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.barra}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Volver">
          <Text style={styles.volver}>‹ Atrás</Text>
        </Pressable>
      </View>

      {isLoading && <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />}
      {isError && <Text style={styles.error}>No pudimos cargar tu perfil.</Text>}

      {perfil && (
        <ScrollView contentContainerStyle={styles.cuerpo}>
          <Text style={styles.h1}>Tu perfil</Text>

          <Text style={styles.seccion}>Tus metas</Text>
          {perfil.metas ? (
            <MetasResumen
              metas={perfil.metas}
              mantenimiento={perfil.mantenimiento}
              sonManuales={perfil.metas_son_manuales}
            />
          ) : (
            // Estado vacío que enseña, no "no hay nada": dice qué falta y da
            // el camino para completarlo.
            <View style={styles.vacio}>
              <Text style={styles.vacioTitulo}>Todavía no podemos calcular tus metas</Text>
              <Text style={styles.vacioTexto}>
                Necesitamos tu sexo, fecha de nacimiento, altura, peso, cuánto te mueves y qué
                buscas. Mientras tanto la app usa una meta genérica.
              </Text>
              <Pressable
                style={styles.boton}
                onPress={() => router.push('/perfil/asistente')}
                accessibilityRole="button"
              >
                <Text style={styles.botonTexto}>Completar mi ficha</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  barra: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.sm },
  volver: { color: colors.primary, fontFamily: fonts.medium, fontSize: fontSize.base },
  cuerpo: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
  h1: {
    color: colors.ink,
    fontFamily: fonts.bold,
    fontSize: fontSize.xxl,
    marginBottom: spacing.xl,
  },
  seccion: {
    color: colors.muted,
    fontFamily: fonts.medium,
    fontSize: fontSize.sm,
    marginBottom: spacing.md,
  },
  vacio: { gap: spacing.md },
  vacioTitulo: { color: colors.ink, fontFamily: fonts.semibold, fontSize: fontSize.lg },
  vacioTexto: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: fontSize.base,
    lineHeight: 22,
  },
  boton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
    minHeight: 48,
    justifyContent: 'center',
  },
  botonTexto: { color: colors.ink, fontFamily: fonts.semibold, fontSize: fontSize.base },
  error: {
    color: colors.accent,
    fontFamily: fonts.regular,
    fontSize: fontSize.base,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.lg,
  },
});
