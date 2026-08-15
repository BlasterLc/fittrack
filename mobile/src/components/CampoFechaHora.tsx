import { useState } from 'react';
import { Pressable } from 'react-native';
import DateTimePicker from '@expo/ui/community/datetime-picker';
import { colors } from '@/theme/tokens';

const VENTANA_DIAS = 7;

// Mismo aislamiento que CampoFecha.tsx: con presentation="dialog" (el valor
// por defecto en Android) el diálogo se abre AL MONTARSE, no al tocarlo. El
// picker solo existe en el árbol mientras "abierto" es true.
export function CampoFechaHora({
  valor,
  onCambio,
  children,
}: {
  valor: Date;
  onCambio: (fecha: Date) => void;
  children: React.ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);

  const ahora = new Date();
  const minima = new Date(ahora.getTime() - VENTANA_DIAS * 24 * 60 * 60 * 1000);

  return (
    <>
      <Pressable onPress={() => setAbierto(true)}>{children}</Pressable>

      {abierto && (
        <DateTimePicker
          value={valor}
          mode="datetime"
          minimumDate={minima}
          maximumDate={ahora}
          accentColor={colors.primary}
          onValueChange={(_evento, fecha) => {
            setAbierto(false);
            if (fecha) onCambio(fecha);
          }}
          onDismiss={() => setAbierto(false)}
        />
      )}
    </>
  );
}
