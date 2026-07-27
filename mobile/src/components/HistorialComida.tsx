import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import {
  useHistorialComida,
  useEditarComida,
  useEliminarComida,
  type ComidaGuardada,
  type ItemComida,
} from '@/hooks/useComida';
import { useDashboard } from '@/hooks/useDashboard';
import { EditorItems } from '@/components/EditorItems';
import { colors, spacing, fonts, fontSize } from '@/theme/tokens';

type Dia = {
  clave: string;
  label: string;
  esHoy: boolean;
  comidas: ComidaGuardada[];
  kcal: number;
  prot: number;
  carb: number;
  fat: number;
};

function agruparPorDia(comidas: ComidaGuardada[]): Dia[] {
  const hoy = new Date();
  const claveHoy = `${hoy.getFullYear()}-${hoy.getMonth()}-${hoy.getDate()}`;
  const mapa = new Map<string, Dia>();

  for (const c of comidas) {
    const f = new Date(c.logged_at);
    const clave = `${f.getFullYear()}-${f.getMonth()}-${f.getDate()}`;
    let dia = mapa.get(clave);
    if (!dia) {
      dia = {
        clave,
        label: f.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' }),
        esHoy: clave === claveHoy,
        comidas: [],
        kcal: 0,
        prot: 0,
        carb: 0,
        fat: 0,
      };
      mapa.set(clave, dia);
    }
    dia.comidas.push(c);
    for (const it of c.items) {
      dia.kcal += it.calorias;
      dia.prot += it.prot_g;
      dia.carb += it.carbs_g;
      dia.fat += it.fat_g;
    }
  }

  const dias = [...mapa.values()];
  for (const d of dias) d.comidas.sort((a, b) => a.logged_at.localeCompare(b.logged_at));
  dias.sort((a, b) => (a.clave < b.clave ? 1 : -1)); // más nuevo arriba
  return dias;
}

export function HistorialComida() {
  const [mesesAtras, setMesesAtras] = useState(0);
  const ahora = new Date();
  const desde = new Date(ahora.getFullYear(), ahora.getMonth() - mesesAtras, 1).toISOString();
  const hasta = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1).toISOString();

  const historial = useHistorialComida(desde, hasta);
  const dashboard = useDashboard();
  const meta = dashboard.data?.calorias.meta ?? 2000;
  const eliminar = useEliminarComida();

  const [togglesDia, setTogglesDia] = useState<Record<string, boolean>>({});
  const [expandidas, setExpandidas] = useState<Record<number, boolean>>({});
  const [editando, setEditando] = useState<ComidaGuardada | null>(null);

  const dias = agruparPorDia(historial.data ?? []);

  function diaAbierto(d: Dia) {
    return togglesDia[d.clave] ?? d.esHoy;
  }

  function confirmarEliminar(c: ComidaGuardada) {
    Alert.alert('Eliminar comida', '¿Seguro que quieres eliminar esta comida?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => eliminar.mutate(c.id) },
    ]);
  }

  return (
    <ScrollView contentContainerStyle={styles.body}>
      {historial.isLoading && (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      )}
      {historial.isError && <Text style={styles.error}>No pudimos cargar tu historial.</Text>}
      {historial.data && dias.length === 0 && (
        <Text style={styles.vacio}>Todavía no registraste comidas en este período.</Text>
      )}

      {dias.map((d) => {
        const abierto = diaAbierto(d);
        return (
          <View key={d.clave} style={styles.dia}>
            <Pressable
              style={styles.diaHeader}
              onPress={() => setTogglesDia((p) => ({ ...p, [d.clave]: !abierto }))}
            >
              <View style={styles.diaTituloFila}>
                <Text style={styles.diaTitulo}>{d.esHoy ? 'Hoy' : d.label}</Text>
                <Text style={styles.diaKcal}>
                  {Math.round(d.kcal)} / {meta} kcal
                </Text>
              </View>
              <View style={styles.barra}>
                <View
                  style={[styles.barraFill, { width: `${Math.min(100, (d.kcal / meta) * 100)}%` }]}
                />
              </View>
              <MacrosResumen prot={d.prot} carb={d.carb} fat={d.fat} />
            </Pressable>

            {abierto &&
              d.comidas.map((c) => {
                const abierta = !!expandidas[c.id];
                const hora = new Date(c.logged_at).toLocaleTimeString('es-CL', {
                  hour: '2-digit',
                  minute: '2-digit',
                });
                const kcalComida = c.items.reduce((s, it) => s + it.calorias, 0);
                return (
                  <View key={c.id} style={styles.comida}>
                    <Pressable
                      style={styles.comidaHeader}
                      onPress={() => setExpandidas((p) => ({ ...p, [c.id]: !abierta }))}
                    >
                      <Text style={styles.comidaEtiqueta}>
                        {c.etiqueta ?? 'Comida'} · {hora}
                      </Text>
                      <Text style={styles.comidaKcal}>{Math.round(kcalComida)} kcal</Text>
                    </Pressable>
                    {abierta && (
                      <View style={styles.comidaDetalle}>
                        {c.items.map((it) => (
                          <Text key={it.id} style={styles.itemLinea}>
                            {it.nombre} — {Math.round(it.calorias)} kcal · P {it.prot_g} · C{' '}
                            {it.carbs_g} · G {it.fat_g}
                          </Text>
                        ))}
                        <View style={styles.acciones}>
                          <Pressable onPress={() => setEditando(c)} hitSlop={8}>
                            <Text style={styles.editar}>Editar</Text>
                          </Pressable>
                          <Pressable onPress={() => confirmarEliminar(c)} hitSlop={8}>
                            <Text style={styles.eliminar}>Eliminar</Text>
                          </Pressable>
                        </View>
                      </View>
                    )}
                  </View>
                );
              })}
          </View>
        );
      })}

      {historial.data && (
        <Pressable style={styles.mesAnterior} onPress={() => setMesesAtras((m) => m + 1)}>
          <Text style={styles.mesAnteriorTexto}>Cargar mes anterior</Text>
        </Pressable>
      )}

      <HojaEditar comida={editando} onCerrar={() => setEditando(null)} />
    </ScrollView>
  );
}

