import { Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CatalogoLista } from '@/components/CatalogoLista';
import { colors, spacing, fonts, fontSize } from '@/theme/tokens';

export default function Catalogo() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Text style={styles.h1}>Gym</Text>
      <CatalogoLista onSeleccionar={(e) => router.push(`/gym/${e.id}`)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  h1: {
    color: colors.ink,
    fontFamily: fonts.bold,
    fontSize: fontSize.xxl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
});
