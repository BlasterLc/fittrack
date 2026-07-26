import { Stack } from 'expo-router';
import { colors } from '@/theme/tokens';

export default function GymLayout() {
  // headerShown en false a propósito: la ficha dibuja su propia barra,
  // porque el encabezado se encoge con el scroll (ver [id].tsx).
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    />
  );
}
