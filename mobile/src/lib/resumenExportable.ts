import { claveDeDia } from '@/hooks/useProgreso';
import type {
  ComidaExportableItem,
  EjercicioExportable,
  ResumenExportable,
  SerieExportable,
  SesionExportable,
} from '@/hooks/useProgreso';

/** Cuántos días de calendario locales distintos hay entre las sesiones. */
function diasEntrenadosDistintos(sesiones: SesionExportable[]): number {
  return new Set(sesiones.map((s) => claveDeDia(new Date(s.started_at)))).size;
}

type DiaComida = {
  fecha: Date;
  calorias: number;
  prot_g: number;
  carbs_g: number;
  fat_g: number;
  comidas: ComidaExportableItem[];
};

/** Agrupa comidas por día local. Mismo patrón que `agruparPorDia` en HistorialComida.tsx. */
function agruparComidaPorDia(comidas: ComidaExportableItem[]): DiaComida[] {
  const mapa = new Map<string, DiaComida>();
  for (const c of comidas) {
    const fecha = new Date(c.logged_at);
    const clave = claveDeDia(fecha);
    let dia = mapa.get(clave);
    if (!dia) {
      dia = { fecha, calorias: 0, prot_g: 0, carbs_g: 0, fat_g: 0, comidas: [] };
      mapa.set(clave, dia);
    }
    dia.calorias += c.calorias;
    dia.prot_g += c.prot_g;
    dia.carbs_g += c.carbs_g;
    dia.fat_g += c.fat_g;
    dia.comidas.push(c);
  }
  return [...mapa.values()].sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
}

function fmtCorta(fecha: Date): string {
  return fecha.toLocaleDateString('es-CL', { day: 'numeric', month: 'long' });
}

function fmtLarga(fecha: Date): string {
  return fecha.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });
}

function fmtHora(fecha: Date): string {
  return fecha.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false });
}

/** Sin decimales cuando no hacen falta: "60" en vez de "60.0", pero "62.5" tal cual. */
function fmtPeso(kg: number): string {
  return Number.isInteger(kg) ? String(kg) : kg.toFixed(1);
}

/** "60kg×8" o, en ejercicios de peso corporal (kg=0), "8 reps". */
function fmtSerie(s: SerieExportable): string {
  return s.weight_kg > 0 ? `${fmtPeso(s.weight_kg)}kg×${s.reps}` : `${s.reps} reps`;
}

function fmtEjercicio(e: EjercicioExportable): string {
  return `<li>${e.nombre}: ${e.series.map(fmtSerie).join(', ')}</li>`;
}

/** `null` es una comida de antes del #22 (sin etiqueta guardada), no "sin momento del día". */
function fmtComida(c: ComidaExportableItem): string {
  const hora = fmtHora(new Date(c.logged_at));
  return (
    `<li>${c.etiqueta ?? 'Comida'} (${hora}) — ${c.calorias} kcal` +
    (c.items.length > 0 ? `<br /><span class="items">${c.items.join(', ')}</span>` : '') +
    `</li>`
  );
}

const SIN_REGISTROS = '<p class="vacio">Sin registros en este período</p>';

function bloqueEntrenamiento(entrenamiento: ResumenExportable['entrenamiento']): string {
  if (entrenamiento.sesiones.length === 0) return SIN_REGISTROS;

  const dias = diasEntrenadosDistintos(entrenamiento.sesiones);
  const duracion = Math.round(entrenamiento.duracion_promedio_min ?? 0);
  const gruposTexto = entrenamiento.series_por_grupo
    .map((g) => `${g.grupo} ${g.series}`)
    .join(', ');
  const sesiones = entrenamiento.sesiones
    .map(
      (s) =>
        `<div class="sesion">` +
        `<p class="sesion-titulo">${fmtCorta(new Date(s.started_at))} · ${s.duracion_min} min · ` +
        `${s.series_totales} series · ${s.grupos.join(', ')}</p>` +
        `<ul class="ejercicios">${s.ejercicios.map(fmtEjercicio).join('')}</ul>` +
        `</div>`,
    )
    .join('');

  return (
    `<p>${dias} días entrenados · duración promedio ${duracion} min</p>` +
    `<p>Series por grupo muscular: ${gruposTexto}</p>` +
    sesiones
  );
}

