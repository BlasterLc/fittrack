import { useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, Modal, StyleSheet } from 'react-native';
import { useFiltros } from '@/hooks/useCatalogo';
import { colors, spacing, fonts, fontSize } from '@/theme/tokens';

type Props = {
  q: string;
  grupo: string | null;
  equipo: string | null;
  onGrupo: (valor: string | null) => void;
  onEquipo: (valor: string | null) => void;
};

export function FiltrosCatalogo({ q, grupo, equipo, onGrupo, onEquipo }: Props) {
  const filtros = useFiltros(q, grupo, equipo);
  const [hojaAbierta, setHojaAbierta] = useState(false);

  // Un valor que no está en la lista de disponibles daría cero resultados
  // combinado con lo que ya está activo. Se atenúa en vez de esconderse: si
  // los chips desaparecieran, la fila saltaría en cada toque.
  const gruposOk = new Set(filtros.data?.grupos_disponibles ?? []);
  const equiposOk = new Set(filtros.data?.equipamientos_disponibles ?? []);

  return (
    <View style={styles.contenedor}>
      {filtros.isLoading && (
        <View style={styles.filaEstado}>
          <ActivityIndicator color={colors.primary} />
        </View>
      )}

      {filtros.isError && (
        <View style={styles.filaEstado}>
          <Text style={styles.error}>No pudimos cargar los filtros.</Text>
        </View>
      )}

      {filtros.data && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.fila}
        >
          {filtros.data.grupos_musculares.map((g) => (
            <Chip
              key={g}
              label={g}
              activo={grupo === g}
              // El activo nunca se atenúa: siempre se puede desactivar.
              vacio={grupo !== g && !gruposOk.has(g)}
              onPress={() => onGrupo(grupo === g ? null : g)}
            />
          ))}
          <Chip
            label={equipo ?? 'Equipamiento'}
            activo={Boolean(equipo)}
            sufijo="▾"
            onPress={() => setHojaAbierta(true)}
          />
        </ScrollView>
      )}

      <Modal
        visible={hojaAbierta}
        animationType="slide"
        transparent
        onRequestClose={() => setHojaAbierta(false)}
      >
        {/* flex:1 + justifyContent:'flex-end' ancla la hoja abajo; el Pressable
            de fondo se posiciona absoluto para no alterar ese layout y así
            recibir el toque en cualquier punto fuera de la hoja. */}
        <View style={styles.modalFondo}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setHojaAbierta(false)}
          />
          <View style={styles.hoja}>
            <View style={styles.hojaCabecera}>
              <Text style={styles.hojaTitulo}>Equipamiento</Text>
              <Pressable onPress={() => setHojaAbierta(false)} hitSlop={12}>
                <Text style={styles.cerrar}>Listo</Text>
              </Pressable>
            </View>

            <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={styles.rejilla}>
              <Chip
                label="Todos"
                activo={!equipo}
                onPress={() => {
                  onEquipo(null);
                  setHojaAbierta(false);
                }}
              />
              {(filtros.data?.equipamientos ?? []).map((e) => (
                <Chip
                  key={e}
                  label={e}
                  activo={equipo === e}
                  vacio={equipo !== e && !equiposOk.has(e)}
                  onPress={() => {
                    onEquipo(equipo === e ? null : e);
                    setHojaAbierta(false);
                  }}
                />
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Chip({
  label,
  activo,
  vacio = false,
  onPress,
  sufijo,
}: {
  label: string;
  activo: boolean;
  vacio?: boolean;
  onPress: () => void;
  sufijo?: string;
}) {
  return (
    <Pressable
      style={[styles.chip, activo && styles.chipActivo, vacio && styles.chipVacio]}
      onPress={onPress}
      disabled={vacio}
      // Sin esto un chip atenuado se lee como un chip cualquiera que no
      // responde: el lector de pantalla tiene que decir que está deshabilitado.
      accessibilityRole="button"
      accessibilityState={{ selected: activo, disabled: vacio }}
      accessibilityHint={vacio ? 'No hay ejercicios con esta combinación' : undefined}
      hitSlop={6}
    >
      <Text
        style={[
          styles.chipTexto,
          activo && styles.chipTextoActivo,
          vacio && styles.chipTextoVacio,
        ]}
      >
        {label}
        {sufijo ? ` ${sufijo}` : ''}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  contenedor: { paddingBottom: spacing.md },
  filaEstado: { paddingHorizontal: spacing.xl, paddingVertical: spacing.xs },
  error: { color: colors.accent, fontFamily: fonts.regular, fontSize: fontSize.sm },
  fila: { paddingHorizontal: spacing.xl, gap: spacing.sm },
  chip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  chipActivo: { backgroundColor: colors.primary, borderColor: colors.primary },
  // Atenuado, no ámbar: el ámbar del proyecto marca lo que necesita atención
  // y esto es apenas una opción que no aplica.
  chipVacio: { backgroundColor: 'transparent', borderColor: colors.line, opacity: 0.4 },
  chipTexto: { color: colors.muted, fontFamily: fonts.medium, fontSize: fontSize.sm },
  chipTextoActivo: { color: colors.ink, fontFamily: fonts.semibold },
  chipTextoVacio: { color: colors.muted },
  modalFondo: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  hoja: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    maxHeight: '65%',
  },
  hojaCabecera: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  hojaTitulo: { color: colors.ink, fontFamily: fonts.semibold, fontSize: fontSize.lg },
  cerrar: { color: colors.primaryText, fontFamily: fonts.semibold, fontSize: fontSize.base },
  rejilla: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingBottom: spacing.lg },
});
