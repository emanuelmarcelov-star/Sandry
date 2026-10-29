import "server-only";
import { randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { clienteAdmin } from "@/lib/supabase/admin";
import { COOKIE_DISPOSITIVO } from "@/lib/supabase/cookies";

/** Dirección pública de la app (para los enlaces que van en los correos). */
export async function origenSitio(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const protocolo = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocolo}://${host}`;
}

/** IP de quien hace la petición (para limitar intentos). */
export async function ipCliente(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-nf-client-connection-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    "desconocida"
  );
}

/** Solo acepta rutas internas para "volver a donde estaba" (evita redirecciones a otros sitios). */
export function rutaSegura(ruta: unknown, porDefecto = "/"): string {
  if (typeof ruta !== "string" || !ruta.startsWith("/") || ruta.startsWith("//") || ruta.includes("\\")) {
    return porDefecto;
  }
  return ruta;
}

/**
 * Anota que esta persona entró con contraseña en este dispositivo, para que
 * luego pueda cambiar de usuario aquí con su PIN.
 */
export async function registrarDispositivo(usuarioId: string): Promise<void> {
  if (!process.env.SUPABASE_SECRET_KEY) return;
  const almacen = await cookies();
  let dispositivo = almacen.get(COOKIE_DISPOSITIVO)?.value;
  if (!dispositivo || !/^[0-9a-f-]{36}$/.test(dispositivo)) {
    dispositivo = randomUUID();
  }
  almacen.set(COOKIE_DISPOSITIVO, dispositivo, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365 * 2,
  });
  await clienteAdmin()
    .from("dispositivo_usuarios")
    .upsert({ dispositivo_id: dispositivo, usuario_id: usuarioId, ultimo_acceso: new Date().toISOString() });
}

export async function dispositivoActual(): Promise<string | null> {
  const valor = (await cookies()).get(COOKIE_DISPOSITIVO)?.value;
  return valor && /^[0-9a-f-]{36}$/.test(valor) ? valor : null;
}
