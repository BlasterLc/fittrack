import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { alerta } from '@/lib/alerta';
import { GraficoPeso } from '@/components/GraficoPeso';
import { HojaRegistrarPeso } from '@/components/HojaRegistrarPeso';
import { useHistorialPeso, useBorrarPeso, type RegistroPeso } from '@/hooks/useProgreso';
import { formatoKg } from '@/lib/sesion';
import { colors, spacing, fonts, fontSize } from '@/theme/tokens';

export function HistorialPeso() {
  const [hojaAbierta, setHojaAbierta] = useState(false);
  const historial = useHistorialPeso();
  const borrar = useBorrarPeso();

  // Del más reciente al más viejo, tal como llega de la API: es el orden
  // natural para la lista, que muestra el último registro arriba.
  const registrosDescendente = historial.data?.pages.flat() ?? [];
  // El gráfico se lee de izquierda (viejo) a derecha (reciente). Se parte de
  // `historial.data` acá dentro para que esa sea la única dependencia real:
  // `registrosDescendente` es un array nuevo por render y como dep haría que
  // el useMemo recalculara siempre.
  const registrosAscendente = useMemo(
    () => (historial.data?.pages.flat() ?? []).reverse(),
    [historial.data],
  );

  function confirmarBorrar(registro: RegistroPeso) {
    alerta('Eliminar registro', '¿Seguro que quieres eliminar este registro de peso?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () =>
          borrar.mutate(registro.id, {
            onError: (e) => alerta('No se pudo eliminar', (e as Error).message),
          }),
      },
    ]);
  }

  return (
    <View>
      <GraficoPeso
        registros={registrosAscendente}
        cargando={historial.isPending}
        error={historial.isError}
        hasNextPage={historial.hasNextPage}
        isFetchingNextPage={historial.isFetchingNextPage}
        fetchNextPage={historial.fetchNextPage}
        onReintentar={() => historial.refetch()}
      />

      <View style={styles.encabezado}>
        <Text style={styles.subtitulo}>Historial</Text>
        <Pressable
          style={styles.registrar}
          onPress={() => setHojaAbierta(true)}
          accessibilityRole="button"
        >
          <Text style={styles.registrarTexto}>Registrar peso</Text>
        </Pressable>
      </View>

      {registrosDescendente.map((r) => (
        <View key={r.id} style={styles.fila}>
          <Text style={styles.filaFecha}>
            {new Date(r.recorded_at).toLocaleString('es-CL', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
          <View style={styles.filaAcciones}>
            <Text style={styles.filaKg}>{formatoKg(r.kg)} kg</Text>
            <Pressable style={styles.eliminarBoton} onPress={() => confirmarBorrar(r)}>
              <Text style={styles.eliminar}>Eliminar</Text>
            </Pressable>
          </View>
        </View>
      ))}

      {historial.hasNextPage && (
        <Pressable
          style={styles.masAntiguos}
          onPress={() => historial.fetchNextPage()}
          disabled={historial.isFetchingNextPage}
        >
          <Text style={styles.masAntiguosTexto}>
            {historial.isFetchingNextPage ? 'Cargando…' : 'Ver más antiguos'}
          </Text>
        </Pressable>
      )}

      <HojaRegistrarPeso visible={hojaAbierta} onCerrar={() => setHojaAbierta(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  encabezado: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  subtitulo: { color: colors.muted, fontFamily: fonts.regular, fontSize: fontSize.sm },
  registrar: { minHeight: 48, justifyContent: 'center' },
  registrarTexto: { color: colors.primaryText, fontFamily: fonts.medium, fontSize: fontSize.base },
  fila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  filaFecha: {
    color: colors.ink,
    fontFamily: fonts.regular,
    fontSize: fontSize.base,
    textTransform: 'capitalize',
  },
  filaAcciones: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  filaKg: {
    color: colors.muted,
    fontFamily: fonts.medium,
    fontSize: fontSize.base,
    fontVariant: ['tabular-nums'],
  },
  eliminarBoton: { minHeight: 48, paddingHorizontal: spacing.xs, justifyContent: 'center' },
  eliminar: { color: colors.danger, fontFamily: fonts.medium, fontSize: fontSize.base },
  masAntiguos: {
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    marginHorizontal: spacing.xl,
    marginTop: spacing.sm,
  },
  masAntiguosTexto: { color: colors.muted, fontFamily: fonts.medium, fontSize: fontSize.base },
});
