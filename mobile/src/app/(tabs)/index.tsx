import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { EncabezadoPantalla } from '@/components/EncabezadoPantalla';
import { TarjetaCalorias } from '@/components/TarjetaCalorias';
import { HojaRegistrarPeso } from '@/components/HojaRegistrarPeso';
import { useDashboard } from '@/hooks/useDashboard';
import { usePerfil } from '@/hooks/usePerfil';
import { useEmpezarRutina } from '@/hooks/useEmpezarRutina';
import { colors, spacing, fonts, fontSize } from '@/theme/tokens';

export default function Hoy() {
  const router = useRouter();
  const { data, isLoading, isError } = useDashboard();
  const { data: perfil } = usePerfil();
  const { empezar, empezando } = useEmpezarRutina();
  const [pesoVisible, setPesoVisible] = useState(false);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <EncabezadoPantalla titulo="Hoy" />

      {isLoading && <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />}
      {isError && <Text style={styles.error}>No pudimos cargar tu día.</Text>}

      {data && (
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.saludo}>Hola{perfil?.nombre ? `, ${perfil.nombre}` : ''}</Text>

          {data.racha_dias > 0 && (
            <View style={styles.racha}>
              <Text style={styles.rachaTexto}>
                🔥 {data.racha_dias} {data.racha_dias === 1 ? 'día seguido' : 'días seguidos'}
              </Text>
            </View>
          )}

          <TarjetaCalorias calorias={data.calorias} macros={data.macros} metasMacros={data.metas_macros} />

          <View style={styles.accesos}>
            <Acceso icono="🍽️" etiqueta="Comida" onPress={() => router.push('/comida')} />
            <Acceso icono="🏋️" etiqueta="Entrenar" onPress={() => router.push('/gym')} />
            <Acceso icono="⚖️" etiqueta="Peso" onPress={() => setPesoVisible(true)} />
          </View>

          <View style={styles.grid}>
            <TarjetaMini
              etiqueta="Entrenamiento de hoy"
              valor={
                data.entrenamiento
                  ? `${data.entrenamiento.series} series · ${data.entrenamiento.duracion_min} min`
                  : 'Sin entrenar'
              }
              vacio={!data.entrenamiento}
            />
            <TarjetaMini
              etiqueta="Peso"
              valor={data.peso ? `${data.peso.kg} kg` : 'Sin registrar'}
              vacio={!data.peso}
            />
            {data.ultima_rutina && (
              <Pressable
                style={[styles.tarjetaMini, styles.tarjetaAncha]}
                onPress={() => empezar(data.ultima_rutina!.id)}
                disabled={empezando !== null}
                accessibilityRole="button"
                accessibilityLabel={`Repetir última rutina: ${data.ultima_rutina.nombre}`}
              >
                <Text style={styles.miniEtiqueta}>Repetir última rutina</Text>
                {empezando === data.ultima_rutina.id ? (
                  <ActivityIndicator color={colors.primaryText} size="small" />
                ) : (
                  <Text style={[styles.miniValor, styles.miniValorAccion]}>{data.ultima_rutina.nombre}</Text>
                )}
              </Pressable>
            )}
          </View>
        </ScrollView>
      )}

      <HojaRegistrarPeso visible={pesoVisible} onCerrar={() => setPesoVisible(false)} />
    </SafeAreaView>
  );
}

function Acceso({ icono, etiqueta, onPress }: { icono: string; etiqueta: string; onPress: () => void }) {
  return (
    <Pressable style={styles.acceso} onPress={onPress} accessibilityRole="button" accessibilityLabel={etiqueta}>
      <Text style={styles.accesoIcono}>{icono}</Text>
      <Text style={styles.accesoTexto}>{etiqueta}</Text>
    </Pressable>
  );
}

function TarjetaMini({ etiqueta, valor, vacio }: { etiqueta: string; valor: string; vacio?: boolean }) {
  return (
    <View style={styles.tarjetaMini}>
      <Text style={styles.miniEtiqueta}>{etiqueta}</Text>
      <Text style={[styles.miniValor, vacio && styles.miniValorVacio]}>{valor}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  body: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
  saludo: { color: colors.ink, fontFamily: fonts.semibold, fontSize: fontSize.xl, marginBottom: spacing.sm },
  racha: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface2,
    borderRadius: 999,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  rachaTexto: { color: colors.accent, fontFamily: fonts.medium, fontSize: fontSize.sm },
  accesos: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg, marginBottom: spacing.lg },
  acceso: {
    flex: 1,
    minHeight: 48,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  accesoIcono: { fontSize: 18, marginBottom: 2 },
  accesoTexto: { color: colors.ink, fontFamily: fonts.medium, fontSize: fontSize.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tarjetaMini: {
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 48,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    justifyContent: 'center',
  },
  tarjetaAncha: { flexBasis: '100%' },
  miniEtiqueta: { color: colors.muted, fontFamily: fonts.regular, fontSize: fontSize.sm, marginBottom: 4 },
  miniValor: { color: colors.ink, fontFamily: fonts.semibold, fontSize: fontSize.base },
  miniValorVacio: { color: colors.muted },
  miniValorAccion: { color: colors.primaryText },
  error: {
    color: colors.accent,
    fontFamily: fonts.regular,
    fontSize: fontSize.base,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.lg,
  },
});
