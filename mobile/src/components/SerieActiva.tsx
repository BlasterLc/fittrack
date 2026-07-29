import { useState } from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { colors, fonts, fontSize, spacing } from '@/theme/tokens';
import { RuedaValor } from './RuedaValor';
import { KILOS, REPS } from '@/lib/sesion';

/**
 * Tarjeta de la serie que se está registrando: dos ruedas (reps y kilos) y
 * los controles para confirmarla o descartarla. No guarda nada por sí sola:
 * solo reporta valores hacia arriba, quien escribe el borrador es la
 * pantalla (Tarea 12).
 *
 * `repsInicial`/`kgInicial` solo siembran el estado al montar, igual que
 * `contentOffset` en `RuedaValor` (ver ese archivo). Si la pantalla cambia de
 * ejercicio o reabre una serie distinta para editar sin desmontar esta
 * tarjeta, las ruedas no se van a mover solas: hay que remontarla con un
 * `key` (por ejemplo el `catalogId` del ejercicio, o algo que identifique la
 * serie en edición). Entre series nuevas del mismo ejercicio no hace falta,
 * porque el valor inicial es siempre el mismo que el de la serie anterior.
 */
export function SerieActiva({
  repsInicial,
  kgInicial,
  onConfirmar,
  onEliminar,
}: {
  repsInicial: number;
  kgInicial: number;
  onConfirmar: (reps: number, kg: number) => void;
  onEliminar: () => void;
}) {
  const [reps, setReps] = useState(repsInicial);
  const [kg, setKg] = useState(kgInicial);

  return (
    <View style={styles.tarjeta}>
      <View style={styles.encabezado}>
        <Pressable style={styles.eliminar} onPress={onEliminar} accessibilityRole="button">
          <Text style={styles.eliminarTexto}>Eliminar</Text>
        </Pressable>
      </View>
      <View style={styles.ruedas}>
        <RuedaValor etiqueta="Reps" sufijo="reps" valores={REPS} valor={reps} onCambio={setReps} />
        <RuedaValor etiqueta="Kg" sufijo="kg" valores={KILOS} valor={kg} onCambio={setKg} />
      </View>
      <Pressable style={styles.confirmar} onPress={() => onConfirmar(reps, kg)} accessibilityRole="button">
        <Text style={styles.confirmarTexto}>✓ Serie hecha</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  tarjeta: {
    backgroundColor: colors.sesionSurface,
    borderRadius: 14,
    padding: spacing.lg,
    gap: spacing.md,
  },
  encabezado: { flexDirection: 'row', justifyContent: 'flex-end' },
  // Los 48dp van en el Pressable mismo, no en un contenedor con
  // alignItems: 'center': eso no estira al hijo y el blanco táctil real
  // sigue siendo chico (bug ya visto en el perfil).
  eliminar: {
    minHeight: 48,
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  // `colors.danger` da 3,98:1 sobre `sesionSurface` y falla el 4,5:1 de texto
  // normal (sí llega sobre `bg`/`surface`, que son más oscuros). `sesionDanger`
  // es la misma idea que `sesionMuted`: mismo rol, ajustado para los fondos de
  // la sesión.
  eliminarTexto: { color: colors.sesionDanger, fontFamily: fonts.medium, fontSize: fontSize.base },
  ruedas: { flexDirection: 'row', gap: spacing.md },
  confirmar: {
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmarTexto: { color: colors.ink, fontFamily: fonts.semibold, fontSize: fontSize.lg },
});
