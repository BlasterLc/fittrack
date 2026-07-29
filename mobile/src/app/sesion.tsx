import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSesion } from '@/hooks/useSesion';
import { TiraEjercicios } from '@/components/TiraEjercicios';
import { SerieActiva } from '@/components/SerieActiva';
import { ResumenSesion } from '@/components/ResumenSesion';
import { useGuardarEntrenamiento } from '@/hooks/useEntrenamientos';
import { apiGet } from '@/lib/api';
import { tomarSeleccion } from '@/lib/seleccionEjercicios';
import { finDelBorrador, valorInicial, type EjercicioBorrador, type SerieBorrador } from '@/lib/sesion';
import type { EjercicioFicha } from '@/hooks/useCatalogo';
import { colors, spacing, fonts, fontSize } from '@/theme/tokens';

type Paso = 'entrenando' | 'resumen';

// Qué muestra la tarjeta de la serie activa para el ejercicio actual:
// 'nueva' arma una serie con los valores de arranque (o los de la última, si
// ya hay alguna), un número reabre esa serie ya hecha para editarla, y null
// deja ver solo la lista de hechas más "+ Agregar serie".
type EstadoEdicion = 'nueva' | number | null;

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
  const [estadoEdicion, setEstadoEdicion] = useState<EstadoEdicion>(null);
  const [ahora, setAhora] = useState(() => Date.now());
  // Identifica qué ejercicio tenía montada la tarjeta la última vez que se
  // decidió `estadoEdicion`. Declarado acá arriba, junto a los demás hooks,
  // para que se llame siempre en el mismo orden sin importar si el borrador
  // ya cargó o no.
  const idAnteriorRef = useRef<string | null>(null);

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
            series: [],
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
  const ejercicicioId = ejercicio?.catalogId ?? null;

  // Al entrar a un ejercicio distinto del que tenía la tarjeta montada
  // (incluida la primera vez que el borrador termina de cargar), decide
  // desde cero qué mostrar: la rueda si no tiene ninguna serie, o el resumen
  // si ya tiene. Ajustar el estado durante el render (en vez de en un
  // useEffect) evita el parpadeo de un frame con el ejercicio equivocado:
  // React reintenta el render con el valor nuevo antes de pintar.
  if (ejercicicioId !== idAnteriorRef.current) {
    idAnteriorRef.current = ejercicicioId;
    setEstadoEdicion(ejercicio && ejercicio.series.length === 0 ? 'nueva' : null);
  }

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

  function confirmarSerie(reps: number, kg: number) {
    const series = [...ejercicio.series];
    if (typeof estadoEdicion === 'number') {
      // Corrige una serie ya hecha: conserva el momento en que se hizo, no
      // el de la edición. Tocarlo acá rompería el cronómetro de descanso
      // (cuenta desde la última `completadaEn`) y el fin del entrenamiento
      // que se manda a guardar.
      series[estadoEdicion] = { ...series[estadoEdicion], reps, kg };
    } else {
      series.push({ reps, kg, completadaEn: new Date().toISOString() });
    }
    guardarSeries(series);
    setEstadoEdicion(null);
  }

  function eliminarSerie() {
    const series =
      typeof estadoEdicion === 'number'
        ? ejercicio.series.filter((_, i) => i !== estadoEdicion)
        : ejercicio.series;
    if (typeof estadoEdicion === 'number') {
      guardarSeries(series);
    }
    setEstadoEdicion(series.length === 0 ? 'nueva' : null);
  }

  function alTerminar() {
    const hayAlgo = borrador!.ejercicios.some((e) => e.series.length > 0);
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

  const repsInicial =
    typeof estadoEdicion === 'number'
      ? ejercicio.series[estadoEdicion].reps
      : ejercicio.series.length > 0
        ? ejercicio.series.at(-1)!.reps
        : valorInicial(ejercicio.repsDefault, 'reps', ejercicio.equipamiento);
  const kgInicial =
    typeof estadoEdicion === 'number'
      ? ejercicio.series[estadoEdicion].kg
      : ejercicio.series.length > 0
        ? ejercicio.series.at(-1)!.kg
        : valorInicial(ejercicio.kgDefault, 'kg', ejercicio.equipamiento);

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
        onAgregar={() => router.push('/gym/rutina/agregar')}
      />

      <ScrollView contentContainerStyle={styles.cuerpo}>
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

        {ejercicio.series.map(
          (serie, i) =>
            i !== estadoEdicion && (
              <Pressable
                key={i}
                style={styles.filaSerie}
                onPress={() => setEstadoEdicion(i)}
                accessibilityRole="button"
                accessibilityLabel={`Serie ${i + 1}: ${serie.reps} repeticiones, ${serie.kg} kilos`}
              >
                <Text style={styles.filaSerieTexto}>
                  {serie.reps} × {serie.kg} kg
                </Text>
                <Text style={styles.filaSerieEditar}>Editar</Text>
              </Pressable>
            ),
        )}

        {estadoEdicion === null && (
          <View style={styles.listoFila}>
            <Text style={styles.listoTexto}>{ejercicio.nombre} listo</Text>
            {siguiente && (
              <Pressable
                onPress={() => actualizar({ ...borrador, indiceActual: indiceActual + 1 })}
                hitSlop={12}
                accessibilityRole="button"
              >
                <Text style={styles.siguienteTexto}>Siguiente: {siguiente.nombre} ›</Text>
              </Pressable>
            )}
          </View>
        )}

        {estadoEdicion === null && (
          <Pressable
            style={styles.agregarSerie}
            onPress={() => setEstadoEdicion('nueva')}
            accessibilityRole="button"
          >
            <Text style={styles.agregarSerieTexto}>+ Agregar serie</Text>
          </Pressable>
        )}

        {estadoEdicion !== null && (
          <SerieActiva
            key={`${ejercicio.catalogId}:${estadoEdicion}`}
            repsInicial={repsInicial}
            kgInicial={kgInicial}
            onConfirmar={confirmarSerie}
            onEliminar={eliminarSerie}
          />
        )}
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
  filaSerie: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.sesionSurface,
    borderRadius: 10,
  },
  filaSerieTexto: {
    color: colors.ink,
    fontFamily: fonts.semibold,
    fontSize: fontSize.base,
    fontVariant: ['tabular-nums'],
  },
  filaSerieEditar: { color: colors.sesionMuted, fontFamily: fonts.medium, fontSize: fontSize.sm },
  listoFila: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
  },
  listoTexto: { color: colors.sesionMuted, fontFamily: fonts.regular, fontSize: fontSize.sm },
  siguienteTexto: { color: colors.sesionInk, fontFamily: fonts.semibold, fontSize: fontSize.sm },
  agregarSerie: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.sesionBorde,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agregarSerieTexto: { color: colors.sesionInk, fontFamily: fonts.medium, fontSize: fontSize.base },
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
