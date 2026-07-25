import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  useFonts,
  Rubik_400Regular,
  Rubik_500Medium,
  Rubik_600SemiBold,
  Rubik_700Bold,
} from '@expo-google-fonts/rubik';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider, useSession } from '@/lib/session';
import { queryClient } from '@/lib/query';
import { colors } from '@/theme/tokens';

// Redirige según haya sesión: sin sesión → login; con sesión dentro del
// grupo de auth → a las tabs.
function useAuthGate() {
  const { session, isLoading } = useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    const enAuth = segments[0] === '(auth)';
    if (!session && !enAuth) {
      router.replace('/login');
    } else if (session && enAuth) {
      router.replace('/');
    }
  }, [session, isLoading, segments, router]);
}

function RootNavigator() {
  useAuthGate();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
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
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <RootNavigator />
        </SessionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
