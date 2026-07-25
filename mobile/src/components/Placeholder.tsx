import { Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, fontSize } from '@/theme/tokens';

export function Placeholder({ titulo }: { titulo: string }) {
  return (
    <SafeAreaView style={styles.safe}>
      <Text style={styles.titulo}>{titulo}</Text>
      <Text style={styles.sub}>Próximamente</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 6 },
  titulo: { color: colors.ink, fontFamily: fonts.semibold, fontSize: fontSize.xl },
  sub: { color: colors.muted, fontFamily: fonts.regular, fontSize: fontSize.base },
});
