import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { HojaOpciones } from '@/components/HojaOpciones';
import { CampoFecha } from '@/components/CampoFecha';
import { MetasResumen } from '@/components/MetasResumen';
import { Fila, FilaNumero, Tarjeta } from '@/components/CamposPerfil';
import { useGuardarPerfil, usePerfil, usePrevisualizacion } from '@/hooks/usePerfil';
import {
  OPCIONES_ACTIVIDAD,
  OPCIONES_OBJETIVO,
  OPCIONES_SEXO,
  borradorDesde,
  etiquetaDe,
  fechaLegible,
  type FichaBorrador,
} from '@/lib/perfil';
import { colors, spacing, fonts, fontSize } from '@/theme/tokens';

const ULTIMO_PASO = 4;

/**
 * El asistente parte SIEMPRE de la ficha que ya está guardada.
 *
 * El PUT converge: un campo en null borra el valor guardado. Si el asistente
 * arrancara vacío, cualquier "Guardar" —incluido el de quien entra a cambiar
 * solo el nombre y omite el resto— mandaría sexo, fecha, altura, peso,
 * actividad, objetivo y metas escritas a mano en null, y borraría la ficha
 * entera sin manera de deshacerlo. Sembrando desde el perfil, un dato que el
 * usuario no toca viaja con el valor que ya tenía.
 *
 * Por eso los pasos no se dibujan hasta tener el perfil: sembrar con datos a
 * medio cargar es el mismo borrado con otro disfraz. Si el perfil no se puede
 * cargar, no se entra: se ofrece reintentar.
 */
export default function Asistente() {
  const router = useRouter();
  const { data: perfil, isError, refetch } = usePerfil();

  if (perfil) return <AsistentePasos inicial={borradorDesde(perfil)} />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.barra}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Atrás">
          <Text style={styles.volver}>‹ Atrás</Text>
        </Pressable>
      </View>
      <View style={styles.estado}>
        {isError ? (
          <>
            <Text style={styles.aviso}>
              No pudimos cargar tu ficha. Revisa tu conexión: sin ella no podemos completarla sin
              arriesgar lo que ya tienes guardado.
            </Text>
            <Pressable
              style={styles.botonSecundario}
              onPress={() => refetch()}
              accessibilityRole="button"
            >
              <Text style={styles.botonSecundarioTexto}>Reintentar</Text>
            </Pressable>
          </>
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
      </View>
    </SafeAreaView>
  );
}

function AsistentePasos({ inicial }: { inicial: FichaBorrador }) {
  const router = useRouter();
  const [paso, setPaso] = useState(1);
  // Una sola vez, al montar. Nada de hidratar por efecto: ese efecto vuelve a
  // correr con cada refetch de ['perfil'] —y toda mutación invalida— y pisaría
  // lo que el usuario está escribiendo.
  const [ficha, setFicha] = useState<FichaBorrador>(inicial);
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
            {/* Los tres estados son excluyentes. Antes faltaba el de error y
                una caída de red se leía como "faltan datos", que es mentira:
                los datos estaban completos y no había forma de reintentar. */}
            {previa.isFetching ? (
              <ActivityIndicator color={colors.primary} />
            ) : previa.isError ? (
              <>
                {/* Sin decir por qué falló: puede ser la red o un dato fuera
                    de rango. El motivo lo dice el backend en su `detail` y va
                    tal cual, como en el resto de la app. */}
                <Text style={styles.aviso}>No pudimos calcular tus metas ahora.</Text>
                <Text style={styles.avisoDetalle}>{(previa.error as Error).message}</Text>
                <Text style={styles.avisoDetalle}>
                  Puedes guardar igual: tus datos no se pierden y las metas se calculan solas
                  cuando esto vuelva a funcionar.
                </Text>
                <Pressable
                  style={styles.botonSecundario}
                  onPress={() => previa.refetch()}
                  accessibilityRole="button"
                >
                  <Text style={styles.botonSecundarioTexto}>Reintentar</Text>
                </Pressable>
              </>
            ) : previa.data?.metas ? (
              <MetasResumen
                metas={previa.data.metas}
                mantenimiento={previa.data.mantenimiento}
                sonManuales={false}
              />
            ) : (
              <Text style={styles.ayuda}>
                Faltan datos para calcular tus metas. Puedes guardar igual y completarlos después:
                la app sigue funcionando con una meta genérica.
              </Text>
            )}

            {/* Ahora que el asistente conserva las metas escritas a mano en vez
                de borrarlas, hay que decir que son ellas las que se van a
                seguir viendo: esta pantalla muestra el cálculo, no lo que
                quedará en el perfil. */}
            {ficha.metas_manuales && (
              <Text style={styles.nota}>
                Esto es lo que dicen tus datos. Seguirás viendo las metas que escribiste a mano
                hasta que vuelvas al cálculo desde tu perfil.
              </Text>
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
  estado: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl },
  // Ámbar: es la convención del proyecto para el texto de error (login.tsx,
  // (tabs)/index.tsx, RegistroComida.tsx). El rojo queda para lo que pierde
  // datos.
  aviso: {
    color: colors.accent,
    fontFamily: fonts.regular,
    fontSize: fontSize.base,
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  avisoDetalle: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: fontSize.sm,
    lineHeight: 19,
    marginBottom: spacing.sm,
  },
  botonSecundario: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    minHeight: 48,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botonSecundarioTexto: {
    color: colors.primary,
    fontFamily: fonts.medium,
    fontSize: fontSize.base,
  },
  nota: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: fontSize.sm,
    lineHeight: 19,
    marginTop: spacing.lg,
  },
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
