import { useState } from 'react';
import { View, Text, Pressable, ScrollView, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { Segmentado } from './Segmentado';
import {
  finDelBorrador,
  formatoKg,
  seriesHechas,
  type BorradorSesion,
  type SerieBorrador,
} from '@/lib/sesion';
import { colors, spacing, fonts, fontSize } from '@/theme/tokens';

// «3 × 8 · 80 kg» cuando todas las series de un ejercicio salieron iguales;
// serie por serie cuando no, para no mostrar un patrón que no hubo.
function desgloseSeries(series: SerieBorrador[]): string {
  const [primera, ...resto] = series;
  const iguales = resto.every((s) => s.reps === primera.reps && s.kg === primera.kg);
  if (iguales) {
    return `${series.length} × ${primera.reps} · ${formatoKg(primera.kg)} kg`;
  }
  return series.map((s) => `${s.reps} × ${formatoKg(s.kg)} kg`).join('\n');
}

/**
 * El cierre de la sesión: cifras del entrenamiento, desglose por ejercicio y
 * la oferta de sumar a la rutina lo que se agregó sobre la marcha. No guarda
 * nada por sí solo, reporta hacia arriba con `onGuardar` (los `catalogId`
 * elegidos para sumar) y `onDescartar`.
 *
 * `onSeguir` es la vuelta atrás, y es opcional porque no siempre existe: la
 * pantalla decide si esta sesión todavía se puede retomar. Con ella, «Terminar»
 * deja de ser un camino de ida y no necesita un diálogo que confirme: tocarlo
 * sin querer se deshace con un toque, y terminar de verdad no paga nada.
 *
 * Sin kilos totales: sumar kilos entre ejercicios distintos (una sentadilla y
 * un curl de bíceps) no significa nada físico. Es una decisión ya cerrada del
 * proyecto, no un olvido.
 */
export function ResumenSesion({
  borrador,
  guardando,
  error,
  onGuardar,
  onDescartar,
  onSeguir,
}: {
  borrador: BorradorSesion;
  guardando: boolean;
  error: string | null;
  onGuardar: (agregarARutina: string[]) => void;
  onDescartar: () => void;
  onSeguir?: () => void;
}) {
  // 'no' por defecto: sumar un ejercicio a la rutina cambia algo que el
  // usuario va a ver la próxima vez que la abra, así que necesita una
  // elección propia, no heredarla solo por haberlo hecho hoy.
  const [eleccion, setEleccion] = useState<Record<string, 'si' | 'no'>>({});

  // Solo lo efectivamente hecho: las series que quedaron planificadas y sin
  // marcar no son parte del entrenamiento y no pueden aparecer en el cierre.
  const hechos = borrador.ejercicios
    .map((e) => ({ ...e, series: seriesHechas(e) }))
    .filter((e) => e.series.length > 0);
  const totalSeries = hechos.reduce((n, e) => n + e.series.length, 0);
  const fin = borrador.terminadoEn ?? finDelBorrador(borrador);
  const minutos = Math.floor(
    (new Date(fin).getTime() - new Date(borrador.iniciadoEn).getTime()) / 60_000,
  );
  const agregados = hechos.filter((e) => e.agregado);

  function confirmarDescartar() {
    Alert.alert(
      'Descartar entrenamiento',
      'Se va a perder todo lo que registraste. ¿Descartar igual?',
      [
        { text: 'Volver', style: 'cancel' },
        { text: 'Descartar', style: 'destructive', onPress: onDescartar },
      ],
    );
  }

  function alGuardar() {
    const aSumar = agregados.filter((e) => eleccion[e.catalogId] === 'si').map((e) => e.catalogId);
    onGuardar(aSumar);
  }

  return (
    <>
      {/* Fuera del ScrollView: la salida no puede depender de dónde quedó el
          scroll de un resumen largo. */}
      {onSeguir && (
        <Pressable style={styles.volver} onPress={onSeguir} accessibilityRole="button">
          <Text style={styles.volverTexto}>‹ Seguir entrenando</Text>
        </Pressable>
      )}

      <ScrollView contentContainerStyle={styles.cuerpo}>
        <Text style={styles.titulo}>{borrador.nombreRutina}</Text>

        <View style={styles.cifras}>
          <Cifra valor={minutos} etiqueta="min" />
          <Cifra valor={totalSeries} etiqueta={totalSeries === 1 ? 'serie' : 'series'} />
          <Cifra valor={hechos.length} etiqueta={hechos.length === 1 ? 'ejercicio' : 'ejercicios'} />
        </View>

        <View style={styles.lista}>
          {hechos.map((e) => (
            <View key={e.catalogId} style={styles.filaEjercicio}>
              <Text style={styles.nombreEjercicio}>{e.nombre}</Text>
              <Text style={styles.detalle}>{desgloseSeries(e.series)}</Text>
            </View>
          ))}
        </View>

        {agregados.map((e) => (
          <View key={e.catalogId} style={styles.aviso}>
            <Text style={styles.avisoTexto}>
              {e.nombre} no es parte de {borrador.nombreRutina}.
            </Text>
            <Segmentado
              opciones={[
                { valor: 'si', label: `Sumarlo a ${borrador.nombreRutina}` },
                { valor: 'no', label: 'No, fue por hoy' },
              ]}
              valor={eleccion[e.catalogId] ?? 'no'}
              onCambio={(v) => setEleccion((prev) => ({ ...prev, [e.catalogId]: v }))}
            />
          </View>
        ))}
      </ScrollView>

      <View style={styles.pie}>
        <Pressable style={styles.descartar} onPress={confirmarDescartar} accessibilityRole="button">
          <Text style={styles.descartarTexto}>Descartar</Text>
        </Pressable>
        <Pressable
          style={[styles.guardar, guardando && styles.guardarInactivo]}
          onPress={alGuardar}
          disabled={guardando}
          accessibilityRole="button"
        >
          {guardando ? (
            <ActivityIndicator color={colors.ink} />
          ) : (
            <Text style={styles.guardarTexto}>{error ? 'Reintentar' : 'Guardar'}</Text>
          )}
        </Pressable>
        {error && <Text style={styles.error}>{error}</Text>}
      </View>
    </>
  );
}

function Cifra({ valor, etiqueta }: { valor: number; etiqueta: string }) {
  return (
    <View style={styles.cifra}>
      <Text style={styles.cifraValor}>{valor}</Text>
      <Text style={styles.cifraEtiqueta}>{etiqueta}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // `alignSelf` para que el táctil no se coma todo el ancho de la pantalla, y
  // los 48dp en el Pressable mismo, con alto real. El padding lateral es el de
  // `cuerpo`, así el texto queda a plomo con el nombre de la rutina.
  volver: {
    minHeight: 48,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  volverTexto: { color: colors.sesionInk, fontFamily: fonts.medium, fontSize: fontSize.base },
  cuerpo: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  titulo: { color: colors.sesionInk, fontFamily: fonts.bold, fontSize: fontSize.xl },
  cifras: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.sesionSurface,
    borderRadius: 12,
    padding: spacing.lg,
  },
  cifra: { alignItems: 'center', gap: spacing.xs },
  cifraValor: {
    color: colors.sesionInk,
    fontFamily: fonts.bold,
    fontSize: fontSize.xxl,
    fontVariant: ['tabular-nums'],
  },
  cifraEtiqueta: { color: colors.sesionMuted, fontFamily: fonts.medium, fontSize: fontSize.sm },
  lista: { gap: spacing.sm },
  filaEjercicio: {
    backgroundColor: colors.sesionSurface,
    borderRadius: 10,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  nombreEjercicio: { color: colors.sesionInk, fontFamily: fonts.semibold, fontSize: fontSize.base },
  detalle: {
    color: colors.sesionMuted,
    fontFamily: fonts.regular,
    fontSize: fontSize.sm,
    fontVariant: ['tabular-nums'],
    lineHeight: 18,
  },
  // Borde en `colors.accent`: dan 7,94:1 (sobre sesionSurface) y 6,76:1 (sobre
  // sesionBg), ambos por encima del 4,5:1 de texto normal, así que el mismo
  // ámbar del resto de la app sirve acá sin un token aparte. Semántico, no
  // decorativo: informa que este ejercicio no viene de la rutina.
  aviso: {
    backgroundColor: colors.sesionSurface,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 10,
    padding: spacing.lg,
    gap: spacing.md,
  },
  avisoTexto: { color: colors.sesionInk, fontFamily: fonts.regular, fontSize: fontSize.sm, lineHeight: 19 },
  pie: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.sesionLine,
    backgroundColor: colors.sesionSurface,
  },
  // 48dp en el Pressable mismo: un minHeight en un contenedor con
  // alignItems: 'center' no estira al hijo (bug ya visto en el perfil y en
  // SerieActiva).
  descartar: {
    minHeight: 48,
    minWidth: 48,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  descartarTexto: { color: colors.sesionDanger, fontFamily: fonts.medium, fontSize: fontSize.base },
  guardar: {
    flex: 1,
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guardarInactivo: { opacity: 0.6 },
  guardarTexto: { color: colors.ink, fontFamily: fonts.semibold, fontSize: fontSize.base },
  // Mismo ámbar que el resto de la app usa para errores de guardado (login,
  // Hoy, el asistente del perfil): el rojo queda para lo que pierde datos.
  error: {
    width: '100%',
    color: colors.accent,
    fontFamily: fonts.regular,
    fontSize: fontSize.sm,
  },
});
