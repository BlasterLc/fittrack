import { View, Text, TextInput, StyleSheet } from 'react-native';
import type { ItemComida } from '@/hooks/useComida';
import { colors, spacing, fonts, fontSize } from '@/theme/tokens';

export function EditorItems({
  items,
  onChange,
}: {
  items: ItemComida[];
  onChange: (items: ItemComida[]) => void;
}) {
  function editar(indice: number, campo: keyof ItemComida, valor: string) {
    const copia = [...items];
    const nuevo = campo === 'nombre' ? valor : Number(valor.replace(',', '.')) || 0;
    copia[indice] = { ...copia[indice], [campo]: nuevo };
    onChange(copia);
  }

  return (
    <View style={{ gap: spacing.md }}>
      {items.map((item, indice) => (
        <View key={indice} style={styles.item}>
          <TextInput
            style={styles.itemNombre}
            value={item.nombre}
            onChangeText={(v) => editar(indice, 'nombre', v)}
          />
          <View style={styles.macros}>
            <Campo etiqueta="kcal" valor={item.calorias} onChange={(v) => editar(indice, 'calorias', v)} />
            <Campo etiqueta="P" valor={item.prot_g} onChange={(v) => editar(indice, 'prot_g', v)} />
            <Campo etiqueta="C" valor={item.carbs_g} onChange={(v) => editar(indice, 'carbs_g', v)} />
            <Campo etiqueta="G" valor={item.fat_g} onChange={(v) => editar(indice, 'fat_g', v)} />
          </View>
        </View>
      ))}
    </View>
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
});
