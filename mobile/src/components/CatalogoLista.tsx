import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Image } from 'expo-image';
import { useBuscarCatalogo, type EjercicioResumen } from '@/hooks/useCatalogo';
import { useDebounce } from '@/hooks/useDebounce';
import { FiltrosCatalogo } from '@/components/FiltrosCatalogo';
import { colors, spacing, fonts, fontSize } from '@/theme/tokens';

// CatalogoLista no sabe en qué modo está: su única frontera con el resto de
// la app es onSeleccionar. Hoy la pantalla del catálogo le pasa router.push;
// en la Fase 5b el editor de rutinas le va a pasar selección múltiple, sin
// tocar nada de acá adentro. Por eso no hay checkboxes ni prop `modo`.
export function CatalogoLista({
  onSeleccionar,
}: {
  onSeleccionar: (ejercicio: EjercicioResumen) => void;
}) {
  const [texto, setTexto] = useState('');
  const [grupo, setGrupo] = useState<string | null>(null);
  const [equipo, setEquipo] = useState<string | null>(null);

  const q = useDebounce(texto, 300);
  const busqueda = useBuscarCatalogo(q, grupo, equipo);

  const ejercicios = busqueda.data?.pages.flatMap((p) => p.resultados) ?? [];
  const total = busqueda.data?.pages[0]?.total ?? 0;

  function limpiar() {
    setTexto('');
    setGrupo(null);
    setEquipo(null);
  }

  return (
    <View style={styles.contenedor}>
      <View style={styles.cabecera}>
        <TextInput
          style={styles.buscador}
          value={texto}
          onChangeText={setTexto}
          placeholder="Buscar ejercicio…"
          placeholderTextColor={colors.muted}
          autoCorrect={false}
          returnKeyType="search"
        />
      </View>

      <FiltrosCatalogo
        grupo={grupo}
        equipo={equipo}
        onGrupo={setGrupo}
        onEquipo={setEquipo}
      />

      {busqueda.isPending ? (
        <ActivityIndicator style={styles.centrado} color={colors.primary} />
      ) : busqueda.isError ? (
        <View style={styles.centrado}>
          <Text style={styles.vacioTitulo}>No pudimos cargar el catálogo</Text>
          <Pressable onPress={() => busqueda.refetch()} hitSlop={10}>
            <Text style={styles.accion}>Reintentar</Text>
          </Pressable>
        </View>
      ) : ejercicios.length === 0 ? (
        <View style={styles.centrado}>
          <Text style={styles.vacioTitulo}>No encontramos ejercicios con esos filtros</Text>
          <Pressable onPress={limpiar} hitSlop={10}>
            <Text style={styles.accion}>Limpiar filtros</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={ejercicios}
          keyExtractor={(e) => e.id}
          ListHeaderComponent={<Text style={styles.total}>{total} ejercicios</Text>}
          renderItem={({ item }) => <Fila ejercicio={item} onPress={() => onSeleccionar(item)} />}
          onEndReached={() => {
            if (busqueda.hasNextPage && !busqueda.isFetchingNextPage) {
              busqueda.fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            busqueda.isFetchingNextPage ? (
              <ActivityIndicator style={styles.pie} color={colors.primary} />
            ) : null
          }
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          initialNumToRender={12}
          windowSize={7}
          removeClippedSubviews
        />
      )}
    </View>
  );
}

function Fila({ ejercicio, onPress }: { ejercicio: EjercicioResumen; onPress: () => void }) {
  return (
    <Pressable style={styles.fila} onPress={onPress}>
      <Image
        source={{ uri: ejercicio.gif_url }}
        style={styles.miniatura}
        contentFit="contain"
        cachePolicy="memory-disk"
        recyclingKey={ejercicio.id}
        transition={120}
      />
      <View style={styles.filaTexto}>
        <Text style={styles.nombre} numberOfLines={2}>
          {ejercicio.nombre_es}
        </Text>
        <Text style={styles.sub}>
          {ejercicio.body_part_es} · {ejercicio.equipment_es}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1 },
  cabecera: { paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
  buscador: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    color: colors.ink,
    fontFamily: fonts.regular,
    fontSize: fontSize.base,
  },
  total: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: fontSize.sm,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  miniatura: { width: 48, height: 48, borderRadius: 8, backgroundColor: colors.surface2 },
  filaTexto: { flex: 1 },
  nombre: { color: colors.ink, fontFamily: fonts.semibold, fontSize: fontSize.base },
  sub: { color: colors.muted, fontFamily: fonts.regular, fontSize: fontSize.sm, marginTop: 2 },
  centrado: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  vacioTitulo: { color: colors.muted, fontFamily: fonts.regular, fontSize: fontSize.base, textAlign: 'center' },
  accion: { color: colors.primary, fontFamily: fonts.semibold, fontSize: fontSize.base },
  pie: { paddingVertical: spacing.lg },
});
