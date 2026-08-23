import { Alert, Platform } from 'react-native';

type BotonAlerta = {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

// Alert.alert es un no-op en react-native-web (react-native-web/dist/exports/Alert
// es literalmente "class Alert { static alert() {} }"): en web no muestra nada y
// ningún onPress se ejecuta nunca. Aquí se resuelve con confirm()/alert() del
// navegador, con el mismo contrato que Alert.alert, para no tener que cambiar la
// forma en que ya se llama en el resto de la app — solo el import.
//
// Ojo: en web solo hay dos respuestas posibles (aceptar o cancelar), así que
// este wrapper NO sirve para diálogos de tres botones. Si alguna vez hace falta
// uno, va con un modal propio, no por aquí.
export function alerta(titulo: string, mensaje?: string, botones?: BotonAlerta[]): void {
  if (Platform.OS !== 'web') {
    Alert.alert(titulo, mensaje, botones);
    return;
  }

  const texto = mensaje ? `${titulo}\n\n${mensaje}` : titulo;

  if (!botones || botones.length <= 1) {
    window.alert(texto);
    botones?.[0]?.onPress?.();
    return;
  }

  const cancelar = botones.find((b) => b.style === 'cancel');
  const confirmar = botones.find((b) => b !== cancelar) ?? botones[botones.length - 1];

  if (window.confirm(texto)) {
    confirmar.onPress?.();
  } else {
    cancelar?.onPress?.();
  }
}
