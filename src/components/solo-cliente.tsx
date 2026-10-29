"use client";

import { useSyncExternalStore } from "react";

const sinCambios = () => () => {};

/** true solo en el navegador (después de hidratar). */
export function useEnCliente(): boolean {
  return useSyncExternalStore(sinCambios, () => true, () => false);
}

/**
 * Muestra su contenido solo en el navegador. Sirve para pantallas que arrancan
 * con lo guardado en el dispositivo (borradores, viaje sin señal).
 */
export function SoloCliente({ children, mientras = null }: { children: React.ReactNode; mientras?: React.ReactNode }) {
  return useEnCliente() ? children : mientras;
}
