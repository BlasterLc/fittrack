import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CatalogoLista } from '@/components/CatalogoLista';
import { colors, spacing, fonts, fontSize } from '@/theme/tokens';

export default function AgregarEjercicios() {
  const router = useRouter();
  // Los que ya están en la rutina llegan marcados, así se pueden sacar desde
  // acá mismo sin volver al editor.
  const { ya = '', rutina } = useLocalSearchParams<{ ya?: string; rutina: string }>();
  const [elegidos, setElegidos] = useState<string[]>(
    ya ? ya.split(',').filter(Boolean) : [],
  );

  function alternar(id: string) {
    setElegidos((previos) =>
      previos.includes(id) ? previos.filter((p) => p !== id) : [...previos, id],
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.barra}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.cancelar}>Cancelar</Text>
        </Pressable>
        <Text style={styles.titulo}>Agregar ejercicios</Text>
      </View>

      <CatalogoLista
        onSeleccionar={(e) => alternar(e.id)}
        seleccionados={new Set(elegidos)}
      />

      <View style={styles.pie}>
        <Text style={styles.conteo}>
          {elegidos.length} {elegidos.length === 1 ? 'seleccionado' : 'seleccionados'}
        </Text>
        <Pressable
          disabled={elegidos.length === 0}
          onPress={() =>
            // navigate y no push: vuelve al editor que ya está montado y solo
            // le cambia los parámetros, así no se pierde el nombre a medio
            // escribir. `ts` fuerza el cambio cuando se elige el mismo conjunto
            // dos veces seguidas.
            router.navigate({
              pathname: '/gym/rutina/[id]',
              params: {
                id: rutina,
                elegidos: elegidos.join(','),
                ts: String(Date.now()),
              },
            })
          }
          hitSlop={10}
        >
          <Text style={[styles.agregar, elegidos.length === 0 && styles.agregarInactivo]}>
            Agregar
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  barra: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  cancelar: { color: colors.muted, fontFamily: fonts.medium, fontSize: fontSize.base },
  titulo: { color: colors.ink, fontFamily: fonts.semibold, fontSize: fontSize.base },
  pie: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.surface,
  },
  conteo: { color: colors.muted, fontFamily: fonts.regular, fontSize: fontSize.sm },
  agregar: { color: colors.primary, fontFamily: fonts.semibold, fontSize: fontSize.base },
  agregarInactivo: { color: colors.muted },
});
