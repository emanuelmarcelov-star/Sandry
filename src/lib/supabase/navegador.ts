import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./tipos";
import { configSupabase } from "./config";

/** Cliente de Supabase para componentes que corren en el navegador. */
export function clienteNavegador() {
  const config = configSupabase();
  if (!config) throw new Error("Falta configurar Supabase en .env.local");
  return createBrowserClient<Database>(config.url, config.clave);
}
