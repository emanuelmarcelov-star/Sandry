import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { configSupabase } from "./config";
import type { Database } from "./tipos";
import { COOKIE_RECORDAR, ajustarOpcionesSesion, quiereRecordar } from "./cookies";

/**
 * Cliente de Supabase para el servidor. Usa la sesión de la persona (sus
 * cookies), así que la base de datos aplica sus permisos (RLS).
 */
export async function clienteServidor(opciones: { recordar?: boolean } = {}) {
  const config = configSupabase();
  if (!config) throw new Error("Falta configurar Supabase en .env.local");
  const almacen = await cookies();
  const recordar = opciones.recordar ?? quiereRecordar(almacen.get(COOKIE_RECORDAR)?.value);

  return createServerClient<Database>(config.url, config.clave, {
    cookies: {
      getAll: () => almacen.getAll(),
      setAll: (lista) => {
        try {
          lista.forEach(({ name, value, options }) =>
            almacen.set(name, value, ajustarOpcionesSesion(options, recordar)),
          );
        } catch {
          // Desde un Server Component no se pueden escribir cookies; el
          // proxy (src/proxy.ts) se encarga de renovarlas.
        }
      },
    },
  });
}
