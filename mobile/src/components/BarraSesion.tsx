import { useCallback, useState } from 'react';
import { View, Text, Pressable, Alert, Platform, StyleSheet } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { alerta } from '@/lib/alerta';
import {
  borrarBorrador,
  escribirBorrador,
  esDeHoy,
  finDelBorrador,
  leerBorrador,
  totalSeriesHechas,
  type BorradorSesion,
} from '@/lib/sesion';
import { colors, spacing, fonts, fontSize } from '@/theme/tokens';

/**
 * La entrada al entrenamiento en curso, arriba de todo en Gym.
 *
 * Solo se dibuja si hay borrador. Lee el suyo en vez de compartir `useSesion`
 * con la pantalla de sesión: la pestaña Gym queda montada mientras se entrena,
 * así que el borrador hay que releerlo cada vez que la pestaña recupera el
 * foco, o la barra muestra el estado de hace media hora.
 */
export function BarraSesion() {
  const router = useRouter();
  const [borrador, setBorrador] = useState<BorradorSesion | null>(null);

  // `deps: []` es correcto acá porque el callback no lee nada que cambie:
  // solo relee del disco y siembra el estado. (En la pantalla de sesión el
  // mismo patrón con `[]` sería un bug, porque ahí el cierre sí lee el
  // borrador.)
  useFocusEffect(
    useCallback(() => {
      let cancelado = false;
      leerBorrador().then((b) => {
        if (!cancelado) setBorrador(b);
      });
      return () => {
        cancelado = true;
      };
    }, []),
  );

  if (!borrador) return null;

  const enCurso = borrador.terminadoEn === null;
  const deHoy = esDeHoy(borrador.iniciadoEn);
  // Se calcula al dibujar, sin cronómetro: la barra se refresca cada vez que
  // la pestaña recupera el foco, y un intervalo corriendo en una pestaña que
  // no se está mirando no compra nada.
  const minutos = Math.floor((Date.now() - new Date(borrador.iniciadoEn).getTime()) / 60_000);

  function olvidar() {
    setBorrador(null);
    void borrarBorrador();
  }

  /**
   * Un borrador de otro día no se puede seguir: las marcas de tiempo ya no
   * tienen sentido y dejarlo correr guardaría un entrenamiento de 72 horas.
   * Solo se cierra o se tira.
   */
  function resolverDeOtroDia(abierto: BorradorSesion) {
    // Las HECHAS, no las filas: un borrador arranca con sus series
    // planificadas, así que contar `series.length` ofrecería guardar un
    // entrenamiento donde no se marcó nada, y el backend lo rechaza.
    const hechas = totalSeriesHechas(abierto);

    if (hechas === 0) {
      alerta(
        'Entrenamiento sin terminar',
        'Quedó abierto un entrenamiento de otro día y no alcanzaste a completar ninguna serie, así que no hay nada que guardar.',
        [
          { text: 'Ahora no', style: 'cancel' },
          { text: 'Descartar', style: 'destructive', onPress: olvidar },
        ],
      );
      return;
    }

    const guardarLoHecho = async () => {
      // El fin es la última serie, nunca ahora. Con `terminadoEn` puesto,
      // la pantalla de sesión abre directo en el resumen.
      const cerrado = { ...abierto, terminadoEn: finDelBorrador(abierto) };
      setBorrador(cerrado);
      // Se espera la escritura antes de navegar: la pantalla de sesión
      // lee del disco al montar, y si ganara la carrera abriría el
      // borrador viejo en modo entrenar, que es justo lo que un
      // entrenamiento de otro día no puede hacer.
      await escribirBorrador(cerrado);
      router.push('/sesion');
    };

    const mensaje = `Quedó abierto un entrenamiento de otro día con ${hechas} ${hechas === 1 ? 'serie' : 'series'}. Puedes guardar lo que alcanzaste a hacer o descartarlo.`;

    // Este diálogo tiene TRES respuestas y `alerta()` solo sabe traducir dos,
    // porque en el navegador confirm() es sí/no. En vez de dejar "Descartar"
    // como la opción de "aceptar" (borraría el entrenamiento sin querer), en
    // web se resuelve directo con confirm(): aceptar guarda lo hecho —la
    // opción segura, que no pierde datos— y cancelar no hace nada. Decisión
    // de producto: en web, "Descartar" queda sin acceso desde este diálogo.
    if (Platform.OS === 'web') {
      if (window.confirm(`Entrenamiento sin terminar\n\n${mensaje}`)) {
        void guardarLoHecho();
      }
      return;
    }

    Alert.alert('Entrenamiento sin terminar', mensaje, [
      { text: 'Ahora no', style: 'cancel' },
      { text: 'Descartar', style: 'destructive', onPress: olvidar },
      { text: 'Guardar lo hecho', onPress: guardarLoHecho },
    ]);
  }

  const varado = enCurso && !deHoy;
  const texto = !enCurso
    ? 'Entrenamiento sin guardar · toca para reintentar'
    : varado
      ? 'Entrenamiento sin terminar de otro día'
      : `Entrenamiento en curso · ${minutos} min`;

  return (
    <Pressable
      style={[styles.barra, (varado || !enCurso) && styles.barraAtencion]}
      onPress={() => (varado ? resolverDeOtroDia(borrador) : router.push('/sesion'))}
      accessibilityRole="button"
      accessibilityLabel={texto}
    >
      <View style={styles.texto}>
        <Text style={styles.nombre} numberOfLines={1}>
          {borrador.nombreRutina}
        </Text>
        <Text style={[styles.estado, (varado || !enCurso) && styles.estadoAtencion]} numberOfLines={1}>
          {texto}
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  barra: {
    // Los 48dp van en el Pressable con alto real, no con hitSlop: en Android
    // un hitSlop que se sale del padre no recibe el toque.
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 10,
    backgroundColor: colors.sesionBg,
  },
  // El ámbar marca lo que necesita atención: un entrenamiento varado de otro
  // día o uno que quedó sin guardar. 6,76:1 sobre `sesionBg`.
  barraAtencion: { borderWidth: 1, borderColor: colors.accent },
  texto: { flex: 1, minWidth: 0 },
  nombre: { color: colors.sesionInk, fontFamily: fonts.semibold, fontSize: fontSize.base },
  estado: { color: colors.sesionInk, fontFamily: fonts.regular, fontSize: fontSize.sm, marginTop: 2 },
  estadoAtencion: { color: colors.accent },
  chevron: { color: colors.sesionInk, fontFamily: fonts.regular, fontSize: fontSize.lg },
});
