import { useCallback, useEffect, useState } from 'react';
import {
  borrarBorrador,
  escribirBorrador,
  leerBorrador,
  type BorradorSesion,
} from '@/lib/sesion';

/**
 * El borrador de la sesión en curso.
 *
 * No lleva debounce, al revés que el perfil: acá los cambios son discretos y
 * espaciados —serie hecha, agregar o eliminar una serie, cambiar de ejercicio—
 * porque girar una rueda no confirma nada. Escribir en cada cambio es correcto
 * y no cuesta nada.
 */
export function useSesion() {
  const [borrador, setBorrador] = useState<BorradorSesion | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    leerBorrador().then((b) => {
      setBorrador(b);
      setCargando(false);
    });
  }, []);

  const actualizar = useCallback((siguiente: BorradorSesion) => {
    setBorrador(siguiente);
    void escribirBorrador(siguiente);
  }, []);

  const descartar = useCallback(() => {
    setBorrador(null);
    void borrarBorrador();
  }, []);

  return { borrador, cargando, actualizar, descartar };
}
