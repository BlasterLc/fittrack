import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSesion } from '@/hooks/useSesion';
import { TiraEjercicios } from '@/components/TiraEjercicios';
import { TablaSeries } from '@/components/TablaSeries';
import { ResumenSesion } from '@/components/ResumenSesion';
import { useGuardarEntrenamiento } from '@/hooks/useEntrenamientos';
import { apiGet } from '@/lib/api';
import { tomarSeleccion } from '@/lib/seleccionEjercicios';
import {
  esDeHoy,
  finDelBorrador,
  totalSeriesHechas,
  valorInicial,
  type EjercicioBorrador,
  type SerieBorrador,
} from '@/lib/sesion';
import type { EjercicioFicha } from '@/hooks/useCatalogo';
import { colors, spacing, fonts, fontSize } from '@/theme/tokens';

type Paso = 'entrenando' | 'resumen';

function formatoReloj(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm}:${String(ss).padStart(2, '0')}`;
}

export default function Sesion() {
  const router = useRouter();
  const { borrador, cargando, actualizar, descartar } = useSesion();
  const guardar = useGuardarEntrenamiento();
  const [paso, setPaso] = useState<Paso>('entrenando');
  const [ahora, setAhora] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Sin borrador no hay nada que entrenar: no es una pantalla a la que se
  // pueda llegar de otra forma que no sea "Empezar" o retomando uno en curso.
  useEffect(() => {
    if (!cargando && !borrador) {
      router.replace('/(tabs)/gym');
    }
  }, [cargando, borrador, router]);

  // Trae los ejercicios elegidos en el catálogo y los agrega al final del
  // borrador. La selección vuelve por el buzón de lib/seleccionEjercicios,
  // no por parámetros de navegación: con Expo Router 57 volver con
  // router.push apilaría una instancia nueva de esta pantalla encima y el
  // borrador en memoria (y el estado de la serie activa) se perdería.
  useFocusEffect(
    useCallback(() => {
      const ids = tomarSeleccion();
      if (!ids || ids.length === 0 || !borrador) return;

      const nuevos = ids.filter((id) => !borrador.ejercicios.some((e) => e.catalogId === id));
      if (nuevos.length === 0) return;

      let cancelado = false;
      Promise.all(nuevos.map((id) => apiGet<EjercicioFicha>(`/api/catalog/${id}`)))
        .then((fichas) => {
          if (cancelado) return;
          const agregados: EjercicioBorrador[] = fichas.map((f) => ({
            catalogId: f.id,
            nombre: f.nombre_es,
            gifUrl: f.gif_url,
            equipamiento: f.equipment_es,
            agregado: true,
            repsDefault: null,
            kgDefault: null,
            // Nace con una fila pendiente, igual que los de la rutina: entrar
            // a un ejercicio y encontrarlo vacío obligaría a un toque extra
            // antes de poder registrar nada.
            series: [
              {
                reps: valorInicial(null, 'reps'),
                kg: valorInicial(null, 'kg'),
                completadaEn: null,
              },
            ],
          }));
          actualizar({ ...borrador, ejercicios: [...borrador.ejercicios, ...agregados] });
        })
        .catch(() => {
          if (!cancelado) Alert.alert('No pudimos agregar el ejercicio elegido');
        });

      return () => {
        cancelado = true;
      };
      // `borrador` va en las dependencias a propósito: con `[]` el cierre se
      // congela en el primer render, cuando el borrador todavía es `null`
      // porque useSesion lo carga después de montar, y el «+» nunca
      // agregaría nada.
    }, [borrador, actualizar]),
  );

  if (cargando || !borrador) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ActivityIndicator style={styles.centrado} color={colors.sesionInk} />
      </SafeAreaView>
    );
  }

  const indiceActual = borrador.indiceActual;
  const ejercicio = borrador.ejercicios[indiceActual];

  function alGuardar(agregarARutina: string[]) {
    guardar.mutate(
      { borrador: borrador!, agregarARutina },
      {
        onSuccess: (guardado) => {
          // El borrador se borra SOLO acá, después de que el POST salió bien:
          // si se borrara antes y el guardado fallara, el entrenamiento
          // entero se perdería sin forma de recuperarlo.
          descartar();
          router.replace('/(tabs)/gym');
          if (guardado.omitidos.length > 0) {
            Alert.alert(
              'Guardado con avisos',
              `${guardado.omitidos.length} ejercicio(s) ya no están en el catálogo y quedaron fuera.`,
            );
          }
        },
      },
    );
  }

  // Deshace el «Terminar»: limpia la marca de cierre y devuelve al ejercicio
  // donde ibas, que sigue en `indiceActual`. No se pierde nada, porque lo único
  // que «Terminar» cambia del borrador es `terminadoEn`.
  function seguirEntrenando() {
    actualizar({ ...borrador!, terminadoEn: null });
    setPaso('entrenando');
  }

  // `terminadoEn` puesto significa que el entrenamiento ya se cerró y solo
  // falta guardarlo. Se deriva del borrador en vez de sembrar `paso` con un
  // efecto: si no, retomar desde la barra de Gym un entrenamiento que quedó
  // sin guardar abriría la pantalla de entrenar en vez del resumen.
  if (paso === 'resumen' || borrador.terminadoEn !== null || !ejercicio) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ResumenSesion
          borrador={borrador}
          guardando={guardar.isPending}
          error={guardar.isError ? (guardar.error as Error).message : null}
          onGuardar={alGuardar}
          onDescartar={descartar}
          // Un borrador de otro día NO se puede seguir: sus marcas de tiempo ya
          // no tienen sentido y volver a entrenar guardaría un entrenamiento de
          // 72 horas. Es la misma regla que aplica la barra de Gym, que a uno
          // varado solo le ofrece guardar lo hecho o descartarlo. Sin ejercicio
          // tampoco hay a dónde volver: la rutina quedó vacía.
          onSeguir={esDeHoy(borrador.iniciadoEn) && ejercicio ? seguirEntrenando : undefined}
        />
      </SafeAreaView>
    );
  }

  const total = borrador.ejercicios.length;
  const minutos = Math.floor((ahora - new Date(borrador.iniciadoEn).getTime()) / 60_000);
  const descansoSeg = Math.floor((ahora - new Date(finDelBorrador(borrador)).getTime()) / 1000);
  const siguiente = borrador.ejercicios[indiceActual + 1] ?? null;

  function guardarSeries(series: SerieBorrador[]) {
    const ejercicios = borrador!.ejercicios.map((e, i) =>
      i === indiceActual ? { ...e, series } : e,
    );
    actualizar({ ...borrador!, ejercicios });
  }

  function alTerminar() {
    const hayAlgo = totalSeriesHechas(borrador!) > 0;
    if (!hayAlgo) {
      Alert.alert(
        'Sin series registradas',
        '¿Terminar el entrenamiento sin haber registrado ninguna serie?',
        [
          { text: 'Volver', style: 'cancel' },
          { text: 'Salir sin guardar', style: 'destructive', onPress: () => descartar() },
        ],
      );
      return;
    }
    // El borrador queda marcado como terminado antes de mostrar el resumen:
    // es lo que le permite a la barra de Gym (Tarea 14) distinguir «en
    // curso» de «sin guardar» sin depender de este estado en memoria.
    actualizar({ ...borrador!, terminadoEn: new Date().toISOString() });
    setPaso('resumen');
  }

  // «Listo» solo cuando están hechas TODAS las series planificadas, no
  // después de cada una: decir que el ejercicio terminó cuando vas 1 de 3 es
  // falso y empuja a saltarlo.
  const todasHechas =
    ejercicio.series.length > 0 && ejercicio.series.every((s) => s.completadaEn !== null);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.encabezado}>
        <Text style={styles.encabezadoTexto} numberOfLines={1}>
          {borrador.nombreRutina} · Ejercicio {indiceActual + 1} de {total} · {minutos} min
        </Text>
      </View>

      <TiraEjercicios
        ejercicios={borrador.ejercicios}
        indiceActual={indiceActual}
        onSeleccionar={(i) => actualizar({ ...borrador, indiceActual: i })}
        onAgregar={() => router.push('/agregar-ejercicios')}
      />

      <ScrollView
        contentContainerStyle={styles.cuerpo}
        // Sin esto, con el teclado abierto el primer toque en el ✓ solo lo
        // cierra y hay que tocar de nuevo para marcar la serie.
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.cabeceraEjercicio}>
          {/* Sin autoplay={false}: acá el GIF sí se anima, al revés que en las
              miniaturas de la tira. */}
          <Image
            source={{ uri: ejercicio.gifUrl }}
            style={styles.gif}
            contentFit="contain"
            cachePolicy="memory-disk"
            recyclingKey={ejercicio.catalogId}
          />
          <Text style={styles.nombreEjercicio}>{ejercicio.nombre}</Text>
        </View>

        <TablaSeries
          // Remontar al cambiar de ejercicio descarta el texto a medio teclear
          // de los campos, que es local a cada fila.
          key={ejercicio.catalogId}
          ejercicio={ejercicio}
          onCambiar={guardarSeries}
        />

        <View style={styles.pieEjercicio}>
          {todasHechas && <Text style={styles.listoTexto}>{ejercicio.nombre} listo</Text>}
          {siguiente && (
            <Pressable
              style={styles.siguiente}
              onPress={() => actualizar({ ...borrador, indiceActual: indiceActual + 1 })}
              accessibilityRole="button"
            >
              <Text style={styles.siguienteTexto} numberOfLines={1}>
                Siguiente: {siguiente.nombre} ›
              </Text>
            </Pressable>
          )}
        </View>
      </ScrollView>

      <View style={styles.barraInferior}>
        <Text style={styles.descanso}>{formatoReloj(descansoSeg)}</Text>
        <Pressable style={styles.terminar} onPress={alTerminar} accessibilityRole="button">
          <Text style={styles.terminarTexto}>Terminar</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sesionBg },
  centrado: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  encabezado: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  encabezadoTexto: {
    color: colors.sesionInk,
    fontFamily: fonts.medium,
    fontSize: fontSize.sm,
  },
  cuerpo: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  cabeceraEjercicio: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  gif: {
    width: 140,
    height: 140,
    borderRadius: 12,
    backgroundColor: colors.sesionSurface,
  },
  nombreEjercicio: {
    color: colors.ink,
    fontFamily: fonts.bold,
    fontSize: fontSize.lg,
    textAlign: 'center',
  },
  pieEjercicio: { gap: spacing.sm, marginTop: spacing.sm },
  listoTexto: {
    color: colors.sesionMuted,
    fontFamily: fonts.regular,
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
  siguiente: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  siguienteTexto: { color: colors.sesionInk, fontFamily: fonts.semibold, fontSize: fontSize.sm },
  barraInferior: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.sesionLine,
    backgroundColor: colors.sesionSurface,
  },
  descanso: {
    color: colors.sesionInk,
    fontFamily: fonts.semibold,
    fontSize: fontSize.lg,
    fontVariant: ['tabular-nums'],
  },
  terminar: {
    minHeight: 48,
    minWidth: 48,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.sesionBorde,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  terminarTexto: { color: colors.sesionInk, fontFamily: fonts.semibold, fontSize: fontSize.base },
});
