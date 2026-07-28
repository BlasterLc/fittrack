import { Text, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EncabezadoPantalla } from '@/components/EncabezadoPantalla';
import { colors, fonts, fontSize } from '@/theme/tokens';

export default function Progreso() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <EncabezadoPantalla titulo="Progreso" />
      <View style={styles.cuerpo}>
        <Text style={styles.sub}>Próximamente</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  cuerpo: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sub: { color: colors.muted, fontFamily: fonts.regular, fontSize: fontSize.base },
});