function MacrosResumen({ prot, carb, fat }: { prot: number; carb: number; fat: number }) {
  const [corto, setCorto] = useState(false);
  const p = Math.round(prot);
  const c = Math.round(carb);
  const g = Math.round(fat);
  const completo = `Proteína ${p} · Carbohidratos ${c} · Grasas ${g}`;
  const resumido = `P ${p} · C ${c} · G ${g}`;
  return (
    <Text
      style={styles.diaMacros}
      onTextLayout={(e) => {
        // Si la versión completa se parte en más de una línea, no cabe: pasa a P/C/G.
        if (!corto && e.nativeEvent.lines.length > 1) setCorto(true);
      }}
    >
      {corto ? resumido : completo}
    </Text>
  );
}

function HojaEditar({
  comida,
  onCerrar,
}: {
  comida: ComidaGuardada | null;
  onCerrar: () => void;
}) {
  const editar = useEditarComida();
  const [items, setItems] = useState<ItemComida[]>([]);
  const [etiqueta, setEtiqueta] = useState('');

  useEffect(() => {
    if (comida) {
      setItems(
        comida.items.map((it) => ({
          nombre: it.nombre,
          calorias: it.calorias,
          prot_g: it.prot_g,
          carbs_g: it.carbs_g,
          fat_g: it.fat_g,
        })),
      );
      setEtiqueta(comida.etiqueta ?? '');
    }
  }, [comida]);

  function guardar() {
    if (!comida) return;
    editar.mutate(
      { id: comida.id, items, etiqueta },
      {
        onSuccess: onCerrar,
        onError: (e) => Alert.alert('No se pudo guardar', (e as Error).message),
      },
    );
  }

  return (
    <Modal visible={comida !== null} animationType="slide" transparent onRequestClose={onCerrar}>
      <View style={styles.modalFondo}>
        <View style={styles.modalHoja}>
          <ScrollView
            contentContainerStyle={{ gap: spacing.md, padding: spacing.xl }}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.h2}>Editar comida</Text>
            <EditorItems items={items} onChange={setItems} />
            <Text style={styles.label}>Etiqueta</Text>
            <TextInput style={styles.input} value={etiqueta} onChangeText={setEtiqueta} />
            <View style={styles.filaBotones}>
              <Pressable style={[styles.boton, styles.secundario]} onPress={onCerrar}>
                <Text style={styles.botonTextoSec} numberOfLines={1}>
                  Cancelar
                </Text>
              </Pressable>
              <Pressable
                style={[styles.boton, styles.primario]}
                onPress={guardar}
                disabled={editar.isPending}
              >
                {editar.isPending ? (
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
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.xl, gap: spacing.md },
  error: { color: colors.accent, fontFamily: fonts.regular, fontSize: fontSize.base },
  vacio: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: fontSize.base,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  dia: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  diaHeader: { padding: spacing.md, gap: spacing.sm },
  diaTituloFila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  diaTitulo: {
    color: colors.ink,
    fontFamily: fonts.semibold,
    fontSize: fontSize.lg,
    textTransform: 'capitalize',
  },
  diaKcal: {
    color: colors.muted,
    fontFamily: fonts.medium,
    fontSize: fontSize.base,
    fontVariant: ['tabular-nums'],
  },
  barra: { height: 6, backgroundColor: colors.surface2, borderRadius: 3, overflow: 'hidden' },
  barraFill: { height: 6, backgroundColor: colors.primary },
  diaMacros: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: fontSize.sm,
    fontVariant: ['tabular-nums'],
  },
  comida: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  comidaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  comidaEtiqueta: { color: colors.ink, fontFamily: fonts.regular, fontSize: fontSize.base },
  comidaKcal: {
    color: colors.muted,
    fontFamily: fonts.medium,
    fontSize: fontSize.base,
    fontVariant: ['tabular-nums'],
  },
  comidaDetalle: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.xs },
  itemLinea: { color: colors.muted, fontFamily: fonts.regular, fontSize: fontSize.sm },
  acciones: { flexDirection: 'row', gap: spacing.xl, marginTop: spacing.sm },
  editar: { color: colors.primary, fontFamily: fonts.medium, fontSize: fontSize.base },
  eliminar: { color: colors.danger, fontFamily: fonts.medium, fontSize: fontSize.base },
  mesAnterior: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    marginTop: spacing.sm,
  },
  mesAnteriorTexto: { color: colors.muted, fontFamily: fonts.medium, fontSize: fontSize.base },
  modalFondo: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  modalHoja: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '90%',
  },
  h2: { color: colors.ink, fontFamily: fonts.bold, fontSize: fontSize.xl },
  label: { color: colors.muted, fontFamily: fonts.regular, fontSize: fontSize.sm },
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
  },
  filaBotones: { flexDirection: 'row', gap: spacing.md },
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
});
