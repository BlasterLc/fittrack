import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { queryClient } from './query';
import { supabase } from './supabase';

type SessionState = { session: Session | null; isLoading: boolean };

const SessionContext = createContext<SessionState>({ session: null, isLoading: true });

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((evento, nuevaSesion) => {
      // Sin esto, la caché de react-query (perfil, dashboard, etc.) sobrevive
      // al logout y la siguiente cuenta que inicie sesión en el mismo proceso
      // ve datos del usuario anterior hasta que cada query decida refrescar.
      if (evento === 'SIGNED_OUT') {
        queryClient.clear();
      }
      setSession(nuevaSesion);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return <SessionContext.Provider value={{ session, isLoading }}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  return useContext(SessionContext);
}
