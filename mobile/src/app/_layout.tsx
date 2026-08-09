import { useEffect } from 'react';
import { View } from 'react-native';
import { DarkTheme, Stack, ThemeProvider, useRouter, useSegments } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  useFonts,
  Rubik_400Regular,
  Rubik_500Medium,
  Rubik_600SemiBold,
  Rubik_700Bold,
} from '@expo-google-fonts/rubik';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SessionProvider, useSession } from '@/lib/session';
import { usePerfil } from '@/hooks/usePerfil';
import { queryClient } from '@/lib/query';
import { colors } from '@/theme/tokens';

// Sin esto, React Navigation cae en su DefaultTheme, cuyo fondo es
// rgb(242,242,242): un flash casi blanco en cada transición de pantalla,
// porque contentStyle pinta el contenido pero no el contenedor de abajo.
const tema = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.primary,
    background: colors.bg,
    card: colors.surface,
    text: colors.ink,
    border: colors.line,
    notification: colors.accent,
  },
};

// Redirige según haya sesión: sin sesión → login; con sesión dentro del
// grupo de auth → asistente de perfil si está incompleto, si no, a las tabs.
function useAuthGate() {
  const { session, isLoading } = useSession();
  const segments = useSegments();
  const router = useRouter();
  // Solo se consulta con sesión: sin ella el endpoint devolvería 401. Se
  // dispara en cada pantalla, no solo acá, pero comparte la misma queryKey
  // que ya usan Perfil y EncabezadoPantalla — no es una llamada extra.
  const { data: perfil, isLoading: perfilCargando } = usePerfil(!!session);

  useEffect(() => {
    if (isLoading) return;
    const enAuth = segments[0] === '(auth)';
    if (!session && !enAuth) {
      router.replace('/login');
      return;
    }
    if (session && enAuth) {
      // Se espera a que el perfil resuelva antes de decidir a dónde ir: sin
      // esto, la primera pasada (perfil todavía sin cargar) mandaría siempre
      // a las tabs. Si la consulta falla, se sigue a las tabs igual — un
      // error de red pasajero no puede trabar el login entero.
      if (perfilCargando) return;
      if (perfil && !perfil.completo) {
        router.replace('/perfil/asistente');
      } else {
        router.replace('/');
      }
    }
  }, [session, isLoading, segments, router, perfil, perfilCargando]);
}

function RootNavigator() {
  useAuthGate();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      {/* "(auth)/login" y no "(auth)": el grupo no tiene _layout.tsx propio,
          así que Expo Router lo aplana y la ruta se registra con el nombre
          completo. Si algún día el grupo suma más pantallas y gana su propio
          _layout.tsx, esto vuelve a ser "(auth)". */}
      <Stack.Screen name="(auth)/login" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="perfil" />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Rubik_400Regular,
    Rubik_500Medium,
    Rubik_600SemiBold,
    Rubik_700Bold,
  });

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  }

  return (
    // GestureHandlerRootView va afuera de todo y necesita flex: 1. Sin él, los
    // gestos no se reconocen: react-native-gesture-handler lo exige como raíz.
    // Recién hizo falta al llegar el arrastre de la Fase 5b, que es lo primero
    // del proyecto que usa gestos.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={tema}>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <SessionProvider>
              <RootNavigator />
            </SessionProvider>
          </QueryClientProvider>
        </SafeAreaProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
