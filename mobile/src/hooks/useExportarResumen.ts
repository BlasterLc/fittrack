import { useState } from 'react';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { apiGet } from '@/lib/api';
import { ventanaDeUltimosDias, type ResumenExportable } from '@/hooks/useProgreso';
import { armarHtmlResumen, nombreArchivo } from '@/lib/resumenExportable';

/**
 * Genera el PDF del resumen y abre el selector nativo de compartir.
 *
 * Imperativo (no `useQuery`): es una acción bajo demanda, no un dato que se
 * cachee o se refresque solo.
 */
export function useExportarResumen() {
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function exportar(dias: 7 | 30) {
    setGenerando(true);
    setError(null);
    try {
      const { desde, hasta } = ventanaDeUltimosDias(dias);
      const resumen = await apiGet<ResumenExportable>(
        `/api/progress/export?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`,
      );

      const html = armarHtmlResumen(resumen);
      const { uri } = await Print.printToFileAsync({ html });

      // `printToFileAsync` genera un nombre de archivo temporal aleatorio.
      // Se mueve a un nombre legible antes de compartir.
      const destino = `${FileSystem.cacheDirectory}${nombreArchivo(resumen)}`;
      await FileSystem.moveAsync({ from: uri, to: destino });

      await Sharing.shareAsync(destino, {
        mimeType: 'application/pdf',
        dialogTitle: 'Compartir resumen',
      });
    } catch (e) {
      console.warn('No se pudo exportar el resumen', e);
      setError('No pudimos generar el resumen. Intenta de nuevo.');
    } finally {
      setGenerando(false);
    }
  }

  return { exportar, generando, error };
}
