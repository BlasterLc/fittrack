import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { usePerfil } from '@/hooks/usePerfil';
import { useSession } from '@/lib/session';
import { inicialDe } from '@/lib/perfil';
import { colors, spacing, fonts, fontSize } from '@/theme/tokens';

// Antes cada pestaña dibujaba su propio encabezado: Hoy con una acción
// "Salir", Comida con solo el título dentro de un View, y Gym con un <Text>
// suelto sin contenedor. Además de habilitar el acceso al perfil, esto
// uniforma tres encabezados que habían divergido. Mismo criterio con el que
// se extrajo Segmentado en la Fase 5b.
//
// El componente no impone margen externo: eso es del contenedor que lo usa.
export function EncabezadoPantalla({ titulo }: { titulo: string }) {
  const router = useRouter();
  const { data: perfil } = usePerfil();
  const { session } = useSession();

  const inicial = inicialDe(perfil?.nombre ?? null, session?.user?.email);

  return (
    <View style={styles.header}>
      <Text style={styles.h1}>{titulo}</Text>
      <Pressable
        onPress={() => router.push('/perfil')}
        // El círculo mide 44 y el mínimo táctil de Android son 48dp: el
        // hitSlop cubre la diferencia sin agrandar el dibujo. (El spec decía
        // "44 es el mínimo de Android" y estaba equivocado: 44 es el de iOS.)
        hitSlop={2}
        accessibilityRole="button"
        accessibilityLabel="Tu cuenta"
        style={({ pressed }) => [styles.avatar, pressed && styles.avatarPresionado]}
      >
        <Text style={styles.inicial}>{inicial}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  h1: { color: colors.ink, fontFamily: fonts.bold, fontSize: fontSize.xxl },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPresionado: { backgroundColor: colors.surface },
  inicial: { color: colors.ink, fontFamily: fonts.semibold, fontSize: fontSize.lg },
});
