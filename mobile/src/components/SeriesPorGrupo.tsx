import { View, Text, StyleSheet } from 'react-native';
import type { SeriesDeGrupo } from '@/hooks/useProgreso';
import { colors, spacing, fonts, fontSize } from '@/theme/tokens';

// Orden anatómico fijo, para que las barras no salten de lugar de una semana a
// otra. Los grupos en cero se muestran igual: ver el cero es el punto.
const GRUPOS = [
  'Pecho',
  'Espalda',
  'Hombros',
  'Bíceps',
  'Tríceps',
  'Antebrazos',
  'Abdomen',
  'Piernas',
  'Pantorrillas',
] as const;

// Cardio, Cuello y «Sin clasificar» se cuentan pero van sin banda: un rango
// objetivo de 10 a 20 series no significa nada para ninguno de los tres.
const SIN_BANDA = ['Cardio', 'Cuello', 'Sin clasificar'];

const OBJETIVO_MIN = 10;
const OBJETIVO_MAX = 20;
const ESCALA = OBJETIVO_MAX + 5; // margen sobre el objetivo, el ancho completo de la pista

export function SeriesPorGrupo({ grupos }: { grupos: SeriesDeGrupo[] }) {
  const porGrupo = new Map(grupos.map((g) => [g.grupo, g.series]));

  // Los nueve de siempre, más los que llegaron con series y no están en la
  // lista fija (Cardio, Cuello y «Sin clasificar», que solo aparece si hay).
  const extras = grupos
    .filter((g) => !GRUPOS.includes(g.grupo as (typeof GRUPOS)[number]) && g.series > 0)
    .map((g) => g.grupo);
  const visibles = [...GRUPOS, ...extras];

  return (
    <View style={styles.bloque}>
      <Text style={styles.titulo}>Series de esta semana</Text>

      {visibles.map((grupo) => {
        const series = porGrupo.get(grupo) ?? 0;
        const conBanda = !SIN_BANDA.includes(grupo);
        return (
          <View key={grupo} style={styles.fila}>
            <Text style={styles.nombre} numberOfLines={1}>
              {grupo}
            </Text>
            <View style={styles.pista}>
              {conBanda && (
                <View
                  style={[
                    styles.banda,
                    {
                      left: `${(OBJETIVO_MIN / ESCALA) * 100}%`,
                      width: `${((OBJETIVO_MAX - OBJETIVO_MIN) / ESCALA) * 100}%`,
                    },
                  ]}
                />
              )}
              <View
                style={[
                  styles.relleno,
                  { width: `${Math.min(100, (series / ESCALA) * 100)}%` },
                ]}
              />
            </View>
            <Text style={styles.valor}>{series}</Text>
          </View>
        );
      })}

      {/* Sin ámbar. El spec maestro pedía marcar en ámbar lo que cae bajo el
          rango, pero mirando la semana en curso un lunes TODO está bajo 10: el
          bloque entero saldría ámbar cada lunes y se iría apagando. El ámbar en
          este proyecto es solo semántico, y un lunes en cero no necesita
          atención. La banda sola comunica el avance. */}
      <Text style={styles.pie}>
        La banda marca el rango objetivo, de {OBJETIVO_MIN} a {OBJETIVO_MAX} series.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bloque: { gap: spacing.sm },
  titulo: {
    color: colors.ink,
    fontFamily: fonts.semibold,
    fontSize: fontSize.base,
    marginBottom: spacing.xs,
  },
  fila: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  nombre: { width: 88, color: colors.ink, fontFamily: fonts.regular, fontSize: fontSize.sm },
  pista: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.surface2,
    overflow: 'hidden',
  },
  banda: { position: 'absolute', top: 0, bottom: 0, backgroundColor: colors.line },
  relleno: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.primary,
    borderRadius: 5,
  },
  valor: {
    width: 24,
    textAlign: 'right',
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: fontSize.sm,
    fontVariant: ['tabular-nums'],
  },
  pie: { color: colors.muted, fontFamily: fonts.regular, fontSize: fontSize.sm, marginTop: spacing.xs },
});
