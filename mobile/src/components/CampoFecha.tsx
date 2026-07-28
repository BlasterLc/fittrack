import { useState } from 'react';
import { Pressable } from 'react-native';
// Ruta confirmada contra node_modules/@expo/ui/package.json: el paquete
// exporta "./community/datetime-picker" (no "./drop-in-replacements").
import DateTimePicker from '@expo/ui/community/datetime-picker';
import { colors } from '@/theme/tokens';

// El selector va aislado en su propio componente por una trampa de Android:
// con presentation="dialog" (el valor por defecto) el dialogo se abre AL
// MONTARSE, no al tocarlo. Por eso el picker solo existe en el arbol mientras
// "abierto" es true, y se desmonta en onValueChange y en onDismiss. Montarlo
// siempre abriria el dialogo apenas entra a la pantalla.
export function CampoFecha({
  valor,
  onCambio,
  children,
}: {
  valor: string | null; // ISO 'YYYY-MM-DD'
  onCambio: (iso: string) => void;
  children: React.ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);

  const hoy = new Date();
  // Los mismos limites que valida el backend (14 a 100 anios): si el selector
  // no los pusiera, el usuario elegiria una fecha y recien ahi veria el 422.
  const minima = new Date(hoy.getFullYear() - 100, hoy.getMonth(), hoy.getDate());
  const maxima = new Date(hoy.getFullYear() - 14, hoy.getMonth(), hoy.getDate());

  const inicial = valor ? new Date(`${valor}T00:00:00`) : new Date(hoy.getFullYear() - 25, 0, 1);

  return (
    <>
      <Pressable onPress={() => setAbierto(true)}>{children}</Pressable>

      {abierto && (
        <DateTimePicker
          value={inicial}
          mode="date"
          minimumDate={minima}
          maximumDate={maxima}
          accentColor={colors.primary}
          onValueChange={(_evento, fecha) => {
            setAbierto(false);
            if (fecha) onCambio(aISO(fecha));
          }}
          onDismiss={() => setAbierto(false)}
        />
      )}
    </>
  );
}

// toISOString() convierte a UTC y puede correr el dia una posicion segun la
// zona horaria. Se arma a mano con los campos locales.
function aISO(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}
