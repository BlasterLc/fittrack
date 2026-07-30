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
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import * as Crypto from 'expo-crypto';
import {
  rutinaDetalleQuery,
  useArchivarRutina,
  useRutinas,
  type RutinaEnLista,
} from '@/hooks/useRutinas';
import { escribirBorrador, leerBorrador, valorInicial } from '@/lib/sesion';
import { colors, spacing, fonts, fontSize } from '@/theme/tokens';

export function RutinasLista() {
  const router = useRouter();
  const cliente = useQueryClient();
  const [archivadas, setArchivadas] = useState(false);
  const [empezando, setEmpezando] = useState<number | null>(null);
  const rutinas = useRutinas(archivadas);
  const archivar = useArchivarRutina();

  /**
   * Arma el borrador y abre la sesión.
   *
   * La lista solo tiene resúmenes, así que el detalle se pide acá: trae los
   * ejercicios y los defaults de la última vez, que es de donde arrancan las
   * ruedas. Se copian al borrador y no se vuelven a pedir, para que entrenar
   * siga funcionando sin señal.
   */
  async function empezar(rutina: RutinaEnLista) {
    if (empezando !== null) return;

    // Un borrador vivo no se pisa nunca: adentro está el entrenamiento que el
    // usuario todavía no guardó.
    const abierto = await leerBorrador();
    if (abierto) {
      Alert.alert(
        'Ya tienes un entrenamiento abierto',
        `Termina o descarta «${abierto.nombreRutina}» antes de empezar otro.`,
        [
          { text: 'Ahora no', style: 'cancel' },
          { text: 'Ir al entrenamiento', onPress: () => router.push('/sesion') },
        ],
      );
      return;
    }

    setEmpezando(rutina.id);
    try {
      const detalle = await cliente.fetchQuery(rutinaDetalleQuery(rutina.id));
      if (detalle.ejercicios.length === 0) {
        Alert.alert(
          'Esta rutina no tiene ejercicios',
          'Agrégale al menos uno antes de entrenarla.',
        );
        return;
      }

      await escribirBorrador({
        clientId: Crypto.randomUUID(),
        rutinaId: detalle.id,
        nombreRutina: detalle.nombre,
        // Con toISOString, nunca armada a mano con campos locales: así se
        // guardaba el día anterior en el selector de fecha del perfil.
        iniciadoEn: new Date().toISOString(),
        terminadoEn: null,
        indiceActual: 0,
        ejercicios: detalle.ejercicios.map((e) => ({
          catalogId: e.id,
          nombre: e.nombre_es,
          gifUrl: e.gif_url,
          equipamiento: e.equipment_es,
          agregado: false,
          repsDefault: e.reps_default,
          kgDefault: e.weight_default,
          // Las filas nacen con el entrenamiento: tantas como hiciste la
          // última vez, o una si el ejercicio es nuevo. Registrar la serie 2
          // no puede costar un toque para «agregarla» primero.
          series: Array.from({ length: Math.max(1, e.sets_default ?? 1) }, () => ({
            reps: valorInicial(e.reps_default, 'reps'),
            kg: valorInicial(e.weight_default, 'kg'),
            completadaEn: null,
          })),
        })),
      });
      router.push('/sesion');
    } catch (error) {
      Alert.alert('No pudimos abrir la rutina', (error as Error).message);
    } finally {
      setEmpezando(null);
    }
  }

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
          onEmpezar={() => empezar(item)}
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
