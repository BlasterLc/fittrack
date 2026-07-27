/**
 * Buzón para pasarle al editor de rutinas los ejercicios elegidos en el
 * catálogo.
 *
 * No se usan parámetros de navegación, que era el plan original: volver con
 * `router.navigate` y parámetros nuevos NO reutiliza el editor que ya estaba
 * montado, apila una instancia nueva encima de la pantalla de selección. Eso
 * borraba el nombre a medio escribir (componente nuevo, estado nuevo) y dejaba
 * la pantalla de selección debajo en el stack, así que al guardar el `back()`
 * volvía al catálogo en vez de a la lista de rutinas.
 *
 * Con el buzón, la selección viaja fuera de la navegación y la pantalla vuelve
 * con un `back()` de verdad: el editor nunca se desmonta y el stack queda
 * limpio.
 */

let pendiente: string[] | null = null;

/** La pantalla de selección deja acá lo elegido, justo antes de volver. */
export function dejarSeleccion(ids: string[]) {
  pendiente = ids;
}

/**
 * El editor lo lee al recuperar el foco. Devuelve null si no hay nada nuevo,
 * y vacía el buzón para que la misma selección no se aplique dos veces.
 */
export function tomarSeleccion(): string[] | null {
  const valor = pendiente;
  pendiente = null;
  return valor;
}
