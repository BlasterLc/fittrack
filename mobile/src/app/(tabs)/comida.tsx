import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RegistroComida } from '@/components/RegistroComida';
import { HistorialComida } from '@/components/HistorialComida';
import { colors, spacing, fonts, fontSize } from '@/theme/tokens';

type Segmento = 'registrar' | 'historial';

export default function Comida() {
  const [tab, setTab] = useState<Segmento>('registrar');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.h1}>Comida</Text>
        <View style={styles.segmento}>
          <ItemSegmento label="Registrar" activo={tab === 'registrar'} onPress={() => setTab('registrar')} />
          <ItemSegmento label="Historial" activo={tab === 'historial'} onPress={() => setTab('historial')} />
        </View>
      </View>

      {tab === 'registrar' ? (
        <RegistroComida onGuardado={() => setTab('historial')} />
      ) : (
        <HistorialComida />
      )}
    </SafeAreaView>
  );
}

function ItemSegmento({
  label,
  activo,
  onPress,
}: {
  label: string;
  activo: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.segItem, activo && styles.segItemActivo]} onPress={onPress}>
      <Text style={[styles.segTexto, activo && styles.segTextoActivo]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, gap: spacing.md },
  h1: { color: colors.ink, fontFamily: fonts.bold, fontSize: fontSize.xxl },
  segmento: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.line,
  },
  segItem: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: 8 },
  segItemActivo: { backgroundColor: colors.primary },
  segTexto: { color: colors.muted, fontFamily: fonts.medium, fontSize: fontSize.base },
  segTextoActivo: { color: colors.ink, fontFamily: fonts.semibold },
});
