import { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  useArchivarRutina,
  useRutinas,
  type RutinaEnLista,
} from '@/hooks/useRutinas';
import { useEmpezarRutina } from '@/hooks/useEmpezarRutina';
import { colors, spacing, fonts, fontSize } from '@/theme/tokens';

export function RutinasLista() {
  const router = useRouter();
  const [archivadas, setArchivadas] = useState(false);
  const rutinas = useRutinas(archivadas);
  const archivar = useArchivarRutina();
  const { empezar, empezando } = useEmpezarRutina();

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
          onEmpezar={() => empezar(item.id)}
          onArchivar={() =>
            archivar.mutate({ id: item.id, archivada: !archivadas })
          }
          archivada={archivadas}
          empezando={empezando === item.id}
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
  onEmpezar,
  onArchivar,
  archivada,
  empezando,
}: {
  rutina: RutinaEnLista;
  onPress: () => void;
  onEmpezar: () => void;
  onArchivar: () => void;
  archivada: boolean;
  empezando: boolean;
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
      {/* Una rutina archivada no se entrena: el backend tampoco le escribe los
          defaults de vuelta. */}
      {!archivada && (
        <Pressable
          style={styles.empezar}
          onPress={onEmpezar}
          disabled={empezando}
          accessibilityRole="button"
          accessibilityLabel={`Empezar ${rutina.nombre}`}
          accessibilityState={{ disabled: empezando }}
        >
          {empezando ? (
            <ActivityIndicator color={colors.primaryText} size="small" />
          ) : (
            <Text style={styles.empezarTexto}>Empezar</Text>
          )}
        </Pressable>
      )}
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
  empezar: {
    // 48dp de alto real, no hitSlop: es el mínimo táctil de Android y un
    // hitSlop que se sale del padre no recibe el toque.
    minHeight: 48,
    minWidth: 88,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
  },
  // `primaryText`, no `primary`: el relleno índigo con texto encima no llega
  // al contraste mínimo y esta es la acción principal de la pantalla.
  empezarTexto: { color: colors.primaryText, fontFamily: fonts.semibold, fontSize: fontSize.base },
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
