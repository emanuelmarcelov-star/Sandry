import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/tipos";

/** El único proyecto donde estas pruebas pueden borrar datos. */
const PROYECTO_PRUEBAS = "fhehdhpkxqtmeotaxmgm";

export const CONTRASENA = "Prueba-Sandry-2026";

function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const publica = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
  const secreta = process.env.SUPABASE_SECRET_KEY ?? "";
  if (!url.includes(PROYECTO_PRUEBAS)) {
    throw new Error(`Las pruebas solo corren contra sandry-pruebas. URL actual: ${url || "(vacía)"}`);
  }
  if (!publica || !secreta) throw new Error("Faltan las claves en .env.test.local");
  return { url, publica, secreta };
}

const opciones = { auth: { persistSession: false, autoRefreshToken: false } };

export function admin(): SupabaseClient<Database> {
  const { url, secreta } = config();
  return createClient<Database>(url, secreta, opciones);
}

export function anonimo(): SupabaseClient<Database> {
  const { url, publica } = config();
  return createClient<Database>(url, publica, opciones);
}

/** Borra TODAS las cuentas del proyecto de pruebas (y con ellas perfiles, PIN, etc.). */
export async function vaciarProyecto() {
  const a = admin();
  for (;;) {
    const { data, error } = await a.auth.admin.listUsers({ perPage: 100 });
    if (error) throw error;
    if (!data.users.length) break;
    for (const u of data.users) await a.auth.admin.deleteUser(u.id);
  }
  await a.from("bitacora").delete().gte("id", 0);
  await a.from("intentos_recuperar_correo").delete().gte("id", 0);
  // Permisos por defecto de la cajera (por si una prueba anterior los cambió).
  await a.from("rol_permisos").delete().eq("rol_id", "cajera");
  await a.from("rol_permisos").insert(
    ["ventas.vender", "ventas.ver_propias", "caja.abrir_cerrar", "clientes.gestionar", "productos.ver"].map((permiso) => ({
      rol_id: "cajera",
      permiso,
    })),
  );
}

/** Crea una cuenta como si se hubiera registrado (el disparador crea su perfil). */
export async function crearCuenta(correo: string, datos: { nombre_completo: string; telefono?: string; cedula?: string }) {
  const { data, error } = await admin().auth.admin.createUser({
    email: correo,
    password: CONTRASENA,
    email_confirm: true,
    user_metadata: datos,
  });
  if (error) throw error;
  return data.user.id;
}

/** Cliente con la sesión de esa persona (como si usara la app). */
export async function sesionDe(correo: string): Promise<SupabaseClient<Database>> {
  const cliente = anonimo();
  const { error } = await cliente.auth.signInWithPassword({ email: correo, password: CONTRASENA });
  if (error) throw error;
  return cliente;
}
