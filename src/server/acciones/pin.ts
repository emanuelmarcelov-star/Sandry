"use server";

import { redirect } from "next/navigation";
import { clienteServidor } from "@/lib/supabase/servidor";
import { clienteAdmin } from "@/lib/supabase/admin";
import { mensajeError, type Resultado } from "@/lib/errores";
import { erroresPorCampo, esquemaPin } from "@/lib/esquemas/usuarios";
import { dispositivoActual } from "@/server/utilidades";
import { obtenerUsuario } from "@/server/sesion";

export type PersonaDelDispositivo = { id: string; nombre: string; tienePin: boolean };

/** Personas que ya entraron con contraseña en este dispositivo (para cambiar con PIN). */
export async function personasDelDispositivo(): Promise<PersonaDelDispositivo[]> {
  const dispositivo = await dispositivoActual();
  if (!dispositivo || !process.env.SUPABASE_SECRET_KEY) return [];
  const admin = clienteAdmin();

  const { data: filas } = await admin
    .from("dispositivo_usuarios")
    .select("usuario_id, ultimo_acceso, perfiles!inner(nombre_completo, estado)")
    .eq("dispositivo_id", dispositivo)
    .eq("perfiles.estado", "activo")
    .order("ultimo_acceso", { ascending: false });
  if (!filas?.length) return [];

  const ids = filas.map((f) => f.usuario_id as string);
  const { data: conPin } = await admin.from("pines").select("usuario_id").in("usuario_id", ids);
  const tienen = new Set((conPin ?? []).map((p) => p.usuario_id as string));

  return filas.map((f) => {
    const perfil = f.perfiles as unknown as { nombre_completo: string };
    return { id: f.usuario_id as string, nombre: perfil.nombre_completo, tienePin: tienen.has(f.usuario_id as string) };
  });
}

/** Cambia la sesión de este dispositivo a otra persona usando su PIN. */
export async function entrarConPin(usuarioId: string, pin: string): Promise<Resultado> {
  const revisado = esquemaPin.safeParse({ pin });
  if (!revisado.success) return { ok: false, mensaje: erroresPorCampo(revisado.error).pin };

  const dispositivo = await dispositivoActual();
  if (!dispositivo || !process.env.SUPABASE_SECRET_KEY) {
    return { ok: false, mensaje: "Este dispositivo no está registrado. Entra con tu correo y contraseña." };
  }
  const admin = clienteAdmin();

  const { data: registro } = await admin
    .from("dispositivo_usuarios")
    .select("usuario_id, perfiles!inner(correo, estado)")
    .eq("dispositivo_id", dispositivo)
    .eq("usuario_id", usuarioId)
    .maybeSingle();
  const perfil = registro?.perfiles as unknown as { correo: string; estado: string } | undefined;
  if (!perfil || perfil.estado !== "activo") {
    return { ok: false, mensaje: "Esa persona no puede entrar con PIN en este dispositivo." };
  }

  const { data: veredicto, error } = await admin.rpc("verificar_pin", { p_usuario: usuarioId, p_pin: revisado.data.pin });
  if (error) return { ok: false, mensaje: mensajeError(error) };
  if (veredicto === "sin_pin") return { ok: false, mensaje: "Esa persona todavía no tiene PIN. Entra con correo y contraseña." };
  if (veredicto === "bloqueado") return { ok: false, mensaje: "Demasiados intentos con PIN incorrecto. Espera 15 minutos." };
  if (veredicto !== "ok") return { ok: false, mensaje: "PIN incorrecto." };

  // Crea una sesión para esa persona sin pedir su contraseña.
  const { data: enlace, error: errorEnlace } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: perfil.correo,
  });
  if (errorEnlace || !enlace.properties?.hashed_token) {
    return { ok: false, mensaje: "No se pudo cambiar de usuario. Intenta de nuevo." };
  }
  const anterior = await obtenerUsuario();
  const supabase = await clienteServidor();
  await supabase.auth.signOut({ scope: "local" });
  const { error: errorSesion } = await supabase.auth.verifyOtp({
    type: "email",
    token_hash: enlace.properties.hashed_token,
  });
  if (errorSesion) return { ok: false, mensaje: mensajeError(errorSesion, "No se pudo cambiar de usuario.") };

  await admin.rpc("registrar_evento", {
    p_usuario: usuarioId,
    p_accion: "cambio_usuario_pin",
    p_entidad: "usuario",
    p_entidad_id: usuarioId,
    p_detalle: { anterior: anterior?.id ?? null, dispositivo },
  });
  await admin
    .from("dispositivo_usuarios")
    .update({ ultimo_acceso: new Date().toISOString() })
    .eq("dispositivo_id", dispositivo)
    .eq("usuario_id", usuarioId);

  redirect("/");
}
