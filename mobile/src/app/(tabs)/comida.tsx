import { useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import {
  useAnalizarComida,
  useRegistrarComida,
  etiquetaPorHora,
  type ItemComida,
} from '@/hooks/useComida';
import { colors, spacing, fonts, fontSize } from '@/theme/tokens';

export default function Comida() {
  const [texto, setTexto] = useState('');
  const [items, setItems] = useState<ItemComida[] | null>(null);
  const [etiqueta, setEtiqueta] = useState(etiquetaPorHora());
  const analizar = useAnalizarComida();
  const registrar = useRegistrarComida();

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

  function editarItem(indice: number, campo: keyof ItemComida, valor: string) {
    setItems((prev) => {
      if (!prev) return prev;
      const copia = [...prev];
      const nuevo = campo === 'nombre' ? valor : Number(valor.replace(',', '.')) || 0;
      copia[indice] = { ...copia[indice], [campo]: nuevo };
      return copia;
    });
  }

  function guardar() {
    if (!items || items.length === 0) return;
    registrar.mutate(
      { items, etiqueta },
      {
        onSuccess: () => {
          setTexto('');
          setItems(null);
          setEtiqueta(etiquetaPorHora());
          Alert.alert('Guardado', 'Tu comida quedó registrada.');
        },
        onError: (e) => Alert.alert('No se pudo guardar', (e as Error).message),
      },
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.h1}>Comida</Text>

        <TextInput
          style={styles.input}
          placeholder="Describe tu comida (o usa el micrófono del teclado)"
          placeholderTextColor={colors.muted}
          multiline
          value={texto}
          onChangeText={setTexto}
        />

        <View style={styles.fila}>
          <Pressable
            style={[styles.boton, styles.secundario]}
            onPress={elegirFoto}
            disabled={analizar.isPending}
          >
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

        {analizar.isError && (
          <Text style={styles.error}>{(analizar.error as Error).message}</Text>
        )}

        {items && (
          <View style={styles.resultado}>
            {items.map((item, indice) => (
              <View key={indice} style={styles.item}>
                <TextInput
                  style={styles.itemNombre}
                  value={item.nombre}
                  onChangeText={(v) => editarItem(indice, 'nombre', v)}
                />
                <View style={styles.macros}>
                  <Campo etiqueta="kcal" valor={item.calorias} onChange={(v) => editarItem(indice, 'calorias', v)} />
                  <Campo etiqueta="P" valor={item.prot_g} onChange={(v) => editarItem(indice, 'prot_g', v)} />
                  <Campo etiqueta="C" valor={item.carbs_g} onChange={(v) => editarItem(indice, 'carbs_g', v)} />
                  <Campo etiqueta="G" valor={item.fat_g} onChange={(v) => editarItem(indice, 'fat_g', v)} />
                </View>
              </View>
            ))}

            <Text style={styles.label}>Etiqueta</Text>
            <TextInput style={styles.input} value={etiqueta} onChangeText={setEtiqueta} />

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
    </SafeAreaView>
  );
}

function Campo({
  etiqueta,
  valor,
  onChange,
}: {
  etiqueta: string;
  valor: number;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.campo}>
      <Text style={styles.campoLabel}>{etiqueta}</Text>
      <TextInput
        style={styles.campoInput}
        value={String(valor)}
        onChangeText={onChange}
        keyboardType="numeric"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  body: { padding: spacing.xl, gap: spacing.md },
  h1: { color: colors.ink, fontFamily: fonts.bold, fontSize: fontSize.xxl },
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
  item: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    gap: spacing.sm,
  },
  itemNombre: { color: colors.ink, fontFamily: fonts.medium, fontSize: fontSize.base },
  macros: { flexDirection: 'row', gap: spacing.sm },
  campo: { flex: 1, alignItems: 'center', gap: 2 },
  campoLabel: { color: colors.muted, fontFamily: fonts.regular, fontSize: fontSize.sm },
  campoInput: {
    color: colors.ink,
    fontFamily: fonts.medium,
    fontSize: fontSize.base,
    fontVariant: ['tabular-nums'],
    backgroundColor: colors.surface2,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  label: { color: colors.muted, fontFamily: fonts.regular, fontSize: fontSize.sm },
});
