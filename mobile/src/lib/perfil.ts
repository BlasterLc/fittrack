// Las opciones de cada dato viven acá y en ningún otro lado: el asistente y
// la pantalla de perfil abren la MISMA hoja. Si cada pantalla declarara sus
// etiquetas, una terminaría divergiendo de la otra.

export type Sexo = 'hombre' | 'mujer';
export type Actividad = 'poco' | 'moderado' | 'alto';
export type Objetivo = 'bajar' | 'mantener' | 'ganar';

export type Metas = {
  calorias: number;
  prot_g: number;
  carb_g: number;
  fat_g: number;
};

export type Perfil = {
  nombre: string | null;
  sexo: Sexo | null;
  fecha_nacimiento: string | null; // ISO 'YYYY-MM-DD'
  altura_cm: number | null;
  peso_kg: number | null;
  actividad: Actividad | null;
  objetivo: Objetivo | null;
  completo: boolean;
  metas_son_manuales: boolean;
  metas: Metas | null;
  mantenimiento: number | null;
};

export type Previsualizacion = {
  completo: boolean;
  metas: Metas | null;
  mantenimiento: number | null;
};

// Lo que viaja en el PUT y en el preview. Describe el estado final: lo que
// va en null se borra.
export type FichaBorrador = {
  nombre: string | null;
  sexo: Sexo | null;
  fecha_nacimiento: string | null;
  altura_cm: number | null;
  peso_kg: number | null;
  actividad: Actividad | null;
  objetivo: Objetivo | null;
  metas_manuales: Metas | null;
};

/**
 * La ficha con la que se abre cualquier pantalla de edición.
 *
 * Siempre se parte del perfil guardado, nunca de una ficha vacía: el PUT
 * converge y un campo en null borra el valor. Por eso acá no hay una constante
 * FICHA_VACIA; existía y el asistente arrancaba con ella, y guardar borraba la
 * ficha entera. Para el usuario sin perfil el GET ya devuelve todo en null.
 */
export function borradorDesde(perfil: Perfil): FichaBorrador {
  return {
    nombre: perfil.nombre,
    sexo: perfil.sexo,
    fecha_nacimiento: perfil.fecha_nacimiento,
    altura_cm: perfil.altura_cm,
    peso_kg: perfil.peso_kg,
    actividad: perfil.actividad,
    objetivo: perfil.objetivo,
    metas_manuales: perfil.metas_son_manuales ? perfil.metas : null,
  };
}

export const OPCIONES_SEXO: { valor: Sexo; label: string }[] = [
  { valor: 'hombre', label: 'Hombre' },
  { valor: 'mujer', label: 'Mujer' },
];

// La descripción no es decorativa: sin ella nadie sabe si sale "poco" o
// "moderado", y el número que devuelve el cálculo depende de acertar.
export const OPCIONES_ACTIVIDAD: { valor: Actividad; label: string; detalle: string }[] = [
  { valor: 'poco', label: 'Poco', detalle: 'Trabajo sentado, sin ejercicio regular' },
  { valor: 'moderado', label: 'Moderado', detalle: 'Entreno 3 a 5 veces por semana' },
  { valor: 'alto', label: 'Alto', detalle: 'Entreno casi todos los días o trabajo físico' },
];

// En lenguaje de usuario: nada de "déficit" ni "superávit". Lo pidió Matías.
export const OPCIONES_OBJETIVO: { valor: Objetivo; label: string; detalle: string }[] = [
  { valor: 'bajar', label: 'Bajar de peso', detalle: 'Comer por debajo de tu mantenimiento' },
  { valor: 'mantener', label: 'Mantener', detalle: 'Quedarte donde estás' },
  { valor: 'ganar', label: 'Ganar masa muscular', detalle: 'Comer por encima de tu mantenimiento' },
];

export function etiquetaDe<T extends string>(
  opciones: { valor: T; label: string }[],
  valor: T | null,
): string | null {
  return opciones.find((o) => o.valor === valor)?.label ?? null;
}

/** Formatea 'YYYY-MM-DD' como '14 de marzo de 1998'. Sin librería de fechas. */
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

export function fechaLegible(iso: string | null): string | null {
  if (!iso) return null;
  const [anio, mes, dia] = iso.split('-').map(Number);
  return `${dia} de ${MESES[mes - 1]} de ${anio}`;
}

/** La inicial del botón de cuenta: del nombre si hay, si no del correo. */
export function inicialDe(nombre: string | null, email: string | undefined): string {
  const fuente = nombre?.trim() || email || '';
  return fuente.charAt(0).toUpperCase() || '?';
}
