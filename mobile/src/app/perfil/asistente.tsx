import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { HojaOpciones } from '@/components/HojaOpciones';
import { CampoFecha } from '@/components/CampoFecha';
import { MetasResumen } from '@/components/MetasResumen';
import { useGuardarPerfil, usePrevisualizacion } from '@/hooks/usePerfil';
import {
  FICHA_VACIA,
  OPCIONES_ACTIVIDAD,
  OPCIONES_OBJETIVO,
  OPCIONES_SEXO,
  etiquetaDe,
  fechaLegible,
  type FichaBorrador,
} from '@/lib/perfil';
import { colors, spacing, fonts, fontSize } from '@/theme/tokens';

const ULTIMO_PASO = 4;

export default function Asistente() {
  const router = useRouter();
  const [paso, setPaso] = useState(1);
  const [ficha, setFicha] = useState<FichaBorrador>(FICHA_VACIA);
  const [hoja, setHoja] = useState<'sexo' | 'actividad' | 'objetivo' | null>(null);

  const guardar = useGuardarPerfil();
  // Solo se consulta en el cierre: antes no hay datos suficientes y seria una
  // llamada al vacio.
  const previa = usePrevisualizacion(ficha, paso === ULTIMO_PASO + 1);

  function cambiar(cambios: Partial<FichaBorrador>) {
    setFicha((actual) => ({ ...actual, ...cambios }));
  }

  function atras() {
    if (paso === 1) router.back();
    else setPaso(paso - 1);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.barra}>
        <Pressable onPress={atras} hitSlop={12} accessibilityLabel="Atrás">
          <Text style={styles.volver}>‹ Atrás</Text>
        </Pressable>
        {paso <= ULTIMO_PASO && (
          <Pressable onPress={() => setPaso(paso + 1)} hitSlop={12}>
            <Text style={styles.omitir}>Omitir</Text>
          </Pressable>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.cuerpo}>
        {paso <= ULTIMO_PASO && <Text style={styles.progreso}>Paso {paso} de {ULTIMO_PASO}</Text>}

        {paso === 1 && (
          <>
            <Text style={styles.h1}>¿Cómo te llamas?</Text>
            <Text style={styles.ayuda}>Solo para saludarte. Puedes dejarlo en blanco.</Text>
            <TextInput
              style={styles.input}
              value={ficha.nombre ?? ''}
              onChangeText={(t) => cambiar({ nombre: t })}
              placeholder="Tu nombre"
              placeholderTextColor={colors.muted}
              maxLength={60}
              autoFocus
            />
          </>
        )}

        {paso === 2 && (
          <>
            <Text style={styles.h1}>Tus datos</Text>
            <Text style={styles.ayuda}>Con esto calculamos cuánta energía gastas por día.</Text>

            <Fila
              etiqueta="Sexo"
              valor={etiquetaDe(OPCIONES_SEXO, ficha.sexo)}
              onPress={() => setHoja('sexo')}
            />

            <CampoFecha valor={ficha.fecha_nacimiento} onCambio={(iso) => cambiar({ fecha_nacimiento: iso })}>
              <Fila etiqueta="Fecha de nacimiento" valor={fechaLegible(ficha.fecha_nacimiento)} />
            </CampoFecha>

            <FilaNumero
              etiqueta="Altura"
              unidad="cm"
              valor={ficha.altura_cm}
              onCambio={(n) => cambiar({ altura_cm: n })}
            />
            <FilaNumero
              etiqueta="Peso"
              unidad="kg"
              valor={ficha.peso_kg}
              decimal
              onCambio={(n) => cambiar({ peso_kg: n })}
            />
          </>
        )}

        {paso === 3 && (
          <>
            <Text style={styles.h1}>¿Cuánto te mueves?</Text>
            <Text style={styles.ayuda}>Elige lo que más se parezca a tu semana normal.</Text>
            {OPCIONES_ACTIVIDAD.map((o) => (
              <Tarjeta
                key={o.valor}
                label={o.label}
                detalle={o.detalle}
                activa={ficha.actividad === o.valor}
                onPress={() => cambiar({ actividad: o.valor })}
              />
            ))}
          </>
        )}

        {paso === 4 && (
          <>
            <Text style={styles.h1}>¿Qué buscas?</Text>
            <Text style={styles.ayuda}>Esto ajusta cuántas calorías te proponemos.</Text>
            {OPCIONES_OBJETIVO.map((o) => (
              <Tarjeta
                key={o.valor}
                label={o.label}
                detalle={o.detalle}
                activa={ficha.objetivo === o.valor}
                onPress={() => cambiar({ objetivo: o.valor })}
              />
            ))}
          </>
        )}

        {paso === ULTIMO_PASO + 1 && (
          <>
            <Text style={styles.h1}>Tus metas</Text>
            {previa.isLoading && <ActivityIndicator color={colors.primary} />}
            {previa.data?.metas ? (
              <MetasResumen
                metas={previa.data.metas}
                mantenimiento={previa.data.mantenimiento}
                sonManuales={false}
              />
            ) : (
              !previa.isLoading && (
                <Text style={styles.ayuda}>
                  Faltan datos para calcular tus metas. Puedes guardar igual y completarlos
                  después: la app sigue funcionando con una meta genérica.
                </Text>
              )
            )}
          </>
        )}
      </ScrollView>

      <View style={styles.pie}>
        <Pressable
          style={[styles.boton, guardar.isPending && styles.botonInactivo]}
          disabled={guardar.isPending}
          accessibilityRole="button"
          onPress={() => {
            if (paso <= ULTIMO_PASO) {
              setPaso(paso + 1);
              return;
            }
            guardar.mutate(ficha, { onSuccess: () => router.replace('/perfil') });
          }}
        >
          <Text style={styles.botonTexto}>
            {guardar.isPending ? 'Guardando…' : paso <= ULTIMO_PASO ? 'Continuar' : 'Guardar'}
          </Text>
        </Pressable>
        {guardar.isError && (
          <Text style={styles.error}>{(guardar.error as Error).message}</Text>
        )}
      </View>

      <HojaOpciones
        visible={hoja === 'sexo'}
        titulo="Sexo"
        opciones={OPCIONES_SEXO}
        valor={ficha.sexo}
        onElegir={(v) => cambiar({ sexo: v })}
        onCerrar={() => setHoja(null)}
      />
    </SafeAreaView>
  );
}

