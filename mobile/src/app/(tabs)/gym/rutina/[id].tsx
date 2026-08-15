import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { useAnimatedRef } from 'react-native-reanimated';
import Sortable from 'react-native-sortables';
import { alerta } from '@/lib/alerta';
import {
  useCrearRutina,
  useGuardarRutina,
  useRutina,
} from '@/hooks/useRutinas';
import type { EjercicioResumen } from '@/hooks/useCatalogo';
import { apiGet } from '@/lib/api';
import { tomarSeleccion } from '@/lib/seleccionEjercicios';
import { colors, spacing, fonts, fontSize } from '@/theme/tokens';

export default function EditorRutina() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const esNueva = id === 'nueva';
  const rutinaId = esNueva ? null : Number(id);

  const detalle = useRutina(rutinaId);
  const crear = useCrearRutina();
  const guardar = useGuardarRutina(rutinaId ?? 0);

  const [nombre, setNombre] = useState('');
  const [lista, setLista] = useState<EjercicioResumen[]>([]);
  const [sucio, setSucio] = useState(false);
  // El editor vive dentro de un scroll: sin esta referencia, arrastrar un
  // ejercicio cerca del borde no puede desplazar la lista automáticamente.
  const refScroll = useAnimatedRef<Animated.ScrollView>();

  // Carga inicial desde el servidor, una sola vez de verdad. Sin la bandera,
  // el efecto vuelve a correr con cada refetch de TanStack Query (cualquier
  // mutación invalida ['rutinas']) y pisa con el valor del servidor el nombre
  // que se está escribiendo.
  const yaHidratado = useRef(false);
  useEffect(() => {
    if (detalle.data && !yaHidratado.current) {
      yaHidratado.current = true;
      setNombre(detalle.data.nombre);
      setLista(detalle.data.ejercicios);
    }
  }, [detalle.data]);

  // Vuelta desde la pantalla de selección: la lista elegida llega por el buzón
  // (ver lib/seleccionEjercicios), no por parámetros de navegación, y se piden
  // las fichas completas para poder dibujarlas.
  useFocusEffect(
    useCallback(() => {
      const ids = tomarSeleccion();
      if (!ids) return;

      let cancelado = false;

      Promise.all(ids.map((i) => apiGet<EjercicioResumen>(`/api/catalog/${i}`)))
        .then((fichas) => {
          if (!cancelado) {
            setLista(fichas);
            setSucio(true);
          }
        })
        .catch(() => {
          if (!cancelado) alerta('No pudimos cargar los ejercicios elegidos');
        });

      return () => {
        cancelado = true;
      };
    }, []),
  );

  const nombreValido = nombre.trim().length > 0;
  const puedeGuardar = nombreValido && lista.length > 0;
  const guardando = crear.isPending || guardar.isPending;

  function quitar(id: string) {
    setLista((previos) => previos.filter((e) => e.id !== id));
    setSucio(true);
  }

  function alGuardar() {
    const body = { nombre: nombre.trim(), catalog_ids: lista.map((e) => e.id) };
    const mutacion = esNueva ? crear : guardar;
    mutacion.mutate(body, {
      onSuccess: () => router.back(),
      onError: (error: Error) => alerta('No pudimos guardar', error.message),
    });
  }

  function alSalir() {
    if (!sucio) {
      router.back();
      return;
    }
    alerta('Salir sin guardar', 'Se perderán los cambios de esta rutina.', [
      { text: 'Seguir editando', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: () => router.back() },
    ]);
  }

  if (!esNueva && detalle.isPending) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ActivityIndicator style={styles.centrado} color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.barra}>
        <Pressable onPress={alSalir} hitSlop={12}>
          <Text style={styles.volver}>‹ Rutinas</Text>
        </Pressable>
        <Text style={styles.titulo}>{esNueva ? 'Nueva rutina' : 'Editar rutina'}</Text>
      </View>

      <Animated.ScrollView ref={refScroll} contentContainerStyle={styles.cuerpo}>
        <Text style={styles.etiqueta}>Nombre</Text>
        <TextInput
          style={styles.input}
          value={nombre}
          onChangeText={(t) => {
            setNombre(t);
            setSucio(true);
          }}
          placeholder="Empuje A"
          placeholderTextColor={colors.muted}
        />

        <Text style={styles.etiqueta}>
          Ejercicios · {lista.length}
        </Text>

        {detalle.data && detalle.data.ejercicios_faltantes > 0 && (
          <Text style={styles.aviso}>
            {detalle.data.ejercicios_faltantes}{' '}
            {detalle.data.ejercicios_faltantes === 1
              ? 'ejercicio ya no está'
              : 'ejercicios ya no están'}{' '}
            en el catálogo. Al guardar se quitan de la rutina.
          </Text>
        )}

        <Sortable.Grid
          columns={1}
          data={lista}
          keyExtractor={(e) => e.id}
          rowGap={0}
          // Sin esto, `Sortable.Handle` lanza en tiempo de ejecución: la
          // biblioteca solo arma el contexto del asa si la grilla lo declara.
          // Con el asa, el resto de la fila queda libre para tocarse.
          customHandle
          // La grilla vive dentro del scroll de arriba: sin `scrollableRef`
          // no puede desplazar la lista mientras se arrastra cerca del borde.
          scrollableRef={refScroll}
          onDragEnd={({ data }) => {
            setLista(data);
            setSucio(true);
          }}
          renderItem={({ item }) => (
            <View style={styles.fila}>
              <Sortable.Handle style={styles.asa}>
                <Text style={styles.asaTexto}>⠿</Text>
              </Sortable.Handle>
              <Image
                source={{ uri: item.gif_url }}
                style={styles.gif}
                contentFit="contain"
                cachePolicy="memory-disk"
              />
              <View style={styles.filaTexto}>
                <Text style={styles.filaNombre}>{item.nombre_es}</Text>
                <Text style={styles.filaMeta}>{item.body_part_es}</Text>
              </View>
              <Pressable
                onPress={() => quitar(item.id)}
                hitSlop={12}
                style={styles.cuadro}
              >
                <Text style={styles.quitar}>×</Text>
              </Pressable>
            </View>
          )}
        />

        <Pressable
          style={styles.agregar}
          onPress={() =>
            router.push({
              pathname: '/agregar-ejercicios',
              params: { ya: lista.map((e) => e.id).join(',') },
            })
          }
        >
          <Text style={styles.agregarTexto}>+ Agregar ejercicio</Text>
        </Pressable>

        <Pressable
          style={[styles.guardar, !puedeGuardar && styles.guardarInactivo]}
          disabled={!puedeGuardar || guardando}
          onPress={alGuardar}
        >
          <Text style={styles.guardarTexto}>{guardando ? 'Guardando…' : 'Guardar'}</Text>
        </Pressable>

        {!puedeGuardar && (
          <Text style={styles.ayuda}>
            Una rutina necesita un nombre y al menos un ejercicio.
          </Text>
        )}
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  centrado: { flex: 1 },
  barra: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  volver: { color: colors.muted, fontFamily: fonts.medium, fontSize: fontSize.base },
  titulo: { color: colors.ink, fontFamily: fonts.semibold, fontSize: fontSize.base },
  cuerpo: { padding: spacing.xl, paddingBottom: spacing.xxl },
  etiqueta: {
    color: colors.muted,
    fontFamily: fonts.medium,
    fontSize: fontSize.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 9,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.ink,
    fontFamily: fonts.regular,
    fontSize: fontSize.base,
  },
  aviso: {
    color: colors.accent,
    fontFamily: fonts.regular,
    fontSize: fontSize.sm,
    marginBottom: spacing.sm,
    lineHeight: 19,
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  gif: { width: 38, height: 38, borderRadius: 7, backgroundColor: colors.surface2 },
  filaTexto: { flex: 1, minWidth: 0 },
  filaNombre: { color: colors.ink, fontFamily: fonts.medium, fontSize: fontSize.sm },
  filaMeta: { color: colors.muted, fontFamily: fonts.regular, fontSize: 11, marginTop: 2 },
  cuadro: {
    width: 29,
    height: 29,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quitar: { color: colors.danger, fontFamily: fonts.medium, fontSize: fontSize.base },
  // Con `customHandle`, el asa es el ÚNICO punto por donde se puede arrastrar:
  // el resto de la fila no responde. Por eso necesita un área táctil de verdad
  // (44x44) y no el tamaño del glifo, que daba unos 20x21.
  asa: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  asaTexto: { color: colors.muted, fontSize: 20, letterSpacing: 1 },
  agregar: {
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.line,
    borderRadius: 9,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  agregarTexto: { color: colors.muted, fontFamily: fonts.medium, fontSize: fontSize.base },
  guardar: {
    backgroundColor: colors.primary,
    borderRadius: 9,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  guardarInactivo: { backgroundColor: colors.surface2 },
  guardarTexto: { color: colors.ink, fontFamily: fonts.semibold, fontSize: fontSize.base },
  ayuda: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
