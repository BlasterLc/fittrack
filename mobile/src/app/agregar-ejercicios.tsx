import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CatalogoLista } from '@/components/CatalogoLista';
import { dejarSeleccion } from '@/lib/seleccionEjercicios';
import { colors, spacing, fonts, fontSize } from '@/theme/tokens';

/**
 * El selector del catálogo, compartido por el editor de rutinas y la sesión.
 *
 * Vive en la raíz y NO dentro de `(tabs)` a propósito. Como ruta de las
 * pestañas, empujarla desde `/sesion` —que es hermana de raíz— montaba un
 * `(tabs)` entero encima, con su barra: desde ahí tocar «Gym» enterraba la
 * sesión en el stack, y retomarla desde la barra de Gym montaba un SEGUNDO
 * `Sesion`. Los dos leían el mismo borrador pero cada uno con su estado en
 * memoria, así que las series del que quedaba abajo se perdían con un resumen
 * de éxito, porque el `client_id` repetido dispara la idempotencia del backend.
 *
 * En la raíz se empuja sobre el stack de arriba en los dos flujos: el editor
 * de rutinas sigue montado debajo, el `back()` vuelve exactamente a donde
 * estabas, y desde la sesión no hay barra de pestañas por donde escaparse.
 */
export default function AgregarEjercicios() {
  const router = useRouter();
  // Los que ya están en la rutina llegan marcados, así se pueden sacar desde
  // acá mismo sin volver al editor.
  const { ya = '' } = useLocalSearchParams<{ ya?: string }>();
  const [elegidos, setElegidos] = useState<string[]>(
    ya ? ya.split(',').filter(Boolean) : [],
  );

  function alternar(id: string) {
    setElegidos((previos) =>
      previos.includes(id) ? previos.filter((p) => p !== id) : [...previos, id],
    );
  }

  return (
    // 'bottom' se suma al salir de las pestañas: antes el pie quedaba por
    // encima de la barra de pestañas, que ya reservaba ese espacio; en la raíz
    // no hay nada debajo y «Agregar» caería sobre los gestos del sistema.
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
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
          onPress={() => {
            // La selección va por el buzón y se vuelve con un back() real. Con
            // `router.navigate` y parámetros, Expo Router apilaba un editor
            // nuevo encima de esta pantalla: se perdía el nombre a medio
            // escribir y al guardar se volvía acá en vez de a las rutinas.
            dejarSeleccion(elegidos);
            router.back();
          }}
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
  agregar: { color: colors.primaryText, fontFamily: fonts.semibold, fontSize: fontSize.base },
  agregarInactivo: { color: colors.muted },
});