function bloqueComida(comida: ResumenExportable['comida']): string {
  if (comida.comidas.length === 0) return SIN_REGISTROS;

  const kcal = Math.round(comida.promedio_calorias ?? 0);
  const prot = Math.round(comida.promedio_prot_g ?? 0);
  const carb = Math.round(comida.promedio_carbs_g ?? 0);
  const fat = Math.round(comida.promedio_fat_g ?? 0);
  const metaMacros = comida.metas_macros
    ? ` (meta P ${comida.metas_macros.prot} g · C ${comida.metas_macros.carb} g · G ${comida.metas_macros.fat} g)`
    : '';
  const dias = agruparComidaPorDia(comida.comidas)
    .map(
      (d) =>
        `<div class="dia">` +
        `<p class="dia-titulo">${fmtCorta(d.fecha)} · ${Math.round(d.calorias)} kcal · ` +
        `P ${Math.round(d.prot_g)} g · C ${Math.round(d.carbs_g)} g · G ${Math.round(d.fat_g)} g</p>` +
        `<ul class="comidas">${d.comidas.map(fmtComida).join('')}</ul>` +
        `</div>`,
    )
    .join('');

  return (
    `<p>Promedio diario: ${kcal} kcal (meta ${comida.meta_calorias}) · Proteína ${prot} g · ` +
    `Carbohidratos ${carb} g · Grasas ${fat} g${metaMacros}</p>` +
    dias
  );
}

function bloquePeso(peso: ResumenExportable['peso']): string {
  if (peso.registros.length === 0) return SIN_REGISTROS;

  const inicial = peso.inicial_kg!.toFixed(1);
  const final = peso.final_kg!.toFixed(1);
  const tendencia = peso.tendencia_kg!;
  const signo = tendencia >= 0 ? '+' : '';
  const filas = peso.registros
    .map(
      (r) =>
        `<tr><td>${fmtCorta(new Date(r.recorded_at))}</td><td>${r.kg.toFixed(1)} kg</td></tr>`,
    )
    .join('');

  return (
    `<p>Inicial ${inicial} kg → Final ${final} kg (${signo}${tendencia.toFixed(1)} kg en el período)</p>` +
    `<table>${filas}</table>`
  );
}

/** El HTML completo del PDF. Texto plano y sin el tema visual de la app: el
 * destino es una IA leyendo texto, no una pantalla. */
export function armarHtmlResumen(resumen: ResumenExportable): string {
  const desde = fmtLarga(new Date(resumen.desde));
  const hasta = fmtLarga(new Date(resumen.hasta));

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: -apple-system, sans-serif; padding: 24px; color: #111; }
          h1 { font-size: 20px; }
          h2 { font-size: 16px; margin-top: 24px; }
          table { border-collapse: collapse; width: 100%; margin-top: 8px; }
          td { padding: 4px 8px; border-bottom: 1px solid #ddd; font-size: 13px; }
          .vacio { color: #666; font-style: italic; }
          .sesion, .dia { margin-top: 10px; padding-bottom: 6px; border-bottom: 1px solid #ddd; }
          .sesion-titulo, .dia-titulo { font-size: 13px; font-weight: 600; margin: 0; }
          .ejercicios, .comidas { margin: 4px 0 0; padding-left: 18px; }
          .ejercicios li, .comidas li { font-size: 12px; margin-top: 2px; }
          .items { color: #666; }
        </style>
      </head>
      <body>
        <h1>FitTrack — Resumen del ${desde} al ${hasta}</h1>

        <h2>Entrenamiento</h2>
        ${bloqueEntrenamiento(resumen.entrenamiento)}

        <h2>Comida</h2>
        ${bloqueComida(resumen.comida)}

        <h2>Peso</h2>
        ${bloquePeso(resumen.peso)}
      </body>
    </html>
  `;
}

/** `YYYY-MM-DD` de cada borde, en UTC: es el nombre del archivo, no una fecha
 * que el usuario lea, así que no necesita huso local. */
export function nombreArchivo(resumen: ResumenExportable): string {
  const desde = resumen.desde.slice(0, 10);
  const hasta = resumen.hasta.slice(0, 10);
  return `fittrack-resumen-${desde}-a-${hasta}.pdf`;
}
