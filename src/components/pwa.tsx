"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useOffline } from "next/offline";
import { WifiOff } from "lucide-react";
import { textos } from "@/lib/textos";

/** Registra el service worker para que la app se pueda instalar. */
export function RegistroServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
    }
  }, []);
  return null;
}

function suscribirRed(avisar: () => void) {
  window.addEventListener("online", avisar);
  window.addEventListener("offline", avisar);
  return () => {
    window.removeEventListener("online", avisar);
    window.removeEventListener("offline", avisar);
  };
}

/**
 * Franja visible en todas las pantallas cuando se pierde la conexión.
 * Junta dos señales: la de Next (falló una petición) y la del navegador
 * (navigator.onLine), así se nota aunque se corte justo al abrir la página.
 */
export function AvisoSinConexion() {
  const peticionFallida = useOffline();
  const sinRed = useSyncExternalStore(suscribirRed, () => !navigator.onLine, () => false);
  const sinConexion = peticionFallida || sinRed;
  if (!sinConexion) return null;
  return (
    <div
      role="status"
      className="sticky top-0 z-50 flex items-center gap-3 bg-amber-500 px-4 py-3 text-base font-medium text-black"
    >
      <WifiOff className="size-6 shrink-0" aria-hidden />
      <span>{textos.conexion.sinInternet}</span>
    </div>
  );
}
