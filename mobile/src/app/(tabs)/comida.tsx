import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EncabezadoPantalla } from '@/components/EncabezadoPantalla';
import { RegistroComida } from '@/components/RegistroComida';
import { HistorialComida } from '@/components/HistorialComida';
import { Segmentado } from '@/components/Segmentado';
import { colors, spacing } from '@/theme/tokens';

type Segmento = 'registrar' | 'historial';

export default function Comida() {
  const [tab, setTab] = useState<Segmento>('registrar');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <EncabezadoPantalla titulo="Comida" />
      <View style={styles.segmentoCaja}>
        <Segmentado
          opciones={[
            { valor: 'registrar', label: 'Registrar' },
            { valor: 'historial', label: 'Historial' },
          ]}
          valor={tab}
          onCambio={setTab}
        />
      </View>

      {tab === 'registrar' ? (
        <RegistroComida onGuardado={() => setTab('historial')} />
      ) : (
        <HistorialComida />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  segmentoCaja: { paddingHorizontal: spacing.xl, marginBottom: spacing.md },
});
