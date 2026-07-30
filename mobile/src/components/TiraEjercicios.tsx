import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { colors, fonts, fontSize, spacing } from '@/theme/tokens';
import { seriesHechas, type EjercicioBorrador } from '@/lib/sesion';

const TAMANO = 56;
const PASO = TAMANO + spacing.sm;

type Estado = 'terminado' | 'actual' | 'pendiente' | 'saltado';

// "Terminado" y "saltado" se definen por posición relativa a `indiceActual`:
// un ejercicio anterior con series HECHAS está terminado, uno anterior sin
// ninguna quedó saltado.
//
// Se cuentan las hechas, no `series.length`: desde la tabla de series los
// ejercicios nacen con sus filas planificadas, así que la longitud es mayor
// que cero incluso en uno que no se tocó, y todo se vería como terminado.
function estadoDe(ejercicio: EjercicioBorrador, indice: number, indiceActual: number): Estado {
  if (indice === indiceActual) return 'actual';
  if (indice < indiceActual) return seriesHechas(ejercicio).length > 0 ? 'terminado' : 'saltado';
  return 'pendiente';
}

/**
 * Fila horizontal de miniaturas, una por ejercicio, más un chip «+» al
 * final. Mantiene el ejercicio actual a la vista con `scrollTo` cada vez que
 * cambia `indiceActual` (incluida la posición inicial al montar).
 */
export function TiraEjercicios({
  ejercicios,
  indiceActual,
  onSeleccionar,
  onAgregar,
}: {
  ejercicios: EjercicioBorrador[];
  indiceActual: number;
  onSeleccionar: (indice: number) => void;
  onAgregar: () => void;
}) {
  const scroll = useRef<ScrollView>(null);

  useEffect(() => {
    // Deja un ejercicio de contexto antes del actual, no lo pega al borde.
    scroll.current?.scrollTo({ x: Math.max(0, indiceActual * PASO - PASO), animated: true });
  }, [indiceActual]);

  return (
    <ScrollView
      ref={scroll}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.contenido}
    >
      {ejercicios.map((ejercicio, indice) => (
        <Miniatura
          key={ejercicio.catalogId}
          ejercicio={ejercicio}
          estado={estadoDe(ejercicio, indice, indiceActual)}
          onPress={() => onSeleccionar(indice)}
        />
      ))}
      <Pressable
        style={styles.chip}
        onPress={onAgregar}
        accessibilityRole="button"
        accessibilityLabel="Agregar ejercicio"
      >
        <Text style={styles.chipTexto}>+</Text>
      </Pressable>
    </ScrollView>
  );
}

function Miniatura({
  ejercicio,
  estado,
  onPress,
}: {
  ejercicio: EjercicioBorrador;
  estado: Estado;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[
        styles.miniatura,
        estado === 'actual' && styles.actual,
        estado === 'terminado' && styles.terminado,
        estado === 'saltado' && styles.saltado,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={ejercicio.nombre}
    >
      {/* Sin autoplay: un GIF animado por miniatura, multiplicado por toda la
          tira, es ruido durante un entrenamiento. El GIF sí se anima en la
          cabecera del ejercicio actual (Tarea 12). */}
      <Image
        source={{ uri: ejercicio.gifUrl }}
        style={styles.imagen}
        contentFit="contain"
        autoplay={false}
        cachePolicy="memory-disk"
        recyclingKey={ejercicio.catalogId}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  contenido: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  // 56×56: por encima del mínimo táctil de Android (48×48dp) en los dos ejes.
  miniatura: {
    width: TAMANO,
    height: TAMANO,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
    backgroundColor: colors.sesionSurface,
  },
  actual: { borderColor: colors.primaryText },
  terminado: { opacity: 0.5 },
  saltado: { opacity: 0.35 },
  imagen: { width: '100%', height: '100%' },
  chip: {
    width: TAMANO,
    height: TAMANO,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.sesionBorde,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.sesionSurface,
  },
  chipTexto: { color: colors.sesionInk, fontFamily: fonts.semibold, fontSize: fontSize.xl },
});
