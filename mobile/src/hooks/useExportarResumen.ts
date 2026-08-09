import { useState } from 'react';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { apiGet } from '@/lib/api';
import { ventanaDeUltimosDias, type ResumenExportable } from '@/hooks/useProgreso';
import { armarHtmlResumen, nombreArchivo } from '@/lib/resumenExportable';

/**
 * Genera el PDF del resumen, lo abre en el visor de PDF del teléfono para
 * previsualizarlo, y deja `archivoListo` para compartirlo después con
 * `compartir()`.
 *
 * Imperativo (no `useQuery`): es una acción bajo demanda, no un dato que se
 * cachee o se refresque solo.
 */
export function useExportarResumen() {
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [archivoListo, setArchivoListo] = useState<string | null>(null);

  async function exportar(dias: 7 | 30) {
    setGenerando(true);
    setError(null);
    setArchivoListo(null);
    try {
      const { desde, hasta } = ventanaDeUltimosDias(dias);
      const resumen = await apiGet<ResumenExportable>(
        `/api/progress/export?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`,
      );

      const html = armarHtmlResumen(resumen);
      const { base64 } = await Print.printToFileAsync({ html, base64: true });

      // `printToFileAsync` escribe en el cache propio de `expo-print`, fuera
      // del sandbox de permisos de esta experience en Expo Go — ni
      // `moveAsync` ni `copyAsync` pueden tocar ese archivo desde
      // `expo-file-system`. Se pide el PDF en base64 y se escribe directo en
      // nuestro propio `cacheDirectory`, que sí está dentro del sandbox.
      const destino = `${FileSystem.cacheDirectory}${nombreArchivo(resumen)}`;
      await FileSystem.writeAsStringAsync(destino, base64!, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const contentUri = await FileSystem.getContentUriAsync(destino);
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        flags: 1,
        type: 'application/pdf',
      });
      setArchivoListo(destino);
    } catch (e) {
      console.warn('No se pudo exportar el resumen', e);
      setError('No pudimos generar el resumen. Intenta de nuevo.');
    } finally {
      setGenerando(false);
    }
  }

  async function compartir() {
    if (!archivoListo) return;
    try {
      await Sharing.shareAsync(archivoListo, {
        mimeType: 'application/pdf',
        dialogTitle: 'Compartir resumen',
      });
    } catch (e) {
      console.warn('No se pudo compartir el resumen', e);
      setError('No pudimos compartir el resumen. Intenta de nuevo.');
    }
  }

  return { exportar, compartir, generando, error, archivoListo };
}
