import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { configSupabase } from "./config";

/**
 * Cliente de Supabase para el servidor. Usa la sesión de la persona (sus
 * cookies), así que la base de datos aplica sus permisos (RLS).
 */
export async function clienteServidor() {
  const config = configSupabase();
  if (!config) throw new Error("Falta configurar Supabase en .env.local");
  const almacen = await cookies();

  return createServerClient(config.url, config.clave, {
    cookies: {
      getAll: () => almacen.getAll(),
      setAll: (lista) => {
        try {
          lista.forEach(({ name, value, options }) => almacen.set(name, value, options));
        } catch {
          // Desde un Server Component no se pueden escribir cookies; el
          // proxy de sesión (fase 2) se encarga de renovarlas.
        }
      },
    },
  });
}
