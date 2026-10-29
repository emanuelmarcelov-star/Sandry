import "server-only";
import { createClient } from "@supabase/supabase-js";
import { configSupabase } from "./config";
import type { Database } from "./tipos";

/**
 * Cliente con la clave SECRETA: salta las reglas RLS. Solo para tareas del
 * servidor que lo necesitan (invitar, cambiar el correo de alguien, revisar
 * un PIN, "olvidé mi correo"). Nunca se importa en el navegador.
 */
export function clienteAdmin() {
  const config = configSupabase();
  const secreta = process.env.SUPABASE_SECRET_KEY;
  if (!config || !secreta) throw new Error("Falta SUPABASE_SECRET_KEY en el servidor");
  return createClient<Database>(config.url, secreta, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
