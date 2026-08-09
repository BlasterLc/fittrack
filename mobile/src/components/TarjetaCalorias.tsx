import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, spacing, fonts, fontSize } from '@/theme/tokens';

const RADIO = 52;
const GROSOR = 10;
const CIRCUNFERENCIA = 2 * Math.PI * RADIO;
const CENTRO = RADIO + GROSOR;
const TAMANO = CENTRO * 2;

export function TarjetaCalorias({
  calorias,
  macros,
  metasMacros,
}: {
  calorias: { consumidas: number; meta: number };
  macros: { prot: number; carb: number; fat: number };
  metasMacros: { prot: number; carb: number; fat: number } | null;
}) {
  const fraccion = calorias.meta > 0 ? Math.min(calorias.consumidas / calorias.meta, 1) : 0;
  const offset = CIRCUNFERENCIA * (1 - fraccion);

  return (
    <View style={styles.tarjeta}>
      <View style={styles.anilloWrap}>
        <Svg width={TAMANO} height={TAMANO} style={{ transform: [{ rotate: '-90deg' }] }}>
          <Circle cx={CENTRO} cy={CENTRO} r={RADIO} stroke={colors.surface2} strokeWidth={GROSOR} fill="none" />
          <Circle
            cx={CENTRO}
            cy={CENTRO}
            r={RADIO}
            stroke={colors.primary}
            strokeWidth={GROSOR}
            fill="none"
            strokeDasharray={CIRCUNFERENCIA}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </Svg>
        <View style={styles.anilloTexto} pointerEvents="none">
          <Text style={styles.anilloNumero}>{calorias.consumidas}</Text>
          <Text style={styles.anilloMeta}>/ {calorias.meta} kcal</Text>
        </View>
      </View>
      <BarraMacro etiqueta="Proteína" valor={macros.prot} meta={metasMacros?.prot ?? null} color={colors.prot} />
      <BarraMacro etiqueta="Carbohidratos" valor={macros.carb} meta={metasMacros?.carb ?? null} color={colors.carb} />
      <BarraMacro etiqueta="Grasas" valor={macros.fat} meta={metasMacros?.fat ?? null} color={colors.fat} />
    </View>
  );
}

function BarraMacro({
  etiqueta,
  valor,
  meta,
  color,
}: {
  etiqueta: string;
  valor: number;
  meta: number | null;
  color: string;
}) {
  // Sin meta de perfil (perfil incompleto) no hay contra qué medir el
  // avance: la barra queda vacía en vez de sugerir un progreso que no existe.
  const fraccion = meta && meta > 0 ? Math.min(valor / meta, 1) : 0;
  return (
    <View style={styles.barraFila}>
      <Text style={styles.barraEtiqueta}>{etiqueta}</Text>
      <View style={styles.barraTrack}>
        <View style={[styles.barraFill, { width: `${fraccion * 100}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.barraValor}>{Math.round(valor)} g</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tarjeta: { backgroundColor: colors.surface, borderRadius: 16, padding: spacing.lg },
  anilloWrap: { width: TAMANO, height: TAMANO, alignSelf: 'center', marginBottom: spacing.md },
  anilloTexto: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  anilloNumero: { color: colors.ink, fontFamily: fonts.bold, fontSize: fontSize.xl },
  anilloMeta: { color: colors.muted, fontFamily: fonts.regular, fontSize: fontSize.sm },
  barraFila: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  barraEtiqueta: { width: 96, color: colors.muted, fontFamily: fonts.regular, fontSize: fontSize.sm },
  barraTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.surface2, overflow: 'hidden' },
  barraFill: { height: '100%', borderRadius: 3 },
  barraValor: {
    width: 48,
    textAlign: 'right',
    color: colors.ink,
    fontFamily: fonts.medium,
    fontSize: fontSize.sm,
    fontVariant: ['tabular-nums'],
  },
});
