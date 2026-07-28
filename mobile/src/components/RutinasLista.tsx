import { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useArchivarRutina, useRutinas, type RutinaEnLista } from '@/hooks/useRutinas';
import { colors, spacing, fonts, fontSize } from '@/theme/tokens';

export function RutinasLista() {
  const router = useRouter();
  const [archivadas, setArchivadas] = useState(false);
  const rutinas = useRutinas(archivadas);
  const archivar = useArchivarRutina();

  if (rutinas.isPending) {
    return <ActivityIndicator style={styles.centrado} color={colors.primary} />;
  }

  if (rutinas.isError) {
    return (
      <View style={styles.centrado}>
        <Text style={styles.vacioTitulo}>No pudimos cargar tus rutinas</Text>
        <Pressable onPress={() => rutinas.refetch()} hitSlop={10}>
          <Text style={styles.accion}>Reintentar</Text>
        </Pressable>
      </View>
    );
  }

  // Estado vacío que enseña qué es una rutina: es la primera pantalla que se
  // ve al entrar a Gym sin nada creado.
  if (rutinas.data.length === 0 && !archivadas) {
    return (
      <View style={styles.centrado}>
        <Text style={styles.vacioTitulo}>Todavía no tienes rutinas</Text>
        <Text style={styles.vacioTexto}>
          Una rutina es una lista de ejercicios en orden.{'\n'}
          La armas una vez y la repites cada vez que entrenas.
        </Text>
        <Pressable style={styles.cta} onPress={() => router.push('/gym/rutina/nueva')}>
          <Text style={styles.ctaTexto}>Crear mi primera rutina</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <FlatList
      data={rutinas.data}
      keyExtractor={(r) => String(r.id)}
      renderItem={({ item }) => (
        <Fila
          rutina={item}
          onPress={() => router.push(`/gym/rutina/${item.id}`)}
          onArchivar={() =>
            archivar.mutate({ id: item.id, archivada: !archivadas })
          }
          archivada={archivadas}
        />
      )}
      ListEmptyComponent={
        <Text style={styles.vacioLista}>No tienes rutinas archivadas.</Text>
      }
      ListFooterComponent={
        <View style={styles.pie}>
          {!archivadas && (
            <Pressable style={styles.nueva} onPress={() => router.push('/gym/rutina/nueva')}>
              <Text style={styles.nuevaTexto}>+ Nueva rutina</Text>
            </Pressable>
          )}
          <Pressable onPress={() => setArchivadas((a) => !a)} hitSlop={10}>
            <Text style={styles.accion}>
              {archivadas ? 'Ver rutinas activas' : 'Ver archivadas'}
            </Text>
          </Pressable>
        </View>
      }
    />
  );
}

function Fila({
  rutina,
  onPress,
  onArchivar,
  archivada,
}: {
  rutina: RutinaEnLista;
  onPress: () => void;
  onArchivar: () => void;
  archivada: boolean;
}) {
  return (
    <Pressable style={styles.fila} onPress={onPress}>
      <View style={styles.filaTexto}>
        <Text style={styles.filaNombre}>{rutina.nombre}</Text>
        <Text style={styles.filaMeta}>
          {rutina.total_ejercicios} {rutina.total_ejercicios === 1 ? 'ejercicio' : 'ejercicios'}
          {rutina.grupos_musculares.length > 0
            ? ` · ${rutina.grupos_musculares.join(', ')}`
            : ''}
        </Text>
      </View>
      <Pressable onPress={onArchivar} hitSlop={12}>
        <Text style={styles.archivar}>{archivada ? 'Restaurar' : 'Archivar'}</Text>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  centrado: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  vacioTitulo: { color: colors.ink, fontFamily: fonts.semibold, fontSize: fontSize.lg, textAlign: 'center' },
  vacioTexto: { color: colors.muted, fontFamily: fonts.regular, fontSize: fontSize.sm, textAlign: 'center', lineHeight: 21 },
  vacioLista: { color: colors.muted, fontFamily: fonts.regular, fontSize: fontSize.sm, textAlign: 'center', padding: spacing.xl },
  cta: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: spacing.md, paddingHorizontal: spacing.xl },
  ctaTexto: { color: colors.ink, fontFamily: fonts.semibold, fontSize: fontSize.base },
  accion: { color: colors.primaryText, fontFamily: fonts.semibold, fontSize: fontSize.base },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  filaTexto: { flex: 1, minWidth: 0 },
  filaNombre: { color: colors.ink, fontFamily: fonts.semibold, fontSize: fontSize.base },
  filaMeta: { color: colors.muted, fontFamily: fonts.regular, fontSize: fontSize.sm, marginTop: 3 },
  archivar: { color: colors.muted, fontFamily: fonts.medium, fontSize: fontSize.sm },
  pie: { padding: spacing.xl, gap: spacing.lg, alignItems: 'center' },
  nueva: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  nuevaTexto: { color: colors.ink, fontFamily: fonts.semibold, fontSize: fontSize.base },
});
