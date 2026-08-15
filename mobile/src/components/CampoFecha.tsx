import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
// Ruta confirmada contra node_modules/@expo/ui/package.json: el paquete
// exporta "./community/datetime-picker" (no "./drop-in-replacements").
import DateTimePicker from '@expo/ui/community/datetime-picker';
import { colors, fonts, fontSize, spacing } from '@/theme/tokens';

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

  // El input HTML nativo del navegador no tiene la trampa de UTC del picker
  // de @expo/ui (entrega YYYY-MM-DD directo, sin instante de por medio), así
  // que acá no hace falta aISO ni el manejo de UTC del resto del archivo.
  if (Platform.OS === 'web') {
    const pad = (n: number) => String(n).padStart(2, '0');
    const minimo = `${hoy.getFullYear() - 100}-${pad(hoy.getMonth() + 1)}-${pad(hoy.getDate())}`;
    const maximo = `${hoy.getFullYear() - 14}-${pad(hoy.getMonth() + 1)}-${pad(hoy.getDate())}`;
    // `children` es la fila con la etiqueta y el valor ya elegido (p. ej.
    // "Fecha de nacimiento" / "9 de febrero de 2000"): la rama web la
    // ignoraba entero, así que el campo aparecía sin etiqueta. Va arriba,
    // de solo lectura, y el input real del navegador debajo con los tokens
    // del tema para que no desentone con el resto de la pantalla.
    return (
      <View>
        {children}
        <input
          type="date"
          value={valor ?? ''}
          min={minimo}
          max={maximo}
          onChange={(e) => e.target.value && onCambio(e.target.value)}
          style={estiloInputWeb}
        />
      </View>
    );
  }

  // Los mismos limites que valida el backend (14 a 100 anios): si el selector
  // no los pusiera, el usuario elegiria una fecha y recien ahi veria el 422.
  const minima = new Date(hoy.getFullYear() - 100, hoy.getMonth(), hoy.getDate());
  const maxima = new Date(hoy.getFullYear() - 14, hoy.getMonth(), hoy.getDate());

  // En UTC, igual que aISO: el picker trabaja en UTC en las dos direcciones y
  // mezclar los dos marcos es lo que corría el día.
  const inicial = valor
    ? new Date(`${valor}T00:00:00Z`)
    : new Date(Date.UTC(hoy.getFullYear() - 25, 0, 1));

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

// Los campos van en UTC, no en local. El DatePicker de Material 3 entrega el
// día elegido como milisegundos UTC a medianoche
// (jetpack-compose/DatePicker: `props.onDateSelected?.(new Date(date))`), así
// que en cualquier zona al oeste de Greenwich la hora local de ese instante es
// la tarde del día ANTERIOR. Leerlo con getDate() devolvía el día menos uno:
// en Chile, elegir el 9 de febrero guardaba el 8, y encontrarlo costó una
// sesión entera porque el asistente no lo mostraba (ahí onCambio solo escribe
// estado local y el usuario no vuelve a mirar la fecha que acaba de poner).
//
// toISOString() serviría igual, pero cortar el string escondería que el dato
// ya viene en UTC, que es justo lo que confundió antes.
function aISO(fecha: Date): string {
  const mes = String(fecha.getUTCMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getUTCDate()).padStart(2, '0');
  return `${fecha.getUTCFullYear()}-${mes}-${dia}`;
}

// `<input>` es un elemento DOM, no un componente de React Native: su `style`
// toma CSS plano (camelCase), no un StyleSheet de RN.
const estiloInputWeb: React.CSSProperties = {
  width: '100%',
  minHeight: 48,
  marginTop: spacing.xs,
  padding: `0 ${spacing.md}px`,
  borderRadius: 10,
  border: `1px solid ${colors.line}`,
  backgroundColor: colors.surface,
  color: colors.ink,
  fontFamily: fonts.regular,
  fontSize: fontSize.base,
  boxSizing: 'border-box',
};
