"use client";

import { useEffect } from "react";
import { clienteNavegador } from "@/lib/supabase/navegador";
import { textos } from "@/lib/textos";

const VENCIDO = "/entrar?motivo=enlace-vencido";

/** Recibe los enlaces que traen la sesión después del "#" (por ejemplo, invitaciones). */
export default function Enlace() {
  useEffect(() => {
    const parametros = new URLSearchParams(window.location.hash.slice(1));
    const access_token = parametros.get("access_token");
    const refresh_token = parametros.get("refresh_token");
    const siguienteCrudo = new URLSearchParams(window.location.search).get("siguiente") ?? "/";
    const siguiente = siguienteCrudo.startsWith("/") && !siguienteCrudo.startsWith("//") ? siguienteCrudo : "/";

    if (!access_token || !refresh_token) {
      window.location.replace(VENCIDO);
      return;
    }
    clienteNavegador()
      .auth.setSession({ access_token, refresh_token })
      .then(({ error }) => window.location.replace(error ? VENCIDO : siguiente));
  }, []);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 items-center justify-center px-4 text-center text-lg">
      <p>{textos.general.cargando}</p>
    </main>
  );
}
