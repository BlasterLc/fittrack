import { Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, fontSize, spacing } from '@/theme/tokens';

export default function Catalogo() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Text style={styles.h1}>Gym</Text>
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
  },
});
