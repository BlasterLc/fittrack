import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { colors, spacing, fonts, fontSize } from '@/theme/tokens';

// Compartidos por el asistente y la pantalla de perfil. Si cada pantalla
// tuviera su copia, una terminaría divergiendo: es exactamente lo que pasó
// con los encabezados antes de extraer EncabezadoPantalla.

export function Fila({
  etiqueta,
  valor,
  onPress,
}: {
  etiqueta: string;
  valor: string | null;
  onPress?: () => void;
}) {
  return (
    <Pressable style={styles.fila} onPress={onPress} disabled={!onPress}>
      <Text style={styles.filaEtiqueta}>{etiqueta}</Text>
      <Text style={[styles.filaValor, !valor && styles.filaVacio]}>{valor ?? 'Sin definir'}</Text>
    </Pressable>
  );
}

export function FilaNumero({
  etiqueta,
  unidad,
  valor,
  decimal,
  onCambio,
  onFinEdicion,
}: {
  etiqueta: string;
  unidad: string;
  valor: number | null;
  decimal?: boolean;
  onCambio: (valor: number | null) => void;
  /** Se llama al perder el foco. Quien guarda contra el servidor lo hace acá,
   *  no en cada tecla: "18" camino a "180" es un valor que el backend rechaza. */
  onFinEdicion?: (valor: number | null) => void;
}) {
  // El estado del campo es el TEXTO, no el número. Controlar el TextInput con
  // el número rompía dos cosas:
  //
  // 1. Escribir "78." era imposible: parseFloat("78.") da 78, el estado no
  //    cambiaba, y RN devuelve el texto nativo al `value` de JS cuando no
  //    coinciden (TextInput.js, el useLayoutEffect que compara lastNativeText
  //    con props.value). El punto desaparecía y "5" quedaba como "785".
  // 2. Borrar el último carácter daba NaN, o sea null, y el campo volvía a
  //    mostrar el valor anterior mientras el usuario seguía escribiendo.
  //
  // Se siembra una sola vez, en el inicializador de useState. Nada de hidratar
  // por efecto: ese efecto vuelve a correr con cada refetch de la consulta y
  // pisa lo que el usuario está escribiendo (pasó en la Fase 5b).
  const [texto, setTexto] = useState(() => (valor === null ? '' : String(valor)));

  function interpretar(crudo: string): number | null {
    const limpio = crudo.replace(',', '.');
    const n = decimal ? parseFloat(limpio) : parseInt(limpio, 10);
    return Number.isFinite(n) ? n : null;
  }

  return (
    <View style={styles.fila}>
      <Text style={styles.filaEtiqueta}>{etiqueta}</Text>
      <View style={styles.filaEntrada}>
        <TextInput
          style={styles.numero}
          value={texto}
          onChangeText={(t) => {
            setTexto(t);
            onCambio(interpretar(t));
          }}
          // Solo onBlur, no también onEndEditing: los dos disparan al terminar
          // de editar y quien guarde mandaría el mismo PUT dos veces.
          onBlur={() => onFinEdicion?.(interpretar(texto))}
          keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
          placeholder="—"
          placeholderTextColor={colors.muted}
          maxLength={5}
        />
        <Text style={styles.unidad}>{unidad}</Text>
      </View>
    </View>
  );
}

export function Tarjeta({
  label,
  detalle,
  activa,
  onPress,
}: {
  label: string;
  detalle: string;
  activa: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.tarjeta, activa && styles.tarjetaActiva]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: activa }}
    >
      <Text style={[styles.tarjetaLabel, activa && styles.tarjetaLabelActiva]}>{label}</Text>
      <Text style={styles.tarjetaDetalle}>{detalle}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    // Sin padding: el alto lo fija minHeight, y así la fila de texto y la
    // numérica miden lo mismo. Antes la numérica quedaba 14dp más alta que
    // sus vecinas y el campo de adentro no llegaba a 48.
    paddingVertical: 0,
    minHeight: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  filaEtiqueta: { color: colors.muted, fontFamily: fonts.regular, fontSize: fontSize.base },
  filaValor: { color: colors.ink, fontFamily: fonts.medium, fontSize: fontSize.base },
  filaVacio: { color: colors.muted },
  filaEntrada: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  numero: {
    color: colors.ink,
    fontFamily: fonts.medium,
    fontSize: fontSize.base,
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
    minWidth: 60,
    // 48dp de alto real: es el blanco táctil mínimo de Android y acá el
    // TextInput ES el control, no la fila que lo contiene.
    minHeight: 48,
    paddingVertical: 0,
  },
  unidad: { color: colors.muted, fontFamily: fonts.regular, fontSize: fontSize.base },
  tarjeta: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    padding: spacing.lg,
    marginBottom: spacing.md,
    gap: 2,
  },
  tarjetaActiva: { borderColor: colors.primary, backgroundColor: colors.surface2 },
  tarjetaLabel: { color: colors.ink, fontFamily: fonts.medium, fontSize: fontSize.base },
  tarjetaLabelActiva: { fontFamily: fonts.semibold },
  tarjetaDetalle: { color: colors.muted, fontFamily: fonts.regular, fontSize: fontSize.sm },
});
