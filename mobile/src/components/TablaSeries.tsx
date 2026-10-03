import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { alerta } from '@/lib/alerta';
import {
  formatoKg,
  leerNumero,
  normalizarKg,
  normalizarReps,
  type EjercicioBorrador,
  type SerieBorrador,
} from '@/lib/sesion';
import { colors, spacing, fonts, fontSize } from '@/theme/tokens';

/**
 * Las series del ejercicio activo, una fila cada una: Serie · Previa · KG ·
 * REPS · ✓.
 *
 * Las filas existen desde que se abre el ejercicio, precargadas con lo que se
 * hizo la última vez. Registrar la serie 2 no cuesta un toque extra para
 * «agregarla»: ya está ahí, solo hay que marcarla. «+ Serie» es para cuando
 * hoy haces más de las planificadas, no el camino normal.
 */
export function TablaSeries({
  ejercicio,
  onCambiar,
}: {
  ejercicio: EjercicioBorrador;
  onCambiar: (series: SerieBorrador[]) => void;
}) {
  const previa =
    ejercicio.repsDefault !== null && ejercicio.kgDefault !== null
      ? `${formatoKg(ejercicio.kgDefault)}×${ejercicio.repsDefault}`
      : '—';

  function editar(indice: number, cambio: Partial<SerieBorrador>) {
    onCambiar(ejercicio.series.map((s, i) => (i === indice ? { ...s, ...cambio } : s)));
  }

  function alternarHecha(indice: number) {
    const serie = ejercicio.series[indice];
    editar(indice, {
      // Desmarcar borra la marca: el descanso y el fin del entrenamiento salen
      // de la última serie hecha, así que una marca vieja en una serie que ya
      // no cuenta los correría hacia adelante.
      completadaEn: serie.completadaEn === null ? new Date().toISOString() : null,
    });
  }

  function agregar() {
    // La fila nueva hereda de la última: entre series del mismo ejercicio los
    // valores casi nunca cambian, y si cambian se corrigen tecleando.
    const ultima = ejercicio.series.at(-1);
    onCambiar([
      ...ejercicio.series,
      {
        reps: ultima?.reps ?? normalizarReps(ejercicio.repsDefault ?? 10),
        kg: ultima?.kg ?? normalizarKg(ejercicio.kgDefault ?? 20),
        completadaEn: null,
      },
    ]);
  }

  function eliminar(indice: number) {
    alerta(
      `Eliminar la serie ${indice + 1}`,
      'Se quita de la lista de este ejercicio.',
      [
        { text: 'Volver', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => onCambiar(ejercicio.series.filter((_, i) => i !== indice)),
        },
      ],
    );
  }

  return (
    <View style={styles.tabla}>
      <View style={styles.cabecera}>
        <Text style={[styles.rotulo, styles.colSerie]}>Serie</Text>
        <Text style={[styles.rotulo, styles.colPrevia]}>Previa</Text>
        <Text style={[styles.rotulo, styles.colValor]}>Kg</Text>
        <Text style={[styles.rotulo, styles.colValor]}>Reps</Text>
        <View style={styles.colCheck} />
      </View>

      {ejercicio.series.map((serie, i) => (
        <Fila
          // El índice sirve de key porque eliminar reconstruye la lista entera
          // y no hay identidad estable por serie que preservar.
          key={i}
          numero={i + 1}
          previa={previa}
          serie={serie}
          onEditar={(cambio) => editar(i, cambio)}
          onAlternar={() => alternarHecha(i)}
          onEliminar={() => eliminar(i)}
        />
      ))}

      {ejercicio.series.length === 0 && (
        <Text style={styles.vacio}>
          Este ejercicio no tiene series todavía. Agrega la primera.
        </Text>
      )}

      <Pressable style={styles.agregar} onPress={agregar} accessibilityRole="button">
        <Text style={styles.agregarTexto}>+ Serie</Text>
      </Pressable>
    </View>
  );
}

