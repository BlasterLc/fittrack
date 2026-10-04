import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabase';

export type ResultadoGoogle = { ok: true } | { ok: false; mensaje: string | null };

const ERROR_GENERICO = 'No pudimos iniciar sesión con Google. Intenta de nuevo.';

// Saca el `code` de la URL a la que Supabase devuelve al usuario. Con PKCE
// llega en el query string; si el proveedor falló, viene un `error` en su
// lugar y no hay `code`.
export function leerCodigoOAuth(url: string): string | null {
  const code = Linking.parse(url).queryParams?.code;
  return typeof code === 'string' && code ? code : null;
}

// Mismo path en web y en nativo: `https://<sitio>/callback` o `<scheme>://callback`.
// Tiene que estar en la allowlist de redirect URLs del panel de Supabase.
export function urlDeRetorno(): string {
  return Linking.createURL('callback');
}

export async function iniciarSesionConGoogle(): Promise<ResultadoGoogle> {
  const redirectTo = urlDeRetorno();

  if (Platform.OS === 'web') {
    // En web supabase-js redirige la pestaña a Google. Al volver, el cliente
    // (detectSessionInUrl) intercambia el `code` solo; esta promesa no llega a
    // resolverse porque la página se descarga.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    return error ? { ok: false, mensaje: ERROR_GENERICO } : { ok: true };
  }

  // En nativo se pide la URL sin abrirla y se abre en el navegador del
  // sistema; `openAuthSessionAsync` espera el deep link de vuelta.
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data.url) return { ok: false, mensaje: ERROR_GENERICO };

  const resultado = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  // Cerrar el navegador sin terminar no es un error que mostrarle al usuario.
  if (resultado.type !== 'success') return { ok: false, mensaje: null };

  const code = leerCodigoOAuth(resultado.url);
  if (!code) return { ok: false, mensaje: ERROR_GENERICO };

  const { error: errorCanje } = await supabase.auth.exchangeCodeForSession(code);
  return errorCanje ? { ok: false, mensaje: ERROR_GENERICO } : { ok: true };
}
