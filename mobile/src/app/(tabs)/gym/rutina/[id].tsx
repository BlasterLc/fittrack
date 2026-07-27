import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  useCrearRutina,
  useGuardarRutina,
  useRutina,
} from '@/hooks/useRutinas';
import type { EjercicioResumen } from '@/hooks/useCatalogo';
import { apiGet } from '@/lib/api';
import { colors, spacing, fonts, fontSize } from '@/theme/tokens';

export default function EditorRutina() {
  const router = useRouter();
  const { id, elegidos, ts } = useLocalSearchParams<{
    id: string;
    elegidos?: string;
    ts?: string;
  }>();
  const esNueva = id === 'nueva';
  const rutinaId = esNueva ? null : Number(id);

  const detalle = useRutina(rutinaId);
  const crear = useCrearRutina();
  const guardar = useGuardarRutina(rutinaId ?? 0);

  const [nombre, setNombre] = useState('');
  const [lista, setLista] = useState<EjercicioResumen[]>([]);
  const [sucio, setSucio] = useState(false);

  // Carga inicial desde el servidor, una sola vez.
  useEffect(() => {
    if (detalle.data) {
      setNombre(detalle.data.nombre);
      setLista(detalle.data.ejercicios);
    }
  }, [detalle.data]);

  // Vuelta desde la pantalla de selección: se piden las fichas de los ids
  // elegidos y se reemplaza la lista.
  useEffect(() => {
    if (!elegidos) return;
    const ids = elegidos.split(',').filter(Boolean);
    let cancelado = false;

    Promise.all(ids.map((i) => apiGet<EjercicioResumen>(`/api/catalog/${i}`)))
      .then((fichas) => {
        if (!cancelado) {
          setLista(fichas);
          setSucio(true);
        }
      })
      .catch(() => {
        if (!cancelado) Alert.alert('No pudimos cargar los ejercicios elegidos');
      });

    return () => {
      cancelado = true;
    };
    // `ts` está en las dependencias a propósito: sin él, volver con el mismo
    // conjunto de ids no cambiaría `elegidos` y el efecto no correría.
  }, [elegidos, ts]);

  const nombreValido = nombre.trim().length > 0;
  const puedeGuardar = nombreValido && lista.length > 0;
  const guardando = crear.isPending || guardar.isPending;

  function mover(desde: number, hacia: number) {
    if (hacia < 0 || hacia >= lista.length) return;
    const copia = [...lista];
    const [movido] = copia.splice(desde, 1);
    copia.splice(hacia, 0, movido);
    setLista(copia);
    setSucio(true);
  }

  function quitar(indice: number) {
    setLista((previos) => previos.filter((_, i) => i !== indice));
    setSucio(true);
  }

  function alGuardar() {
    const body = { nombre: nombre.trim(), catalog_ids: lista.map((e) => e.id) };
    const mutacion = esNueva ? crear : guardar;
    mutacion.mutate(body, {
      onSuccess: () => router.back(),
      onError: (error: Error) => Alert.alert('No pudimos guardar', error.message),
    });
  }

  function alSalir() {
    if (!sucio) {
      router.back();
      return;
    }
    Alert.alert('Salir sin guardar', 'Se perderán los cambios de esta rutina.', [
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

      <ScrollView contentContainerStyle={styles.cuerpo}>
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

        {lista.map((e, i) => (
          <View key={e.id} style={styles.fila}>
            <Image source={{ uri: e.gif_url }} style={styles.gif} contentFit="contain" cachePolicy="memory-disk" />
            <View style={styles.filaTexto}>
              <Text style={styles.filaNombre}>{e.nombre_es}</Text>
              <Text style={styles.filaMeta}>{e.body_part_es}</Text>
            </View>
            <Pressable onPress={() => mover(i, i - 1)} hitSlop={12} style={styles.cuadro}>
              <Text style={styles.cuadroTexto}>↑</Text>
            </Pressable>
            <Pressable onPress={() => mover(i, i + 1)} hitSlop={12} style={styles.cuadro}>
              <Text style={styles.cuadroTexto}>↓</Text>
            </Pressable>
            <Pressable onPress={() => quitar(i)} hitSlop={12} style={styles.cuadro}>
              <Text style={styles.quitar}>×</Text>
            </Pressable>
          </View>
        ))}

        <Pressable
          style={styles.agregar}
          onPress={() =>
            router.push({
              pathname: '/gym/rutina/agregar',
              params: { ya: lista.map((e) => e.id).join(','), rutina: id },
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
      </ScrollView>
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
  cuadroTexto: { color: colors.muted, fontFamily: fonts.medium, fontSize: fontSize.sm },
  quitar: { color: colors.danger, fontFamily: fonts.medium, fontSize: fontSize.base },
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
