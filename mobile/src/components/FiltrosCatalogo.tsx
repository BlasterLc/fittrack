import { useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, Modal, StyleSheet } from 'react-native';
import { useFiltros } from '@/hooks/useCatalogo';
import { colors, spacing, fonts, fontSize } from '@/theme/tokens';

type Props = {
  grupo: string | null;
  equipo: string | null;
  onGrupo: (valor: string | null) => void;
  onEquipo: (valor: string | null) => void;
};

export function FiltrosCatalogo({ grupo, equipo, onGrupo, onEquipo }: Props) {
  const filtros = useFiltros();
  const [hojaAbierta, setHojaAbierta] = useState(false);

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
  onPress,
  sufijo,
}: {
  label: string;
  activo: boolean;
  onPress: () => void;
  sufijo?: string;
}) {
  return (
    <Pressable
      style={[styles.chip, activo && styles.chipActivo]}
      onPress={onPress}
      hitSlop={6}
    >
      <Text style={[styles.chipTexto, activo && styles.chipTextoActivo]}>
        {label}
        {sufijo ? ` ${sufijo}` : ''}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  contenedor: { paddingBottom: spacing.sm },
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
  chipTexto: { color: colors.muted, fontFamily: fonts.medium, fontSize: fontSize.sm },
  chipTextoActivo: { color: colors.ink, fontFamily: fonts.semibold },
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
  cerrar: { color: colors.primary, fontFamily: fonts.semibold, fontSize: fontSize.base },
  rejilla: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingBottom: spacing.lg },
});
