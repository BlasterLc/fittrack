import { useState } from 'react';
import { Platform, Pressable, StyleSheet } from 'react-native';
// Import nombrado, no default: ver la nota en CampoFecha.tsx.
import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { colors } from '@/theme/tokens';

export const VENTANA_DIAS = 7;

type Paso = 'cerrado' | 'fecha' | 'hora';

// Mismo aislamiento que CampoFecha.tsx: con presentation="dialog" (el valor
// por defecto en Android) el diálogo se abre AL MONTARSE, no al tocarlo. El
// picker solo existe en el árbol mientras el paso no es "cerrado".
//
// En Android, mode="datetime" no existe como diálogo combinado: el paquete
// cae a mode="date" en silencio (@expo/ui/.../DateTimePicker.android.tsx) y
// el día elegido llega como medianoche UTC del día local — mismo
// comportamiento que ya documenta CampoFecha.tsx. Por eso acá se encadenan
// dos diálogos nativos (fecha y hora) y se arma el resultado a mano. En iOS
// el picker combinado sí funciona, así que ahí se usa directo.
export function CampoFechaHora({
  valor,
  onCambio,
  children,
}: {
  valor: Date;
  onCambio: (fecha: Date) => void;
  children: React.ReactNode;
}) {
  const [paso, setPaso] = useState<Paso>('cerrado');
  const [inicial, setInicial] = useState(valor);
  const [diaElegido, setDiaElegido] = useState<Date | null>(null);

  const ahora = new Date();
  const minima = new Date(ahora.getTime() - VENTANA_DIAS * 24 * 60 * 60 * 1000);

  function abrir() {
    // Se captura "valor" al abrir, no en cada render: si el padre
    // re-renderiza mientras el diálogo está abierto (ej. un refetch),
    // el diálogo nativo no debe reiniciar la selección en curso.
    setInicial(valor);
    setPaso('fecha');
  }

  if (Platform.OS === 'android') {
    return (
      <>
        <Pressable style={styles.toque} onPress={abrir}>
          {children}
        </Pressable>

        {paso === 'fecha' && (
          <DateTimePicker
            value={inicial}
            mode="date"
            minimumDate={minima}
            maximumDate={ahora}
            accentColor={colors.primary}
            onValueChange={(_evento, fecha) => {
              if (!fecha) {
                setPaso('cerrado');
                return;
              }
              // El día llega como medianoche UTC del día local elegido
              // (Material 3): se reconstruye con getUTC* y se le pega la
              // hora que ya traía "inicial", para pasar al paso de hora.
              setDiaElegido(
                new Date(
                  fecha.getUTCFullYear(),
                  fecha.getUTCMonth(),
                  fecha.getUTCDate(),
                  inicial.getHours(),
                  inicial.getMinutes(),
                ),
              );
              setPaso('hora');
            }}
            onDismiss={() => setPaso('cerrado')}
          />
        )}

        {paso === 'hora' && diaElegido && (
          <DateTimePicker
            value={diaElegido}
            mode="time"
            accentColor={colors.primary}
            onValueChange={(_evento, hora) => {
              setPaso('cerrado');
              if (!hora) return;
              const final = new Date(diaElegido);
              final.setHours(hora.getHours(), hora.getMinutes());
              onCambio(final);
            }}
            onDismiss={() => setPaso('cerrado')}
          />
        )}
      </>
    );
  }

  return (
    <>
      <Pressable style={styles.toque} onPress={abrir}>
        {children}
      </Pressable>

      {paso === 'fecha' && (
        <DateTimePicker
          value={inicial}
          mode="datetime"
          minimumDate={minima}
          maximumDate={ahora}
          accentColor={colors.primary}
          onValueChange={(_evento, fecha) => {
            setPaso('cerrado');
            if (fecha) onCambio(fecha);
          }}
          onDismiss={() => setPaso('cerrado')}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  toque: { minHeight: 48, justifyContent: 'center' },
});
