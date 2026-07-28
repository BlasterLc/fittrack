import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { EncabezadoPantalla } from '@/components/EncabezadoPantalla';
import { CatalogoLista } from '@/components/CatalogoLista';
import { RutinasLista } from '@/components/RutinasLista';
import { Segmentado } from '@/components/Segmentado';
import { colors, spacing } from '@/theme/tokens';

type Vista = 'rutinas' | 'catalogo';

export default function Gym() {
  const router = useRouter();
  const [vista, setVista] = useState<Vista>('rutinas');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <EncabezadoPantalla titulo="Gym" />
      <View style={styles.segmentoCaja}>
        <Segmentado
          opciones={[
            { valor: 'rutinas', label: 'Rutinas' },
            { valor: 'catalogo', label: 'Catálogo' },
          ]}
          valor={vista}
          onCambio={setVista}
        />
      </View>
      {vista === 'rutinas' ? (
        <RutinasLista />
      ) : (
        <CatalogoLista onSeleccionar={(e) => router.push(`/gym/ejercicio/${e.id}`)} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  segmentoCaja: { paddingHorizontal: spacing.xl, marginBottom: spacing.md },
});
