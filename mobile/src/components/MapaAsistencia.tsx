import { useEffect, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { claveDeDia, type DiaEntrenado } from '@/hooks/useProgreso';
import { colors, spacing, fonts, fontSize } from '@/theme/tokens';

const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * La ventana visible según cuánto historial haya, de la más chica a la más
 * grande. Empezar en un año fijo dejaría 364 huecos y un punto durante meses.
 */
const VENTANAS = [
  { semanas: 8, casilla: 26 },
  { semanas: 26, casilla: 14 },
  { semanas: 53, casilla: 9 },
] as const;

function tono(minutos: number): string {
  if (minutos > 70) return colors.mapaLarga;
  if (minutos >= 40) return colors.mapaNormal;
  return colors.mapaCorta;
}

/**
 * Los minutos entrenados por día local.
 *
 * Dos entrenamientos del mismo día SUMAN sus minutos: un día es un día, no dos
 * casillas ni la más larga de las dos.
 */
export function minutosPorDia(dias: DiaEntrenado[]): Map<string, number> {
  const porDia = new Map<string, number>();
  for (const d of dias) {
    const clave = claveDeDia(new Date(d.started_at));
    porDia.set(clave, (porDia.get(clave) ?? 0) + d.minutos);
  }
  return porDia;
}

/**
 * Semanas con 3 o más días entrenados, contadas hacia atrás desde la actual.
 *
 * Una racha diaria premia entrenar sin descansar, que es malo, y se rompe sola.
 * La semana en curso solo cuenta cuando YA llegó a 3: si no, un jueves con dos
 * días rompería la racha por una semana que todavía no termina.
 */
export function rachaDeSemanas(porDia: Map<string, number>, ahora = new Date()): number {
  const desdeElLunes = (ahora.getDay() + 6) % 7;
  const lunesActual = new Date(
    ahora.getFullYear(),
    ahora.getMonth(),
    ahora.getDate() - desdeElLunes,
  );

  let racha = 0;
  for (let semana = 0; ; semana++) {
    const lunes = new Date(lunesActual.getTime() - semana * 7 * DIA_MS);
    let dias = 0;
    for (let i = 0; i < 7; i++) {
      const dia = new Date(lunes.getTime() + i * DIA_MS);
      if (porDia.has(claveDeDia(dia))) dias++;
    }
    if (dias >= 3) {
      racha++;
      continue;
    }
    // La semana en curso sin sus 3 días todavía no rompe nada: sigue corriendo.
    if (semana === 0) continue;
    return racha;
  }
}

export function MapaAsistencia({ dias }: { dias: DiaEntrenado[] }) {
  const porDia = minutosPorDia(dias);
  const hoy = new Date();

  // La cuadrícula arranca el lunes de la primera semana visible, así cada
  // columna es una semana entera y las filas se alinean por día. Se calcula
  // ANTES de elegir la ventana porque la ventana necesita esta misma base.
  const desdeElLunes = (hoy.getDay() + 6) % 7;
  const lunesActual = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - desdeElLunes);

  // La ventana más chica que contenga el primer entrenamiento. Sin datos, la
  // más chica: no tiene sentido abrir en un año vacío.
  //
  // Se cuenta en SEMANAS CALENDARIO alineadas a lunes, igual que la grilla —
  // NUNCA en días crudos desde `hoy`. Contar días crudos desalinea con
  // `primerLunes` (que sí está alineado a lunes) hasta en 6 días según qué día
  // de la semana se abra la app: el entrenamiento que decidió el tamaño de la
  // ventana podía caer justo ANTES de la primera columna visible y
  // desaparecer del mapa sin avisar.
  const masViejo = dias.reduce<number | null>((min, d) => {
    const t = new Date(d.started_at).getTime();
    return min === null || t < min ? t : min;
  }, null);
  let semanasNecesarias = 1;
  if (masViejo !== null) {
    const fechaMasViejo = new Date(masViejo);
    const diaMasViejo = (fechaMasViejo.getDay() + 6) % 7;
    const lunesMasViejo = new Date(
      fechaMasViejo.getFullYear(),
      fechaMasViejo.getMonth(),
      fechaMasViejo.getDate() - diaMasViejo,
    );
    semanasNecesarias =
      Math.round((lunesActual.getTime() - lunesMasViejo.getTime()) / (7 * DIA_MS)) + 1;
  }
  const ventana =
    VENTANAS.find((v) => semanasNecesarias <= v.semanas) ?? VENTANAS[VENTANAS.length - 1];

  const primerLunes = new Date(lunesActual.getTime() - (ventana.semanas - 1) * 7 * DIA_MS);

  const columnas = Array.from({ length: ventana.semanas }, (_, semana) =>
    Array.from({ length: 7 }, (_, dia) => {
      const fecha = new Date(primerLunes.getTime() + (semana * 7 + dia) * DIA_MS);
      const minutos = porDia.get(claveDeDia(fecha));
      return {
        clave: claveDeDia(fecha),
        // Un día sin entrenar es un hueco vacío, no un nivel 0 pintado.
        color: minutos === undefined ? colors.mapaVacio : tono(minutos),
        futuro: fecha.getTime() > hoy.getTime(),
      };
    }),
  );

  const racha = rachaDeSemanas(porDia, hoy);
  const totalDias = porDia.size;

  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    // `flexDirection: 'row-reverse'` no sirve para esto: con un solo hijo que ya
    // ocupa todo el ancho intrínseco, Yoga no tiene espacio libre que
    // redistribuir y es un no-op. Se salta al final explícitamente, el mismo
    // patrón que usa TiraEjercicios.tsx para posicionar el scroll.
    scrollRef.current?.scrollToEnd({ animated: false });
  }, [ventana.semanas]);

  const cuadricula = (
    <View style={styles.cuadricula}>
      {columnas.map((semana, i) => (
        <View key={i} style={styles.semana}>
          {semana.map((d) => (
            <View
              key={d.clave}
              style={[
                styles.casilla,
                { width: ventana.casilla, height: ventana.casilla },
                { backgroundColor: d.color },
                d.futuro && styles.futuro,
              ]}
            />
          ))}
        </View>
      ))}
    </View>
  );

  return (
    <View style={styles.bloque}>
      <Text style={styles.titulo}>Días entrenados</Text>

      {/* Las casillas NO son tocables y 26px no es un tamaño táctil: el mínimo
          de Android son 48dp. Si algún día se quiere tocar un día, se resuelve
          con una hoja o una fila debajo, no agrandando la cuadrícula. */}
      {ventana.semanas <= 8 ? (
        cuadricula
      ) : (
        <ScrollView ref={scrollRef} horizontal showsHorizontalScrollIndicator={false}>
          {cuadricula}
        </ScrollView>
      )}

      <View style={styles.cifras}>
        <View>
          <Text style={styles.cifra}>{totalDias}</Text>
          <Text style={styles.etiqueta}>{totalDias === 1 ? 'día' : 'días'}</Text>
        </View>
        <View>
          <Text style={styles.cifra}>{racha}</Text>
          <Text style={styles.etiqueta}>
            {racha === 1 ? 'semana de racha' : 'semanas de racha'}
          </Text>
        </View>
      </View>
      <Text style={styles.pie}>Una semana cuenta para la racha con 3 días o más.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bloque: { gap: spacing.md },
  titulo: { color: colors.ink, fontFamily: fonts.semibold, fontSize: fontSize.base },
  cuadricula: { flexDirection: 'row', gap: 3 },
  semana: { gap: 3 },
  casilla: { borderRadius: 3 },
  // Los días que todavía no llegaron no se dibujan como huecos: no son días sin
  // entrenar, no existen todavía.
  futuro: { opacity: 0 },
  cifras: { flexDirection: 'row', gap: spacing.xl },
  cifra: {
    color: colors.ink,
    fontFamily: fonts.bold,
    fontSize: fontSize.xl,
    fontVariant: ['tabular-nums'],
  },
  etiqueta: { color: colors.muted, fontFamily: fonts.regular, fontSize: fontSize.sm },
  pie: { color: colors.muted, fontFamily: fonts.regular, fontSize: fontSize.sm },
});