function Fila({
  etiqueta,
  valor,
  onPress,
}: {
  etiqueta: string;
  valor: string | null;
  onPress?: () => void;
}) {
  return (
    <Pressable style={styles.fila} onPress={onPress} disabled={!onPress}>
      <Text style={styles.filaEtiqueta}>{etiqueta}</Text>
      <Text style={[styles.filaValor, !valor && styles.filaVacio]}>{valor ?? 'Sin definir'}</Text>
    </Pressable>
  );
}

function FilaNumero({
  etiqueta,
  unidad,
  valor,
  decimal,
  onCambio,
}: {
  etiqueta: string;
  unidad: string;
  valor: number | null;
  decimal?: boolean;
  onCambio: (valor: number | null) => void;
}) {
  return (
    <View style={styles.fila}>
      <Text style={styles.filaEtiqueta}>{etiqueta}</Text>
      <View style={styles.filaEntrada}>
        <TextInput
          style={styles.numero}
          value={valor === null ? '' : String(valor)}
          onChangeText={(t) => {
            const limpio = t.replace(',', '.');
            const n = decimal ? parseFloat(limpio) : parseInt(limpio, 10);
            onCambio(Number.isFinite(n) ? n : null);
          }}
          keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
          placeholder="—"
          placeholderTextColor={colors.muted}
          maxLength={5}
        />
        <Text style={styles.unidad}>{unidad}</Text>
      </View>
    </View>
  );
}

function Tarjeta({
  label,
  detalle,
  activa,
  onPress,
}: {
  label: string;
  detalle: string;
  activa: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.tarjeta, activa && styles.tarjetaActiva]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: activa }}
    >
      <Text style={[styles.tarjetaLabel, activa && styles.tarjetaLabelActiva]}>{label}</Text>
      <Text style={styles.tarjetaDetalle}>{detalle}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  barra: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  volver: { color: colors.primary, fontFamily: fonts.medium, fontSize: fontSize.base },
  omitir: { color: colors.muted, fontFamily: fonts.medium, fontSize: fontSize.base },
  cuerpo: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
  progreso: {
    color: colors.muted,
    fontFamily: fonts.medium,
    fontSize: fontSize.sm,
    marginBottom: spacing.sm,
  },
  h1: { color: colors.ink, fontFamily: fonts.bold, fontSize: fontSize.xl, marginBottom: spacing.sm },
  ayuda: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: fontSize.base,
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: spacing.lg,
    minHeight: 48,
    color: colors.ink,
    fontFamily: fonts.regular,
    fontSize: fontSize.base,
  },
  fila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    minHeight: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  filaEtiqueta: { color: colors.muted, fontFamily: fonts.regular, fontSize: fontSize.base },
  filaValor: { color: colors.ink, fontFamily: fonts.medium, fontSize: fontSize.base },
  filaVacio: { color: colors.muted },
  filaEntrada: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  numero: {
    color: colors.ink,
    fontFamily: fonts.medium,
    fontSize: fontSize.base,
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
    minWidth: 60,
    paddingVertical: spacing.sm,
  },
  unidad: { color: colors.muted, fontFamily: fonts.regular, fontSize: fontSize.base },
  tarjeta: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    padding: spacing.lg,
    marginBottom: spacing.md,
    gap: 2,
  },
  tarjetaActiva: { borderColor: colors.primary, backgroundColor: colors.surface2 },
  tarjetaLabel: { color: colors.ink, fontFamily: fonts.medium, fontSize: fontSize.base },
  tarjetaLabelActiva: { fontFamily: fonts.semibold },
  tarjetaDetalle: { color: colors.muted, fontFamily: fonts.regular, fontSize: fontSize.sm },
  pie: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  boton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botonInactivo: { opacity: 0.6 },
  botonTexto: { color: colors.ink, fontFamily: fonts.semibold, fontSize: fontSize.base },
  error: {
    color: colors.danger,
    fontFamily: fonts.regular,
    fontSize: fontSize.sm,
    marginTop: spacing.sm,
  },
});
