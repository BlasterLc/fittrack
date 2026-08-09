import { View, Text, Pressable, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { useExportarResumen } from '@/hooks/useExportarResumen';
import { colors, spacing, fonts, fontSize } from '@/theme/tokens';

export function BotonExportarResumen() {
  const { exportar, compartir, generando, error, archivoListo } = useExportarResumen();

  function elegirPeriodo() {
    Alert.alert('Exportar resumen', 'Elige el período que quieres exportar', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Última semana', onPress: () => exportar(7) },
      { text: 'Último mes', onPress: () => exportar(30) },
    ]);
  }

  return (
    <View>
      <Pressable
        style={[styles.boton, generando && styles.deshabilitado]}
        onPress={elegirPeriodo}
        disabled={generando}
        accessibilityRole="button"
      >
        {generando ? (
          <ActivityIndicator color={colors.ink} />
        ) : (
          <Text style={styles.texto}>Exportar resumen</Text>
        )}
      </Pressable>
      {archivoListo && (
        <Pressable
          style={styles.botonSecundario}
          onPress={compartir}
          accessibilityRole="button"
        >
          <Text style={styles.textoSecundario}>Compartir PDF</Text>
        </Pressable>
      )}
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  boton: {
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  deshabilitado: { opacity: 0.6 },
  texto: { color: colors.ink, fontFamily: fonts.semibold, fontSize: fontSize.base },
  botonSecundario: {
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  textoSecundario: { color: colors.primaryText, fontFamily: fonts.medium, fontSize: fontSize.base },
  error: {
    color: colors.accent,
    fontFamily: fonts.regular,
    fontSize: fontSize.sm,
    marginTop: spacing.sm,
  },
});
