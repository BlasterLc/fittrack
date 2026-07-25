import { supabase } from './supabase';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL!;

export async function apiGet<T>(path: string): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const respuesta = await fetch(`${BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!respuesta.ok) {
    throw new Error(`Error ${respuesta.status} al pedir ${path}`);
  }
  return respuesta.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const respuesta = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!respuesta.ok) {
    let detalle = `Error ${respuesta.status} al pedir ${path}`;
    try {
      const cuerpo = await respuesta.json();
      if (cuerpo?.detail) detalle = cuerpo.detail;
    } catch {
      // sin cuerpo JSON; se queda el mensaje genérico
    }
    throw new Error(detalle);
  }
  return respuesta.json() as Promise<T>;
}
