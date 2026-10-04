import { ActivityIndicator, View } from 'react-native';
import { colors } from '@/theme/tokens';

// Destino del redirect de Google. No hace nada por sí misma: en web el cliente
// de Supabase intercambia el `code` al cargar la página, y en nativo lo hace
// `iniciarSesionConGoogle`. Esta pantalla existe para que el deep link no caiga
// en "not found" y para que, estando dentro del grupo (auth), el auth-gate
// mande al usuario a las tabs apenas aparezca la sesión.
export default function Callback() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center' }}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}
