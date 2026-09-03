import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { alerta } from '@/lib/alerta';
import { FilaNumero } from '@/components/CamposPerfil';
import { useRegistrarPeso } from '@/hooks/useProgreso';
import { colors, spacing, fonts, fontSize } from '@/theme/tokens';

export function HojaRegistrarPeso({
  visible,
  onCerrar,
}: {
  visible: boolean;
  onCerrar: () => void;
}) {
  const [kg, setKg] = useState<number | null>(null);
  const registrar = useRegistrarPeso();

  function cerrarYLimpiar() {
    setKg(null);
    onCerrar();
  }

  function guardar() {
    if (kg === null) return;
    registrar.mutate(kg, {
      onSuccess: cerrarYLimpiar,
      onError: (e) => alerta('No se pudo guardar', (e as Error).message),
    });
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={cerrarYLimpiar}>
      {/* La hoja sube con el teclado para no tapar el campo ni los botones.
          Solo iOS: en Android la ventana ya se redimensiona sola. */}
      <KeyboardAvoidingView
        style={styles.fondo}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.hoja}>
          <ScrollView
            contentContainerStyle={styles.cuerpo}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.h2}>Registrar peso</Text>
            <FilaNumero etiqueta="Peso" unidad="kg" valor={kg} decimal onCambio={setKg} />
            <View style={styles.filaBotones}>
              <Pressable style={[styles.boton, styles.secundario]} onPress={cerrarYLimpiar}>
                <Text style={styles.botonTextoSec} numberOfLines={1}>
                  Cancelar
                </Text>
              </Pressable>
              <Pressable
                style={[styles.boton, styles.primario]}
                onPress={guardar}
                disabled={registrar.isPending || kg === null}
              >
                {registrar.isPending ? (
                  <ActivityIndicator color={colors.ink} />
                ) : (
                  <Text style={styles.botonTexto} numberOfLines={1}>
                    Guardar
                  </Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fondo: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  hoja: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '90%',
  },
  cuerpo: { gap: spacing.md, padding: spacing.xl },
  h2: { color: colors.ink, fontFamily: fonts.bold, fontSize: fontSize.xl },
  filaBotones: { flexDirection: 'row', gap: spacing.md },
  boton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 10,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primario: { backgroundColor: colors.primary },
  secundario: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line },
  botonTexto: { color: colors.ink, fontFamily: fonts.semibold, fontSize: fontSize.lg },
  botonTextoSec: { color: colors.ink, fontFamily: fonts.medium, fontSize: fontSize.base },
});
