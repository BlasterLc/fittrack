import { useEffect } from 'react';
import { BackHandler } from 'react-native';
import type { useRouter } from 'expo-router';

type Router = ReturnType<typeof useRouter>;
type Destino = Parameters<Router['replace']>[0];

/**
 * "‹ Atrás" en pantalla y el back nativo de Android (botón físico o gesto de
 * borde) tienen que llevar al mismo lugar. Sin un destino de respaldo, una
 * pantalla sin historial —llegada por `router.replace()`, como el asistente
 * obligatorio que se abre justo después de crear una cuenta— deja que
 * Android cierre la app entera en vez de navegar dentro de ella.
 */
export function volverOA(router: Router, destino: Destino) {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(destino);
  }
}

/**
 * Conecta el back nativo de Android (botón físico y gesto de borde, ambos
 * pasan por el mismo evento porque `app.json` desactiva el predictive back)
 * a la misma lógica que ya usa el botón "‹ Atrás" en pantalla.
 */
export function useBackNativo(alPresionar: () => void) {
  useEffect(() => {
    const suscripcion = BackHandler.addEventListener('hardwareBackPress', () => {
      alPresionar();
      return true;
    });
    return () => suscripcion.remove();
  }, [alPresionar]);
}
