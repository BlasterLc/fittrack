import { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  useAnalizarComida,
  useRegistrarComida,
  etiquetaPorHora,
  formatoFechaHora,
  type ItemComida,
} from '@/hooks/useComida';
import { EditorItems } from '@/components/EditorItems';
import { CampoFechaHora } from '@/components/CampoFechaHora';
import { colors, spacing, fonts, fontSize } from '@/theme/tokens';

export function RegistroComida({ onGuardado }: { onGuardado?: () => void }) {
  const [texto, setTexto] = useState('');
  const [items, setItems] = useState<ItemComida[] | null>(null);
  const [etiqueta, setEtiqueta] = useState(etiquetaPorHora());
  const [loggedAt, setLoggedAt] = useState<Date | null>(null);
  const ultimaSugerencia = useRef(etiqueta);
  const analizar = useAnalizarComida();
  const registrar = useRegistrarComida();

  function cambiarFecha(fecha: Date | null) {
    setLoggedAt(fecha);
    const sugerida = etiquetaPorHora(fecha ?? new Date());
    if (etiqueta === ultimaSugerencia.current) setEtiqueta(sugerida);
    ultimaSugerencia.current = sugerida;
  }

  function analizarTexto() {
    if (!texto.trim()) return;
    analizar.mutate({ texto }, { onSuccess: (d) => setItems(d.items) });
  }

  async function elegirFoto() {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      Alert.alert('Permiso denegado', 'Necesitamos acceso a tus fotos para analizarlas.');
      return;
    }
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      base64: true,
      quality: 0.6,
    });
    if (r.canceled || !r.assets[0]?.base64) return;
    analizar.mutate({ imagen_base64: r.assets[0].base64 }, { onSuccess: (d) => setItems(d.items) });
  }

  function guardar() {
    if (!items || items.length === 0) return;
    registrar.mutate(
      { items, etiqueta, ...(loggedAt ? { logged_at: loggedAt.toISOString() } : {}) },
      {
        onSuccess: () => {
          const sugerida = etiquetaPorHora();
          setTexto('');
          setItems(null);
          setEtiqueta(sugerida);
          setLoggedAt(null);
          ultimaSugerencia.current = sugerida;
          onGuardado?.();
        },
        onError: (e) => Alert.alert('No se pudo guardar', (e as Error).message),
      },
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <TextInput
        style={styles.input}
        placeholder="Describe tu comida (o usa el micrófono del teclado)"
        placeholderTextColor={colors.muted}
        multiline
        value={texto}
        onChangeText={setTexto}
      />

      <View style={styles.fila}>
        <Pressable style={[styles.boton, styles.secundario]} onPress={elegirFoto} disabled={analizar.isPending}>
          <Text style={styles.botonTextoSec}>Foto</Text>
        </Pressable>
        <Pressable
          style={[styles.boton, styles.primario]}
          onPress={analizarTexto}
          disabled={analizar.isPending || !texto.trim()}
        >
          {analizar.isPending ? (
            <ActivityIndicator color={colors.ink} />
          ) : (
            <Text style={styles.botonTexto}>Analizar</Text>
          )}
        </Pressable>
      </View>

      {analizar.isError && <Text style={styles.error}>{(analizar.error as Error).message}</Text>}

      {items && (
        <View style={styles.resultado}>
          <EditorItems items={items} onChange={setItems} />
          <Text style={styles.label}>Etiqueta</Text>
          <TextInput style={styles.input} value={etiqueta} onChangeText={setEtiqueta} />

          <View style={styles.fila}>
            <CampoFechaHora valor={loggedAt ?? new Date()} onCambio={cambiarFecha}>
              <Text style={styles.enlaceFecha}>
                {loggedAt ? `Guardar para: ${formatoFechaHora(loggedAt)}` : 'Cambiar fecha y hora'}
              </Text>
            </CampoFechaHora>
            {loggedAt && (
              <Pressable style={styles.toqueFecha} onPress={() => cambiarFecha(null)} hitSlop={8}>
                <Text style={styles.enlaceFecha}>Usar ahora</Text>
              </Pressable>
            )}
          </View>

          <Pressable
            style={[styles.boton, styles.primario, { marginTop: spacing.md }]}
            onPress={guardar}
            disabled={registrar.isPending}
          >
            {registrar.isPending ? (
              <ActivityIndicator color={colors.ink} />
            ) : (
              <Text style={styles.botonTexto}>Guardar</Text>
            )}
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.xl, gap: spacing.md },
  input: {
    backgroundColor: colors.surface,
    color: colors.ink,
    fontFamily: fonts.regular,
    fontSize: fontSize.base,
    borderRadius: 10,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    minHeight: 48,
  },
  fila: { flexDirection: 'row', gap: spacing.md },
  boton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primario: { backgroundColor: colors.primary },
  secundario: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line },
  botonTexto: { color: colors.ink, fontFamily: fonts.semibold, fontSize: fontSize.lg },
  botonTextoSec: { color: colors.ink, fontFamily: fonts.medium, fontSize: fontSize.base },
  error: { color: colors.accent, fontFamily: fonts.regular, fontSize: fontSize.sm },
  resultado: { gap: spacing.md, marginTop: spacing.sm },
  label: { color: colors.muted, fontFamily: fonts.regular, fontSize: fontSize.sm },
  enlaceFecha: { color: colors.primaryText, fontFamily: fonts.medium, fontSize: fontSize.sm },
  toqueFecha: { minHeight: 48, justifyContent: 'center' },
});
