import { useEffect, useState } from 'react';

/**
 * Devuelve el valor con un retraso, reiniciando el reloj en cada cambio.
 *
 * Se usa en el buscador del catálogo: sin esto, escribir «sentadilla»
 * dispara diez peticiones y las respuestas pueden llegar desordenadas.
 */
export function useDebounce<T>(valor: T, ms = 300): T {
  const [retrasado, setRetrasado] = useState(valor);

  useEffect(() => {
    const reloj = setTimeout(() => setRetrasado(valor), ms);
    return () => clearTimeout(reloj);
  }, [valor, ms]);

  return retrasado;
}