function Fila({
  numero,
  previa,
  serie,
  onEditar,
  onAlternar,
  onEliminar,
}: {
  numero: number;
  previa: string;
  serie: SerieBorrador;
  onEditar: (cambio: Partial<SerieBorrador>) => void;
  onAlternar: () => void;
  onEliminar: () => void;
}) {
  // El texto en crudo mientras se teclea. Sin esto, normalizar en cada tecla
  // pelearía con el usuario: escribir «82,5» pasaría por «8» → 8, «82» → 82,
  // y borrar todo para reescribir sería imposible.
  const [kgTexto, setKgTexto] = useState<string | null>(null);
  const [repsTexto, setRepsTexto] = useState<string | null>(null);
  const hecha = serie.completadaEn !== null;

  // El estado se actualiza mientras se teclea, no solo al soltar el campo: con
  // `keyboardShouldPersistTaps="handled"`, tocar «+ Serie» o ✓ con el teclado
  // abierto no dispara `onBlur`, y la acción leería los valores viejos. El
  // texto crudo queda solo para mostrar; lo que no es un número (campo vacío)
  // no se confirma hasta soltar.
  function escribirKg(texto: string) {
    setKgTexto(texto);
    const valor = leerNumero(texto);
    if (Number.isFinite(valor)) onEditar({ kg: normalizarKg(valor) });
  }

  function escribirReps(texto: string) {
    setRepsTexto(texto);
    const valor = leerNumero(texto);
    if (Number.isFinite(valor)) onEditar({ reps: normalizarReps(valor) });
  }

  function confirmarKg() {
    if (kgTexto !== null) onEditar({ kg: normalizarKg(leerNumero(kgTexto)) });
    setKgTexto(null);
  }

  function confirmarReps() {
    if (repsTexto !== null) onEditar({ reps: normalizarReps(leerNumero(repsTexto)) });
    setRepsTexto(null);
  }

  return (
    // `accessible={false}` a propósito: un contenedor con rol de botón se
    // traga a los hijos y TalkBack nunca llegaría a los campos ni al check.
    // El long-press para eliminar queda en la celda del número, que sí es un
    // control enfocable con su propia pista.
    <Pressable
      style={[styles.fila, hecha && styles.filaHecha]}
      onLongPress={onEliminar}
      delayLongPress={500}
      accessible={false}
    >
      <Pressable
        onLongPress={onEliminar}
        delayLongPress={500}
        // El alto ya lo da la fila; el hitSlop horizontal se queda dentro del
        // padding del padre, que en Android es la única forma de que cuente.
        hitSlop={{ left: spacing.sm, right: spacing.sm }}
        accessibilityRole="button"
        accessibilityLabel={`Serie ${numero}`}
        accessibilityHint="Mantén apretado para eliminar esta serie"
      >
        <Text style={[styles.numero, styles.colSerie]}>{numero}</Text>
      </Pressable>
      <Text style={[styles.previa, styles.colPrevia]} numberOfLines={1}>
        {previa}
      </Text>

      <TextInput
        style={[styles.campo, styles.colValor, hecha && styles.campoHecho]}
        value={kgTexto ?? formatoKg(serie.kg)}
        onChangeText={escribirKg}
        onBlur={confirmarKg}
        onSubmitEditing={confirmarKg}
        keyboardType="decimal-pad"
        returnKeyType="done"
        selectTextOnFocus
        maxLength={5}
        accessibilityLabel={`Kilos de la serie ${numero}`}
      />
      <TextInput
        style={[styles.campo, styles.colValor, hecha && styles.campoHecho]}
        value={repsTexto ?? String(serie.reps)}
        onChangeText={escribirReps}
        onBlur={confirmarReps}
        onSubmitEditing={confirmarReps}
        keyboardType="number-pad"
        returnKeyType="done"
        selectTextOnFocus
        maxLength={2}
        accessibilityLabel={`Repeticiones de la serie ${numero}`}
      />

      <Pressable
        style={[styles.check, styles.colCheck]}
        onPress={onAlternar}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: hecha }}
        accessibilityLabel={`Serie ${numero} hecha`}
      >
        <View style={[styles.casilla, hecha && styles.casillaHecha]}>
          {hecha && <View style={styles.tilde} />}
        </View>
      </Pressable>
    </Pressable>
  );
}

// El alto de 48dp lo pone la fila; la celda del número solo centra su texto.


// Anchos por columna. Fijos en vez de flex para que los números no bailen de
// una fila a otra cuando cambia la cantidad de dígitos.
const styles = StyleSheet.create({
  tabla: { gap: spacing.xs },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.xs,
  },
  rotulo: {
    color: colors.sesionMuted,
    fontFamily: fonts.medium,
    fontSize: 11,
    textTransform: 'uppercase',
  },
  colSerie: { width: 34, textAlign: 'center' },
  colPrevia: { flex: 1, textAlign: 'center' },
  colValor: { width: 58, textAlign: 'center' },
  colCheck: { width: 48 },

  fila: {
    // 48dp de alto real en la fila y en el check: es el mínimo táctil de
    // Android, y los campos heredan el alto de la fila.
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 10,
    backgroundColor: colors.sesionSurface,
  },
  filaHecha: { backgroundColor: colors.sesionBg, borderWidth: 1, borderColor: colors.sesionBorde },
  numero: { color: colors.sesionInk, fontFamily: fonts.semibold, fontSize: fontSize.base },
  previa: {
    color: colors.sesionMuted,
    fontFamily: fonts.regular,
    fontSize: fontSize.sm,
    fontVariant: ['tabular-nums'],
  },
  campo: {
    minHeight: 44,
    color: colors.ink,
    fontFamily: fonts.semibold,
    fontSize: fontSize.lg,
    fontVariant: ['tabular-nums'],
    borderRadius: 8,
    backgroundColor: colors.sesionBg,
    paddingVertical: 0,
  },
  campoHecho: { backgroundColor: 'transparent' },
  // El blanco táctil son los 48dp completos de la celda; la casilla que se ve
  // es más chica y va centrada adentro. Marcar tres series no puede llenar la
  // fila de bloques de color.
  check: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  casilla: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 2,
    // 3,62:1 sobre los dos fondos de fila, que es lo que WCAG 1.4.11 pide
    // para el contorno de un control.
    borderColor: colors.sesionBorde,
    alignItems: 'center',
    justifyContent: 'center',
  },
  casillaHecha: { backgroundColor: colors.primary, borderColor: colors.primary },
  // El tilde va dibujado con dos bordes rotados, no con el glifo «✓»: como
  // texto queda a merced de las métricas de Rubik, que lo descentran vertical
  // y le cambian el grosor. Así es nítido y se centra solo. `ink` sobre
  // `primary` da 3,71:1, suficiente para un objeto gráfico (el 3:1 de WCAG),
  // que es lo que esto es ahora y antes no.
  tilde: {
    width: 11,
    height: 6,
    marginTop: -3,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: colors.ink,
    transform: [{ rotate: '-45deg' }],
  },
  vacio: {
    color: colors.sesionMuted,
    fontFamily: fonts.regular,
    fontSize: fontSize.sm,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  agregar: {
    minHeight: 48,
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: colors.sesionBorde,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agregarTexto: { color: colors.sesionInk, fontFamily: fonts.medium, fontSize: fontSize.base },
});
