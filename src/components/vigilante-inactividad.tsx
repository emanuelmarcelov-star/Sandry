"use client";

import { useEffect } from "react";

const CLAVE = "sandry:ultima-actividad";
const EVENTOS = ["pointerdown", "keydown", "touchstart", "scroll"] as const;

/**
 * Cierra la sesión si nadie toca la app durante los minutos configurados.
 * La última actividad se comparte entre pestañas del mismo dispositivo.
 */
export function VigilanteInactividad({ minutos }: { minutos: number }) {
  useEffect(() => {
    const limite = minutos * 60 * 1000;
    const marcar = () => {
      try {
        localStorage.setItem(CLAVE, String(Date.now()));
      } catch {
        // Sin almacenamiento: se usa solo la memoria de esta pestaña.
      }
      ultima = Date.now();
    };
    let ultima = Date.now();
    marcar();

    const revisar = () => {
      let referencia = ultima;
      try {
        referencia = Math.max(ultima, Number(localStorage.getItem(CLAVE) ?? 0));
      } catch {}
      if (Date.now() - referencia >= limite) {
        // /salir es una ruta del servidor que cierra la sesión: hace falta una navegación completa.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign("/salir?motivo=inactividad");
      }
    };

    EVENTOS.forEach((e) => window.addEventListener(e, marcar, { passive: true }));
    const intervalo = window.setInterval(revisar, 15_000);
    document.addEventListener("visibilitychange", revisar);
    return () => {
      EVENTOS.forEach((e) => window.removeEventListener(e, marcar));
      window.clearInterval(intervalo);
      document.removeEventListener("visibilitychange", revisar);
    };
  }, [minutos]);

  return null;
}
