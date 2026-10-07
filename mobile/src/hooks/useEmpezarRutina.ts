import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { alerta } from '@/lib/alerta';
import { rutinaDetalleQuery } from '@/hooks/useRutinas';
import { escribirBorrador, leerBorrador, valorInicial } from '@/lib/sesion';

/**
 * Arma el borrador de una rutina y abre la sesión.
 *
 * Se usa desde la lista de rutinas y desde el acceso "Repetir última rutina"
 * de Inicio — mismo comportamiento en los dos lugares, un solo lugar con la
 * regla.
 */
export function useEmpezarRutina() {
  const router = useRouter();
  const cliente = useQueryClient();
  const [empezando, setEmpezando] = useState<number | null>(null);

  async function empezar(rutinaId: number) {
    if (empezando !== null) return;

    // Un borrador vivo no se pisa nunca: adentro está el entrenamiento que el
    // usuario todavía no guardó.
    const abierto = await leerBorrador();
    if (abierto) {
      alerta(
        'Ya tienes un entrenamiento abierto',
        `Termina o descarta «${abierto.nombreRutina}» antes de empezar otro.`,
        [
          { text: 'Ahora no', style: 'cancel' },
          { text: 'Ir al entrenamiento', onPress: () => router.push('/sesion') },
        ],
      );
      return;
    }

    setEmpezando(rutinaId);
    try {
      const detalle = await cliente.fetchQuery(rutinaDetalleQuery(rutinaId));
      if (detalle.ejercicios.length === 0) {
        alerta(
          'Esta rutina no tiene ejercicios',
          'Agrégale al menos uno antes de entrenarla.',
        );
        return;
      }

      await escribirBorrador({
        clientId: Crypto.randomUUID(),
        rutinaId: detalle.id,
        nombreRutina: detalle.nombre,
        iniciadoEn: new Date().toISOString(),
        terminadoEn: null,
        indiceActual: 0,
        ejercicios: detalle.ejercicios.map((e) => ({
          catalogId: e.id,
          nombre: e.nombre_es,
          gifUrl: e.gif_url,
          equipamiento: e.equipment_es,
          agregado: false,
          repsDefault: e.reps_default,
          kgDefault: e.weight_default,
          seriesPrevias: (e.series_previas ?? []).map((s) => ({
            reps: s.reps,
            kg: s.weight_kg,
          })),
          series: Array.from({ length: Math.max(1, e.sets_default ?? 1) }, () => ({
            reps: valorInicial(e.reps_default, 'reps'),
            kg: valorInicial(e.weight_default, 'kg'),
            completadaEn: null,
          })),
        })),
      });
      router.push('/sesion');
    } catch (error) {
      alerta('No pudimos abrir la rutina', (error as Error).message);
    } finally {
      setEmpezando(null);
    }
  }

  return { empezar, empezando };
}
