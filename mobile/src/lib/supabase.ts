import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

// SecureStore guarda el token como credencial cifrada en el dispositivo.
// No existe en web: ahí se usa localStorage, igual que hacen por defecto
// los SDKs web de Supabase.
const SecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

// `Platform.OS === 'web'` también da true durante `expo export --platform
// web`, que renderiza el árbol una vez en Node.js para generar el HTML
// estático — ahí no existe `localStorage` (global del navegador). Sin esta
// guarda, createClient() revienta al construirse: intenta recuperar la
// sesión de forma eager, y no hay ninguna sesión real que recuperar en un
// proceso de build de todos modos.
const localStorageDisponible = typeof localStorage !== 'undefined';

const LocalStorageAdapter = {
  getItem: (key: string) =>
    Promise.resolve(localStorageDisponible ? localStorage.getItem(key) : null),
  setItem: (key: string, value: string) => {
    if (localStorageDisponible) localStorage.setItem(key, value);
    return Promise.resolve();
  },
  removeItem: (key: string) => {
    if (localStorageDisponible) localStorage.removeItem(key);
    return Promise.resolve();
  },
};

const storage = Platform.OS === 'web' ? LocalStorageAdapter : SecureStoreAdapter;

const url = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, anonKey, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    // PKCE es el flujo que Supabase recomienda para OAuth en apps: la sesión
    // llega como `code` de un solo uso, no como tokens en la URL. En web el
    // cliente lo intercambia solo al volver de Google; en nativo lo hace
    // `iniciarSesionConGoogle` a mano con el deep link.
    flowType: 'pkce',
    detectSessionInUrl: Platform.OS === 'web',
  },
});
