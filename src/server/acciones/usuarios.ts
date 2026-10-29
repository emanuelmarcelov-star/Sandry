"use server";

import { revalidatePath } from "next/cache";
import { clienteServidor } from "@/lib/supabase/servidor";
import { clienteAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/tipos";
import { mensajeError, type Resultado } from "@/lib/errores";
import {
  erroresPorCampo,
  esquemaAjustes,
  esquemaCambiarCorreo,
  esquemaInvitar,
  type DatosAjustes,
  type SalidaAjustes,
  type DatosInvitar,
} from "@/lib/esquemas/usuarios";
import { requerirPermiso } from "@/server/sesion";
import { origenSitio } from "@/server/utilidades";

/*
 * Acciones de la administradora. Cada una revisa el permiso aquí y otra vez
 * dentro de la base de datos (funciones con "exigir_permiso").
 */

type Funciones = Database["public"]["Functions"];

async function llamar<F extends keyof Funciones>(
  funcion: F,
  parametros: Funciones[F]["Args"],
  exito: string,
): Promise<Resultado> {
  await requerirPermiso("usuarios.gestionar");
  const supabase = await clienteServidor();
  const { error } = await supabase.rpc(funcion, parametros);
  if (error) return { ok: false, mensaje: mensajeError(error) };
  revalidatePath("/usuarios");
  return { ok: true, mensaje: exito };
}

export async function aprobarUsuario(usuarioId: string, rol: string) {
  return llamar("aprobar_usuario", { p_usuario: usuarioId, p_rol: rol }, "Listo, ya puede usar la app.");
}

export async function cambiarRol(usuarioId: string, rol: string) {
  return llamar("cambiar_rol_usuario", { p_usuario: usuarioId, p_rol: rol }, "Rol cambiado.");
}

export async function cambiarEstado(usuarioId: string, activo: boolean) {
  return llamar(
    "cambiar_estado_usuario",
    { p_usuario: usuarioId, p_activo: activo },
    activo ? "Cuenta reactivada." : "Cuenta desactivada. Su historial se conserva.",
  );
}

export async function resetearPin(usuarioId: string) {
  return llamar("resetear_pin", { p_usuario: usuarioId }, "PIN borrado. Esa persona deberá crear uno nuevo en «Mi cuenta».");
}

export async function guardarPermisosRol(rol: string, permisos: string[]): Promise<Resultado> {
  const resultado = await llamar("actualizar_permisos_rol", { p_rol: rol, p_permisos: permisos }, "Permisos guardados.");
  revalidatePath("/usuarios/roles");
  return resultado;
}

/** Invita por correo: la persona recibe un enlace para crear su contraseña y entra ya aprobada. */
export async function invitarUsuario(datos: DatosInvitar): Promise<Resultado> {
  const yo = await requerirPermiso("usuarios.gestionar");
  const revisado = esquemaInvitar.safeParse(datos);
  if (!revisado.success) return { ok: false, mensaje: "Revisa los datos.", campos: erroresPorCampo(revisado.error) };
  const { nombreCompleto, correo, rol } = revisado.data;

  const admin = clienteAdmin();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(correo, {
    data: { nombre_completo: nombreCompleto },
    redirectTo: `${await origenSitio()}/auth/confirmar?siguiente=/cambiar-contrasena`,
  });
  if (error || !data.user) return { ok: false, mensaje: mensajeError(error, "No se pudo enviar la invitación.") };

  const { error: errorPerfil } = await admin
    .from("perfiles")
    .update({ estado: "activo", rol_id: rol, aprobado_por: yo.id, aprobado_en: new Date().toISOString() })
    .eq("id", data.user.id);
  if (errorPerfil) return { ok: false, mensaje: mensajeError(errorPerfil) };

  await admin.rpc("registrar_evento", {
    p_usuario: yo.id,
    p_accion: "invitar_usuario",
    p_entidad: "usuario",
    p_entidad_id: data.user.id,
    p_detalle: { correo, rol },
  });
  revalidatePath("/usuarios");
  return { ok: true, mensaje: `Invitación enviada a ${correo}.` };
}

/** La administradora corrige el correo de alguien de su personal. */
export async function cambiarCorreoUsuario(usuarioId: string, correo: string): Promise<Resultado> {
  const yo = await requerirPermiso("usuarios.gestionar");
  const revisado = esquemaCambiarCorreo.safeParse({ usuarioId, correo });
  if (!revisado.success) return { ok: false, mensaje: "Revisa el correo.", campos: erroresPorCampo(revisado.error) };

  const admin = clienteAdmin();
  const { data: antes } = await admin.from("perfiles").select("correo").eq("id", usuarioId).maybeSingle();
  if (!antes) return { ok: false, mensaje: "No se encontró a esa persona." };

  const { error } = await admin.auth.admin.updateUserById(usuarioId, {
    email: revisado.data.correo,
    email_confirm: true,
  });
  if (error) return { ok: false, mensaje: mensajeError(error, "No se pudo cambiar el correo.") };

  await admin.rpc("registrar_evento", {
    p_usuario: yo.id,
    p_accion: "cambiar_correo",
    p_entidad: "usuario",
    p_entidad_id: usuarioId,
    p_detalle: { antes: antes.correo, despues: revisado.data.correo },
  });
  revalidatePath("/usuarios");
  return { ok: true, mensaje: "Correo actualizado." };
}

export async function guardarAjustes(datos: DatosAjustes | SalidaAjustes): Promise<Resultado> {
  await requerirPermiso("ajustes.gestionar");
  const revisado = esquemaAjustes.safeParse(datos);
  if (!revisado.success) return { ok: false, mensaje: "Revisa los datos.", campos: erroresPorCampo(revisado.error) };

  const supabase = await clienteServidor();
  const { error } = await supabase.rpc("actualizar_ajustes", {
    p_minutos_inactividad: revisado.data.minutosInactividad,
    p_descuento_max: revisado.data.descuentoMaximo,
  });
  if (error) return { ok: false, mensaje: mensajeError(error) };
  revalidatePath("/", "layout");
  return { ok: true, mensaje: "Ajustes guardados." };
}
