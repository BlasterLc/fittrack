import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { HojaOpciones } from '@/components/HojaOpciones';
import { CampoFecha } from '@/components/CampoFecha';
import { MetasResumen } from '@/components/MetasResumen';
import { Fila, FilaNumero } from '@/components/CamposPerfil';
import { useGuardarPerfil, usePerfil } from '@/hooks/usePerfil';
import { useDebounce } from '@/hooks/useDebounce';
import { supabase } from '@/lib/supabase';
import {
  OPCIONES_ACTIVIDAD,
  OPCIONES_OBJETIVO,
  OPCIONES_SEXO,
  borradorDesde,
  etiquetaDe,
  fechaLegible,
  type FichaBorrador,
  type Metas,
} from '@/lib/perfil';
import { colors, spacing, fonts, fontSize } from '@/theme/tokens';

export default function Perfil() {
  const router = useRouter();
  const { data: perfil, isLoading, isError } = usePerfil();
  const guardar = useGuardarPerfil();
  const [hoja, setHoja] = useState<'sexo' | 'actividad' | 'objetivo' | null>(null);

  // Cada campo guarda al confirmarse. El PUT converge y describe el estado
  // final, así que se manda la ficha completa con el cambio aplicado; no hay
  // "guardar parcial". La respuesta siembra ['perfil'], así que las metas de
  // arriba se actualizan solas.
  //
  // Ojo: NO se copia el perfil del servidor a un estado local. En la Fase 5b
  // ese patrón causó un bug real — el efecto que hidrataba el editor volvía a
  // correr con cada refetch y pisaba lo que el usuario estaba escribiendo.
  // Acá la única fuente de verdad es la consulta.
  function guardarCambio(cambios: Partial<FichaBorrador>) {
    if (!perfil) return;
    guardar.mutate({ ...borradorDesde(perfil), ...cambios });
  }

  // Altura y peso son campos de texto: guardar con cada tecla serían cuatro
  // peticiones al escribir "78.5". Se guarda un valor "pendiente" local (no
  // sincronizado desde el perfil por efecto — eso sería el mismo bug de la
  // Fase 5b, ahora en la escritura) y se manda recién cuando ese valor se
  // asienta. "tocado" evita que el guardado dispare al montar el componente.
  const [alturaPendiente, setAlturaPendiente] = useState<number | null>(null);
  const alturaTocada = useRef(false);
  const alturaDebounced = useDebounce(alturaPendiente, 500);
  useEffect(() => {
    if (!alturaTocada.current) return;
    guardarCambio({ altura_cm: alturaDebounced });
  }, [alturaDebounced]);

  const [pesoPendiente, setPesoPendiente] = useState<number | null>(null);
  const pesoTocado = useRef(false);
  const pesoDebounced = useDebounce(pesoPendiente, 500);
  useEffect(() => {
    if (!pesoTocado.current) return;
    guardarCambio({ peso_kg: pesoDebounced });
  }, [pesoDebounced]);

  const [editando, setEditando] = useState(false);
  const [manuales, setManuales] = useState<Partial<Metas>>({});

  const completas =
    manuales.calorias != null &&
    manuales.prot_g != null &&
    manuales.carb_g != null &&
    manuales.fat_g != null;

  function abrirEditor() {
    // Se siembra con lo que ya se muestra: nadie quiere escribir cuatro
    // números desde cero para cambiar uno.
    setManuales(perfil?.metas ?? {});
    setEditando(true);
  }

  function guardarManuales() {
    // El backend rechaza un envío parcial con 422 ("las cuatro juntas o
    // ninguna"). El botón está deshabilitado hasta tenerlas, así que ese
    // error no se ve nunca.
    if (!completas) return;
    guardarCambio({ metas_manuales: manuales as Metas });
    setEditando(false);
  }

  function volverAlCalculo() {
    guardarCambio({ metas_manuales: null });
    setEditando(false);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.barra}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Volver">
          <Text style={styles.volver}>‹ Atrás</Text>
        </Pressable>
      </View>

      {isLoading && <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />}
      {isError && <Text style={styles.error}>No pudimos cargar tu perfil.</Text>}

      {perfil && (
        <ScrollView contentContainerStyle={styles.cuerpo}>
          <Text style={styles.h1}>Tu perfil</Text>

          <Text style={styles.seccion}>Tus metas</Text>
          {perfil.metas ? (
            <MetasResumen
              metas={perfil.metas}
              mantenimiento={perfil.mantenimiento}
              sonManuales={perfil.metas_son_manuales}
            />
          ) : (
            // Estado vacío que enseña, no "no hay nada": dice qué falta y da
            // el camino para completarlo.
            <View style={styles.vacio}>
              <Text style={styles.vacioTitulo}>Todavía no podemos calcular tus metas</Text>
              <Text style={styles.vacioTexto}>
                Necesitamos tu sexo, fecha de nacimiento, altura, peso, cuánto te mueves y qué
                buscas. Mientras tanto la app usa una meta genérica.
              </Text>
              <Pressable
                style={styles.boton}
                onPress={() => router.push('/perfil/asistente')}
                accessibilityRole="button"
              >
                <Text style={styles.botonTexto}>Completar mi ficha</Text>
              </Pressable>
            </View>
          )}

          {perfil.metas_son_manuales && (
            // Ámbar porque es exactamente lo que el token significa en este
            // proyecto: algo que necesita atención. No es decorativo.
            <View style={styles.aviso}>
              <Text style={styles.avisoTexto}>
                Estás usando metas escritas por ti. No se actualizan solas cuando cambian tus
                datos.
              </Text>
              <Pressable onPress={volverAlCalculo} hitSlop={8} accessibilityRole="button">
                <Text style={styles.avisoAccion}>Volver a calcular</Text>
              </Pressable>
            </View>
          )}

          {!editando ? (
            <Pressable onPress={abrirEditor} hitSlop={8} accessibilityRole="button">
              <Text style={styles.enlace}>Ajustar a mano</Text>
            </Pressable>
          ) : (
            <View style={styles.editor}>
              <FilaNumero
                etiqueta="Calorías"
                unidad="kcal"
                valor={manuales.calorias ?? null}
                onCambio={(n) => setManuales((m) => ({ ...m, calorias: n ?? undefined }))}
              />
              <FilaNumero
                etiqueta="Proteína"
                unidad="g"
                valor={manuales.prot_g ?? null}
                onCambio={(n) => setManuales((m) => ({ ...m, prot_g: n ?? undefined }))}
              />
              <FilaNumero
                etiqueta="Carbohidratos"
                unidad="g"
                valor={manuales.carb_g ?? null}
                onCambio={(n) => setManuales((m) => ({ ...m, carb_g: n ?? undefined }))}
              />
              <FilaNumero
                etiqueta="Grasas"
                unidad="g"
                valor={manuales.fat_g ?? null}
                onCambio={(n) => setManuales((m) => ({ ...m, fat_g: n ?? undefined }))}
              />

              <View style={styles.editorAcciones}>
                <Pressable onPress={() => setEditando(false)} hitSlop={8}>
                  <Text style={styles.enlaceApagado}>Cancelar</Text>
                </Pressable>
                <Pressable onPress={guardarManuales} disabled={!completas} hitSlop={8}>
                  <Text style={[styles.enlace, !completas && styles.enlaceInactivo]}>
                    Guardar metas
                  </Text>
                </Pressable>
              </View>

              {!completas && (
                <Text style={styles.ayudaChica}>Las cuatro metas van juntas.</Text>
              )}
            </View>
          )}

          <Text style={[styles.seccion, styles.seccionSiguiente]}>Tus datos</Text>

          <Fila
            etiqueta="Nombre"
            valor={perfil.nombre}
            onPress={() => router.push('/perfil/asistente')}
          />
          <Fila
            etiqueta="Sexo"
            valor={etiquetaDe(OPCIONES_SEXO, perfil.sexo)}
            onPress={() => setHoja('sexo')}
          />
          <CampoFecha
            valor={perfil.fecha_nacimiento}
            onCambio={(iso) => guardarCambio({ fecha_nacimiento: iso })}
          >
            <Fila etiqueta="Fecha de nacimiento" valor={fechaLegible(perfil.fecha_nacimiento)} />
          </CampoFecha>
          <FilaNumero
            etiqueta="Altura"
            unidad="cm"
            valor={alturaPendiente ?? perfil.altura_cm}
            onCambio={(n) => {
              alturaTocada.current = true;
              setAlturaPendiente(n);
            }}
          />
          <FilaNumero
            etiqueta="Peso"
            unidad="kg"
            valor={pesoPendiente ?? perfil.peso_kg}
            decimal
            onCambio={(n) => {
              pesoTocado.current = true;
              setPesoPendiente(n);
            }}
          />
          <Fila
            etiqueta="Actividad"
            valor={etiquetaDe(OPCIONES_ACTIVIDAD, perfil.actividad)}
            onPress={() => setHoja('actividad')}
          />
          <Fila
            etiqueta="Objetivo"
            valor={etiquetaDe(OPCIONES_OBJETIVO, perfil.objetivo)}
            onPress={() => setHoja('objetivo')}
          />

          {guardar.isError && (
            <Text style={styles.errorLinea}>{(guardar.error as Error).message}</Text>
          )}

          <Pressable
            style={styles.salir}
            accessibilityRole="button"
            onPress={() =>
              Alert.alert('Cerrar sesión', '¿Seguro que quieres cerrar sesión?', [
                { text: 'Cancelar', style: 'cancel' },
                {
                  text: 'Cerrar sesión',
                  style: 'destructive',
                  onPress: () => supabase.auth.signOut(),
                },
              ])
            }
          >
            <Text style={styles.salirTexto}>Cerrar sesión</Text>
          </Pressable>
        </ScrollView>
      )}

      <HojaOpciones
        visible={hoja === 'sexo'}
        titulo="Sexo"
        opciones={OPCIONES_SEXO}
        valor={perfil?.sexo ?? null}
        onElegir={(v) => guardarCambio({ sexo: v })}
        onCerrar={() => setHoja(null)}
      />
      <HojaOpciones
        visible={hoja === 'actividad'}
        titulo="¿Cuánto te mueves?"
        opciones={OPCIONES_ACTIVIDAD}
        valor={perfil?.actividad ?? null}
        onElegir={(v) => guardarCambio({ actividad: v })}
        onCerrar={() => setHoja(null)}
      />
      <HojaOpciones
        visible={hoja === 'objetivo'}
        titulo="¿Qué buscas?"
        opciones={OPCIONES_OBJETIVO}
        valor={perfil?.objetivo ?? null}
        onElegir={(v) => guardarCambio({ objetivo: v })}
        onCerrar={() => setHoja(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  barra: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.sm },
  volver: { color: colors.primary, fontFamily: fonts.medium, fontSize: fontSize.base },
  cuerpo: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
  h1: {
    color: colors.ink,
    fontFamily: fonts.bold,
    fontSize: fontSize.xxl,
    marginBottom: spacing.xl,
  },
  seccion: {
    color: colors.muted,
    fontFamily: fonts.medium,
    fontSize: fontSize.sm,
    marginBottom: spacing.md,
  },
  seccionSiguiente: { marginTop: spacing.xxl },
  vacio: { gap: spacing.md },
  vacioTitulo: { color: colors.ink, fontFamily: fonts.semibold, fontSize: fontSize.lg },
  vacioTexto: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: fontSize.base,
    lineHeight: 22,
  },
  boton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
    minHeight: 48,
    justifyContent: 'center',
  },
  botonTexto: { color: colors.ink, fontFamily: fonts.semibold, fontSize: fontSize.base },
  error: {
    color: colors.accent,
    fontFamily: fonts.regular,
    fontSize: fontSize.base,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.lg,
  },
  errorLinea: {
    color: colors.danger,
    fontFamily: fonts.regular,
    fontSize: fontSize.sm,
    marginTop: spacing.md,
  },
  aviso: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 10,
    padding: spacing.lg,
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  avisoTexto: {
    color: colors.ink,
    fontFamily: fonts.regular,
    fontSize: fontSize.sm,
    lineHeight: 19,
  },
  avisoAccion: { color: colors.accent, fontFamily: fonts.medium, fontSize: fontSize.sm },
  enlace: { color: colors.primary, fontFamily: fonts.medium, fontSize: fontSize.base, marginTop: spacing.lg },
  enlaceApagado: { color: colors.muted, fontFamily: fonts.medium, fontSize: fontSize.base },
  enlaceInactivo: { color: colors.muted },
  editor: { marginTop: spacing.lg },
  editorAcciones: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.lg,
    minHeight: 48,
  },
  ayudaChica: { color: colors.muted, fontFamily: fonts.regular, fontSize: fontSize.sm },
  salir: {
    marginTop: spacing.xxl,
    paddingVertical: spacing.lg,
    minHeight: 48,
    justifyContent: 'center',
  },
  salirTexto: { color: colors.danger, fontFamily: fonts.medium, fontSize: fontSize.base },
});
