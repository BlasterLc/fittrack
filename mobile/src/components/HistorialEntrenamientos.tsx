import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { EjercicioDeHistorial, EntrenamientoDeHistorial } from '@/hooks/useProgreso';
import { colors, spacing, fonts, fontSize } from '@/theme/tokens';

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

type Mes = {
  clave: string;
  titulo: string;
  entrenamientos: EntrenamientoDeHistorial[];
  totalSeries: number;
  totalMinutos: number;
};

/**
 * Agrupa por mes LOCAL. La agrupación de calendario vive del lado del cliente
 * en todo el proyecto: el servidor pagina por cantidad y no sabe en qué huso
 * cae cada entrenamiento.
 */
export function agruparPorMes(entrenamientos: EntrenamientoDeHistorial[]): Mes[] {
  const meses: Mes[] = [];
  for (const e of entrenamientos) {
    const fecha = new Date(e.started_at);
    const clave = `${fecha.getFullYear()}-${fecha.getMonth()}`;
    let mes = meses.find((m) => m.clave === clave);
    if (!mes) {
      mes = {
        clave,
        titulo: `${MESES[fecha.getMonth()]} de ${fecha.getFullYear()}`,
        entrenamientos: [],
        totalSeries: 0,
        totalMinutos: 0,
      };
      meses.push(mes);
    }
    mes.entrenamientos.push(e);
    mes.totalSeries += e.total_series;
    mes.totalMinutos += e.duracion_min;
  }
  return meses;
}

function desglose(ejercicio: EjercicioDeHistorial): string {
  const [primera, ...resto] = ejercicio.series;
  if (!primera) return '';
  const iguales = resto.every((s) => s.reps === primera.reps && s.weight_kg === primera.weight_kg);
  const kg = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
  if (iguales) {
    return `${ejercicio.series.length} × ${primera.reps} · ${kg(primera.weight_kg)} kg`;
  }
  return ejercicio.series.map((s) => `${s.reps} × ${kg(s.weight_kg)} kg`).join(', ');
}

function Entrenamiento({ entrenamiento }: { entrenamiento: EntrenamientoDeHistorial }) {
  const [abierto, setAbierto] = useState(false);
  const fecha = new Date(entrenamiento.started_at);

  return (
    <View style={styles.item}>
      <Pressable
        // 48dp con alto real en el Pressable mismo: un minHeight en un
        // contenedor con alignItems centrado no estira al hijo.
        style={styles.cabecera}
        onPress={() => setAbierto((previo) => !previo)}
        accessibilityRole="button"
        accessibilityState={{ expanded: abierto }}
        accessibilityLabel={`${entrenamiento.nombre_rutina ?? 'Entrenamiento'}, ${entrenamiento.total_series} series`}
      >
        <View style={styles.textoCabecera}>
          <Text style={styles.nombre} numberOfLines={1}>
            {entrenamiento.nombre_rutina ?? 'Entrenamiento'}
          </Text>
          <Text style={styles.detalle}>
            {fecha.getDate()} de {MESES[fecha.getMonth()]} · {entrenamiento.duracion_min} min ·{' '}
            {entrenamiento.total_series}{' '}
            {entrenamiento.total_series === 1 ? 'serie' : 'series'}
          </Text>
        </View>
        <Text style={styles.chevron}>{abierto ? '⌄' : '›'}</Text>
      </Pressable>

      {abierto && (
        <View style={styles.desplegado}>
          {entrenamiento.ejercicios.map((e) => (
            <View key={`${e.catalog_id}-${e.nombre_es}`} style={styles.ejercicio}>
              <Text style={styles.ejercicioNombre} numberOfLines={2}>
                {e.nombre_es}
              </Text>
              <Text style={styles.ejercicioSeries}>{desglose(e)}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export function HistorialEntrenamientos({
  entrenamientos,
  hayMas,
  cargandoMas,
  onVerMas,
}: {
  entrenamientos: EntrenamientoDeHistorial[];
  hayMas: boolean;
  cargandoMas: boolean;
  onVerMas: () => void;
}) {
  if (entrenamientos.length === 0) {
    return (
      <View style={styles.bloque}>
        <Text style={styles.titulo}>Historial</Text>
        {/* Enseña qué va a aparecer, en vez de un «nada por aquí»: aquí el vacío
            es el estado normal durante las primeras semanas. */}
        <Text style={styles.vacio}>
          Cuando termines un entrenamiento va a quedar aquí, agrupado por mes. Puedes abrir
          cualquiera para ver los kilos y las repeticiones de cada serie.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.bloque}>
      <Text style={styles.titulo}>Historial</Text>
      {agruparPorMes(entrenamientos).map((mes) => (
        <View key={mes.clave}>
          <Text style={styles.mes}>
            {mes.titulo} · {mes.entrenamientos.length}{' '}
            {mes.entrenamientos.length === 1 ? 'entrenamiento' : 'entrenamientos'} ·{' '}
            {mes.totalSeries} series · {mes.totalMinutos} min
          </Text>
          {mes.entrenamientos.map((e) => (
            <Entrenamiento key={e.id} entrenamiento={e} />
          ))}
        </View>
      ))}

      {/* Un botón y no scroll infinito: el historial vive dentro del ScrollView
          de la pantalla, y anidar una lista con su propio scroll ahí es un
          antipatrón que rompe el gesto. */}
      {hayMas && (
        <Pressable
          style={styles.verMas}
          onPress={onVerMas}
          disabled={cargandoMas}
          accessibilityRole="button"
        >
          <Text style={styles.verMasTexto}>
            {cargandoMas ? 'Cargando…' : 'Ver entrenamientos anteriores'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bloque: { gap: spacing.sm },
  titulo: { color: colors.ink, fontFamily: fonts.semibold, fontSize: fontSize.base },
  vacio: { color: colors.muted, fontFamily: fonts.regular, fontSize: fontSize.sm, lineHeight: 20 },
  mes: {
    color: colors.muted,
    fontFamily: fonts.medium,
    fontSize: fontSize.sm,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  item: { borderBottomWidth: 1, borderBottomColor: colors.line },
  cabecera: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  textoCabecera: { flex: 1, minWidth: 0 },
  nombre: { color: colors.ink, fontFamily: fonts.semibold, fontSize: fontSize.base },
  detalle: { color: colors.muted, fontFamily: fonts.regular, fontSize: fontSize.sm, marginTop: 2 },
  chevron: { color: colors.muted, fontFamily: fonts.regular, fontSize: fontSize.lg },
  desplegado: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  ejercicio: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  ejercicioNombre: { flex: 1, color: colors.ink, fontFamily: fonts.regular, fontSize: fontSize.sm },
  ejercicioSeries: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: fontSize.sm,
    fontVariant: ['tabular-nums'],
  },
  // 48dp con alto real, no con hitSlop: en Android un hitSlop que se sale del
  // padre no recibe el toque.
  verMas: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  // `primaryText` y nunca `primary`: como color de texto, `primary` no llega a
  // 4,5:1 en ningún fondo de la app.
  verMasTexto: { color: colors.primaryText, fontFamily: fonts.semibold, fontSize: fontSize.base },
});
