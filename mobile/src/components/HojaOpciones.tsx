import { useEffect } from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { colors, spacing, fonts, fontSize } from '@/theme/tokens';

// Arrastrar más que esto, o soltar con impulso hacia abajo, cierra la hoja.
// 80dp es corto a propósito: la hoja mide poco (dos a cinco opciones) y un
// umbral proporcional al alto la volvería casi imposible de cerrar arrastrando.
const UMBRAL_CIERRE = 80;
const VELOCIDAD_CIERRE = 800;

// Una sola hoja para sexo, actividad y objetivo. Genérica en el valor para
// que cada pantalla no declare su propia versión y terminen divergiendo.
//
// No tiene botón de confirmar: tocar una opción elige Y cierra. El «Listo» que
// había antes era un control muerto —nadie lo apretaba— y encima mentía,
// porque prometía un paso de confirmación que no existe. En su lugar va el
// tirador de Material 3, que sí se arrastra.
export function HojaOpciones<T extends string>({
  visible,
  titulo,
  opciones,
  valor,
  onElegir,
  onCerrar,
}: {
  visible: boolean;
  titulo: string;
  opciones: { valor: T; label: string; detalle?: string }[];
  valor: T | null;
  onElegir: (valor: T) => void;
  onCerrar: () => void;
}) {
  const desplazamiento = useSharedValue(0);

  // Al abrir vuelve a cero. Si la hoja se cerró arrastrada, el valor quedó en
  // el desplazamiento final y la próxima vez abriría corrida hacia abajo.
  useEffect(() => {
    if (visible) desplazamiento.value = 0;
  }, [visible, desplazamiento]);

  const arrastre = Gesture.Pan()
    // Solo hacia abajo: tirar hacia arriba despegaría la hoja del borde.
    .onUpdate((e) => {
      desplazamiento.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > UMBRAL_CIERRE || e.velocityY > VELOCIDAD_CIERRE) {
        // No hay animación de salida propia: al bajar `visible` el Modal
        // corre su `slide`, que arranca desde donde quedó el arrastre.
        runOnJS(onCerrar)();
        return;
      }
      // withSpring respeta «reducir movimiento» del sistema por defecto
      // (ReduceMotion.System), así que no hay que hacer nada extra.
      desplazamiento.value = withSpring(0, { damping: 20, stiffness: 200 });
    });

  const estiloHoja = useAnimatedStyle(() => ({
    transform: [{ translateY: desplazamiento.value }],
  }));

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCerrar}>
      {/* Un Modal de React Native vive en su propia ventana nativa, y el
          GestureHandlerRootView de _layout.tsx no la cubre: sin este de acá
          el arrastre no recibe ningún evento. */}
      <GestureHandlerRootView style={styles.raiz}>
        <View style={styles.fondo}>
          {/* Con el «Listo» afuera, este es el único control de cierre que
              TalkBack puede enfocar, así que va etiquetado. */}
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onCerrar}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
          />
          <Animated.View style={[styles.hoja, estiloHoja]}>
            <GestureDetector gesture={arrastre}>
              {/* La zona de arrastre es el tirador MÁS la cabecera: el tirador
                  solo mide 4dp de alto y apuntarle es imposible. */}
              <View>
                <View style={styles.tiradorZona}>
                  <View style={styles.tirador} />
                </View>
                <View style={styles.cabecera}>
                  <Text style={styles.titulo}>{titulo}</Text>
                </View>
              </View>
            </GestureDetector>

            {opciones.map((o) => {
              const activa = o.valor === valor;
              return (
                <Pressable
                  key={o.valor}
                  style={({ pressed }) => [
                    styles.opcion,
                    activa && styles.opcionActiva,
                    pressed && styles.opcionPresionada,
                  ]}
                  onPress={() => {
                    onElegir(o.valor);
                    onCerrar();
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: activa }}
                >
                  <View style={styles.opcionTextos}>
                    <Text style={[styles.opcionLabel, activa && styles.opcionLabelActiva]}>
                      {o.label}
                    </Text>
                    {o.detalle && <Text style={styles.opcionDetalle}>{o.detalle}</Text>}
                  </View>
                  {activa && <Text style={styles.tilde}>✓</Text>}
                </Pressable>
              );
            })}
          </Animated.View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1 },
  fondo: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  hoja: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: spacing.xxl,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  // 32×4dp es la medida de Material 3. En `muted` para que se vea: `line` da
  // 1,3:1 contra la hoja y un control de interfaz necesita 3:1.
  tiradorZona: { alignItems: 'center', paddingTop: spacing.md, paddingBottom: spacing.sm },
  tirador: { width: 32, height: 4, borderRadius: 2, backgroundColor: colors.muted },
  cabecera: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  titulo: { color: colors.ink, fontFamily: fonts.semibold, fontSize: fontSize.lg },
  opcion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    // 48dp de alto mínimo por el táctil de Android, con aire para el detalle.
    paddingVertical: spacing.lg,
    minHeight: 48,
  },
  opcionActiva: { backgroundColor: colors.surface2 },
  opcionPresionada: { opacity: 0.7 },
  opcionTextos: { flex: 1, gap: 2 },
  opcionLabel: { color: colors.ink, fontFamily: fonts.medium, fontSize: fontSize.base },
  opcionLabelActiva: { fontFamily: fonts.semibold },
  opcionDetalle: { color: colors.muted, fontFamily: fonts.regular, fontSize: fontSize.sm },
  tilde: { color: colors.primaryText, fontFamily: fonts.semibold, fontSize: fontSize.lg },
});
