import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { HojaOpciones } from '@/components/HojaOpciones';
import { CampoFecha } from '@/components/CampoFecha';
import { MetasResumen } from '@/components/MetasResumen';
import { Fila, FilaNumero } from '@/components/CamposPerfil';
import { useGuardarPerfil, usePerfil } from '@/hooks/usePerfil';
import { useBackNativo, volverOA } from '@/lib/navegacion';
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
  type Perfil as PerfilGuardado,
} from '@/lib/perfil';
import { colors, spacing, fonts, fontSize } from '@/theme/tokens';

export default function Perfil() {
  const router = useRouter();
  const cliente = useQueryClient();
  const { data: perfil, isLoading, isError } = usePerfil();
  const guardar = useGuardarPerfil();
  const [hoja, setHoja] = useState<'sexo' | 'actividad' | 'objetivo' | null>(null);

  // El back nativo de Android (botón físico o gesto de borde) tiene que
  // hacer lo mismo que el botón "‹ Atrás" en pantalla: sin esto, llegar
  // acá sin historial (p. ej. desde el asistente obligatorio) dejaba que
  // Android cerrara la app entera en vez de navegar dentro de ella.
  useBackNativo(() => volverOA(router, '/'));

  // Cada campo guarda al confirmarse. El PUT converge y describe el estado
  // final, así que se manda la ficha completa con el cambio aplicado; no hay
  // "guardar parcial". La respuesta siembra ['perfil'], así que las metas de
  // arriba se actualizan solas.
  //
  // Dos detalles que costaron un bug cada uno:
  //
  // 1. La base del cuerpo se lee de la caché EN EL MOMENTO de mutar, no del
  //    `perfil` que capturó este render. Con la foto del render, elegir un
  //    objetivo justo después de escribir el peso mandaba el peso viejo.
  // 2. Los guardados se encadenan: hasta que no responde uno no sale el
  //    siguiente. Dos PUT en vuelo se pisaban y el último en llegar revertía
  //    el cambio del otro.
  //
  // Y como siempre: NO se copia el perfil del servidor a un estado local. En
  // la Fase 5b ese patrón causó un bug real — el efecto que hidrataba el
  // editor volvía a correr con cada refetch y pisaba lo que el usuario estaba
  // escribiendo. Acá la única fuente de verdad es la consulta.
  const cola = useRef<Promise<void>>(Promise.resolve());

  // "Tus datos" guarda solo, sin botón. Sin una señal, cambiar un dato es
  // indistinguible de no haber hecho nada: Matías lo pidió probándolo. La
  // confirmación se apaga sola porque un "Guardado" permanente deja de leerse
  // y ya no distingue el guardado de recién del de hace cinco minutos.
  const [confirmado, setConfirmado] = useState(false);
  const relojConfirmacion = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (relojConfirmacion.current) clearTimeout(relojConfirmacion.current);
    };
  }, []);

  function confirmar() {
    setConfirmado(true);
    if (relojConfirmacion.current) clearTimeout(relojConfirmacion.current);
    relojConfirmacion.current = setTimeout(() => setConfirmado(false), 2000);
  }

  function guardarCambio(cambios: Partial<FichaBorrador>, alGuardar?: () => void) {
    cola.current = cola.current
      .then(async () => {
        const actual = cliente.getQueryData<PerfilGuardado>(['perfil']);
        if (!actual) return;
        await guardar.mutateAsync({ ...borradorDesde(actual), ...cambios });
        confirmar();
        alGuardar?.();
      })
      .catch(() => {
        // El mensaje ya se muestra con guardar.isError. Acá solo hay que dejar
        // la cola sana para que un fallo no bloquee los guardados siguientes.
      });
  }

  // Altura y peso guardan al terminar de editar (al perder el foco), no con
  // cada tecla: mandar cada tecla pedía cuatro veces al escribir "78.5" y,
  // peor, mandaba valores a medio escribir —"18" camino a "180"— que el
  // backend rechaza con un 422 en pantalla mientras el usuario todavía teclea.
  //
  // Tocar «‹ Atrás» no le quita el foco al campo, así que lo último escrito se
  // anota acá y se manda si la pantalla se cierra antes de confirmarlo: sin
  // esto el cambio desaparecía sin ninguna señal.
  const sinConfirmar = useRef<Partial<FichaBorrador>>({});
  useEffect(() => {
    return () => {
      if (Object.keys(sinConfirmar.current).length > 0) guardarCambio(sinConfirmar.current);
    };
    // Solo al desmontar: guardarCambio no depende de este render, lee el
    // perfil de la caché.
  }, []);

  const [editando, setEditando] = useState(false);
  const [manuales, setManuales] = useState<Partial<Metas>>({});

  // Mayores que cero, no "distintas de null": el backend rechaza un cero con
  // 422 y `0 != null` es true, así que el botón se habilitaba con metas que
  // no podían guardarse.
  const completas =
    (manuales.calorias ?? 0) > 0 &&
    (manuales.prot_g ?? 0) > 0 &&
    (manuales.carb_g ?? 0) > 0 &&
    (manuales.fat_g ?? 0) > 0;

  function abrirEditor() {
    // Se siembra con lo que ya se muestra: nadie quiere escribir cuatro
    // números desde cero para cambiar uno.
    setManuales(perfil?.metas ?? {});
    setEditando(true);
  }

  function guardarManuales() {
    // El backend rechaza un envío parcial con 422 ("las cuatro juntas o
    // ninguna") y también un cero ("mayores que cero"). `completas` exige las
    // dos cosas, así que el botón solo se habilita con algo que el backend
    // acepta.
    if (!completas) return;
    // El editor se cierra recién cuando el guardado responde bien. Cerrarlo
    // apenas se dispara la mutación perdía los cuatro números escritos si el
    // PUT fallaba, y dejaba el error fuera de la vista.
    guardarCambio({ metas_manuales: manuales as Metas }, () => setEditando(false));
  }

  function volverAlCalculo() {
    guardarCambio({ metas_manuales: null });
    setEditando(false);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.barra}>
        <Pressable
          style={styles.barraBoton}
          hitSlop={{ left: 12, right: 12 }}
          onPress={() => volverOA(router, '/')}
          accessibilityRole="button"
          accessibilityLabel="Volver"
        >
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
              <Pressable style={styles.accionEnLinea} onPress={volverAlCalculo} accessibilityRole="button">
                <Text style={styles.avisoAccion}>Volver a calcular</Text>
              </Pressable>
            </View>
          )}

          {!editando ? (
            <Pressable style={styles.accionSuelta} onPress={abrirEditor} accessibilityRole="button">
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
                <Pressable
                  style={styles.accionEnLinea}
                  onPress={() => setEditando(false)}
                  accessibilityRole="button"
                >
                  <Text style={styles.enlaceApagado}>Cancelar</Text>
                </Pressable>
                <Pressable
                  style={styles.accionEnLinea}
                  onPress={guardarManuales}
                  disabled={!completas || guardar.isPending}
                  accessibilityRole="button"
                >
                  <Text
                    style={[
                      styles.enlace,
                      (!completas || guardar.isPending) && styles.enlaceInactivo,
                    ]}
                  >
                    {guardar.isPending ? 'Guardando…' : 'Guardar metas'}
                  </Text>
                </Pressable>
              </View>

              {!completas && (
                <Text style={styles.ayudaChica}>
                  Las cuatro metas van juntas y tienen que ser mayores que cero.
                </Text>
              )}

              {/* Dentro del editor: si el guardado falla, el editor sigue
                  abierto con los números escritos y el error tiene que verse
                  junto a ellos, no al final del ScrollView. */}
              {guardar.isError && (
                <Text style={styles.errorLinea}>{(guardar.error as Error).message}</Text>
              )}
            </View>
          )}

          <View style={[styles.seccionFila, styles.seccionSiguiente]}>
            <Text style={[styles.seccion, styles.seccionEnFila]}>Tus datos</Text>
            {(guardar.isPending || confirmado) && (
              <Text style={styles.estadoGuardado} accessibilityLiveRegion="polite">
                {guardar.isPending ? 'Guardando…' : 'Guardado'}
              </Text>
            )}
          </View>

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
          {/* El campo muestra su propio texto: acá solo va el valor guardado,
              que es lo que siembra el campo al montarse. Nada de mezclarlo con
              un "pendiente" — `pendiente ?? perfil.altura_cm` hacía reaparecer
              el valor viejo apenas el usuario borraba el campo. */}
          <FilaNumero
            etiqueta="Altura"
            unidad="cm"
            valor={perfil.altura_cm}
            onCambio={(n) => {
              sinConfirmar.current.altura_cm = n;
            }}
            onFinEdicion={(n) => {
              delete sinConfirmar.current.altura_cm;
              if (n !== perfil.altura_cm) guardarCambio({ altura_cm: n });
            }}
          />
          <FilaNumero
            etiqueta="Peso"
            unidad="kg"
            valor={perfil.peso_kg}
            decimal
            onCambio={(n) => {
              sinConfirmar.current.peso_kg = n;
            }}
            onFinEdicion={(n) => {
              delete sinConfirmar.current.peso_kg;
              if (n !== perfil.peso_kg) guardarCambio({ peso_kg: n });
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

          {/* Con el editor de metas abierto el error se muestra adentro, al
              lado de los números que lo causaron. */}
          {guardar.isError && !editando && (
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
  // El aire de la barra lo pone el botón, que mide 48dp.
  barra: { paddingHorizontal: spacing.xl, paddingTop: spacing.xs },
  barraBoton: { minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start' },
  volver: { color: colors.primaryText, fontFamily: fonts.medium, fontSize: fontSize.base },
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
  seccionFila: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  // El margen pasa a la fila: si lo dejara acá, el texto y el estado quedarían
  // desalineados por la altura del margen.
  seccionEnFila: { marginBottom: 0 },
  estadoGuardado: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: fontSize.sm,
  },
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
    // Ámbar, como el resto del texto de error del proyecto (login.tsx,
    // (tabs)/index.tsx, RegistroComida.tsx). El rojo queda para «Cerrar
    // sesión»: acciones que pierden algo, que es lo que el token declara.
    color: colors.accent,
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
  // Los 48dp van en el Pressable, no en el Text: un minHeight en el contenedor
  // con alignItems: 'center' no estira a los hijos, que es justo por qué estas
  // acciones medían 34dp.
  accionEnLinea: { minHeight: 48, justifyContent: 'center' },
  accionSuelta: {
    minHeight: 48,
    justifyContent: 'center',
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
  },
  enlace: { color: colors.primaryText, fontFamily: fonts.medium, fontSize: fontSize.base },
  enlaceApagado: { color: colors.muted, fontFamily: fonts.medium, fontSize: fontSize.base },
  enlaceInactivo: { color: colors.muted },
  editor: { marginTop: spacing.lg },
  editorAcciones: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
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
