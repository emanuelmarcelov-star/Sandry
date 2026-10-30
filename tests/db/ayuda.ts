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
  // Ventas (fase 5).
  await a.from("devoluciones").delete().gte("id", 0);
  await a.from("abonos").delete().gte("id", 0);
  await a.from("ventas").delete().not("id", "is", null);
  await a.from("clientes").delete().not("id", "is", null);
  await a.from("cajas").delete().not("id", "is", null);
  await a.from("intentos_autorizacion").delete().gte("id", 0);
  await a.from("ajustes").update({ venta_sin_stock: "avisar" }).eq("id", 1);
  // Abastecimiento e inventario (fase 4): primero lo que apunta a productos y cuentas.
  await a.from("conteos").delete().not("id", "is", null);
  await a.from("movimientos_envases").delete().gte("id", 0);
  await a.from("envases").delete().not("id", "is", null);
  await a.from("pedidos").delete().not("id", "is", null);
  await a.from("pagos_proveedor").delete().gte("id", 0);
  await a.from("lotes").delete().gte("id", 0);
  await a.from("compras").delete().not("id", "is", null);
  await a.from("gastos").delete().not("id", "is", null);
  await a.from("viajes").delete().not("id", "is", null);
  await a.from("movimientos_dinero").delete().gte("id", 0);
  await a.from("proveedores").delete().not("id", "is", null);
  await a.from("cuentas_dinero").delete().not("nombre", "in", '("Caja","Banco","Deuna","Dinero personal de la dueña")');
  await a.from("cuentas_dinero").update({ activa: true }).not("id", "is", null);
  // Catálogo: borra productos (y con ellos presentaciones, códigos, stock, kardex...)
  // y las categorías creadas por pruebas; deja las categorías por defecto.
  await a.from("productos").delete().not("id", "is", null);
  const { data: primeras } = await a.from("categorias").select("creado_en").order("creado_en").limit(1);
  if (primeras?.[0]) {
    const limite = new Date(new Date(primeras[0].creado_en).getTime() + 60_000).toISOString();
    for (;;) {
      // Primero las hojas (sin hijas), para no romper el árbol.
      const { data: nuevas } = await a.from("categorias").select("id, padre_id").gt("creado_en", limite);
      if (!nuevas?.length) break;
      const conHijas = new Set(nuevas.map((c) => c.padre_id).filter(Boolean));
      const hojas = nuevas.filter((c) => !conHijas.has(c.id)).map((c) => c.id);
      await a.from("categorias").delete().in("id", hojas);
    }
  }
  await a.from("ajustes").update({ minutos_inactividad: 30, descuento_max_sin_autorizacion: 5, redondeo_precio: 0.05 }).eq("id", 1);
  for (;;) {
    const { data, error } = await a.auth.admin.listUsers({ perPage: 100 });
    if (error) throw error;
    if (!data.users.length) break;
    for (const u of data.users) await a.auth.admin.deleteUser(u.id);
  }
  await a.from("bitacora").delete().gte("id", 0);
  await a.from("intentos_recuperar_correo").delete().gte("id", 0);
  // Permisos por defecto (por si una prueba anterior los cambió).
  const porDefecto: Record<string, string[]> = {
    cajera: ["ventas.vender", "ventas.ver_propias", "caja.abrir_cerrar", "clientes.gestionar", "productos.ver"],
    inventario: [
      "productos.ver", "costos.ver", "compras.registrar", "compras.recibir", "inventario.contar", "inventario.ajustar",
      "proveedores.gestionar",
    ],
  };
  for (const [rol, permisos] of Object.entries(porDefecto)) {
    await a.from("rol_permisos").delete().eq("rol_id", rol);
    await a.from("rol_permisos").insert(permisos.map((permiso) => ({ rol_id: rol, permiso })));
  }
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
