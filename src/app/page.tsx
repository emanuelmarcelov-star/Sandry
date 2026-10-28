import { Suspense } from "react";
import { connection } from "next/server";
import { Store } from "lucide-react";
import { configSupabase } from "@/lib/supabase/config";
import { textos } from "@/lib/textos";

export default function Inicio() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-8 px-4 py-12 text-center">
      <div className="flex size-24 items-center justify-center rounded-3xl bg-green-700 text-white">
        <Store className="size-12" aria-hidden />
      </div>
      <div className="space-y-3">
        <h1 className="text-3xl font-bold">{textos.inicio.bienvenida}</h1>
        <p className="text-lg text-muted-foreground">{textos.inicio.enConstruccion}</p>
      </div>
      <div className="w-full rounded-2xl border p-4 text-lg">
        <span className="font-medium">{textos.inicio.estadoBaseDatos}: </span>
        <Suspense fallback={<span>{textos.inicio.revisando}</span>}>
          <EstadoBaseDatos />
        </Suspense>
      </div>
    </main>
  );
}

/** Comprueba que la app llega a Supabase con la dirección y clave configuradas. */
async function EstadoBaseDatos() {
  await connection(); // Se revisa en cada visita, no al compilar.
  const config = configSupabase();
  if (!config) return <span className="text-amber-600">{textos.inicio.sinConfigurar}</span>;

  let conectado = false;
  try {
    const respuesta = await fetch(`${config.url}/auth/v1/health`, {
      headers: { apikey: config.clave },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    conectado = respuesta.ok;
  } catch {
    conectado = false;
  }

  return conectado ? (
    <span className="text-green-700">✓ {textos.inicio.conectado}</span>
  ) : (
    <span className="text-red-600">{textos.inicio.sinRespuesta}</span>
  );
}
