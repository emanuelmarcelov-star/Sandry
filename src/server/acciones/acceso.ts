"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { clienteServidor } from "@/lib/supabase/servidor";
import { clienteAdmin } from "@/lib/supabase/admin";
import { COOKIE_RECORDAR } from "@/lib/supabase/cookies";
import { enmascararCorreo } from "@/lib/validaciones";
import { mensajeError, type Resultado } from "@/lib/errores";
import {
  erroresPorCampo,
  esquemaEntrar,
  esquemaNuevaContrasena,
  esquemaOlvideCorreo,
  esquemaRecuperar,
  esquemaRegistro,
  type DatosEntrar,
  type DatosNuevaContrasena,
} from "@/lib/esquemas/usuarios";
import { ipCliente, origenSitio, registrarDispositivo, rutaSegura } from "@/server/utilidades";
import { subirFotoPerfil } from "@/server/fotos";

const DIAS_RECORDAR = 60 * 60 * 24 * 400;

async function guardarPreferenciaRecordar(recordar: boolean) {
  (await cookies()).set(COOKIE_RECORDAR, recordar ? "1" : "0", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(recordar ? { maxAge: DIAS_RECORDAR } : {}),
  });
}

/** Iniciar sesión con correo y contraseña. */
export async function entrar(datos: DatosEntrar, siguiente?: string): Promise<Resultado> {
  const revisado = esquemaEntrar.safeParse(datos);
  if (!revisado.success) {
    return { ok: false, mensaje: "Revisa los datos.", campos: erroresPorCampo(revisado.error) };
  }
  await guardarPreferenciaRecordar(revisado.data.recordar);

  const supabase = await clienteServidor({ recordar: revisado.data.recordar });
  const { data, error } = await supabase.auth.signInWithPassword({
    email: revisado.data.correo,
    password: revisado.data.contrasena,
  });
  if (error || !data.user) return { ok: false, mensaje: mensajeError(error, "No se pudo entrar.") };

  const { data: perfil } = await supabase.from("perfiles").select("estado").eq("id", data.user.id).maybeSingle();
  if (perfil?.estado === "desactivado") {
    await supabase.auth.signOut();
    return { ok: false, mensaje: "Tu cuenta está desactivada. Habla con la administradora." };
  }

  await registrarDispositivo(data.user.id);
  if (perfil?.estado === "pendiente") redirect("/pendiente");
  redirect(rutaSegura(siguiente));
}

/** Registro de una persona nueva. Recibe FormData porque puede traer una foto. */
export async function registrarse(formulario: FormData): Promise<Resultado> {
  const revisado = esquemaRegistro.safeParse({
    nombreCompleto: formulario.get("nombreCompleto"),
    correo: formulario.get("correo"),
    telefono: formulario.get("telefono"),
    cedula: formulario.get("cedula") ?? "",
    contrasena: formulario.get("contrasena"),
    confirmacion: formulario.get("confirmacion"),
  });
  if (!revisado.success) {
    return { ok: false, mensaje: "Revisa los datos marcados.", campos: erroresPorCampo(revisado.error) };
  }
  const d = revisado.data;

  if (d.cedula && process.env.SUPABASE_SECRET_KEY) {
    const { count } = await clienteAdmin()
      .from("perfiles")
      .select("id", { count: "exact", head: true })
      .eq("cedula", d.cedula);
    if (count) {
      return { ok: false, mensaje: "Revisa los datos marcados.", campos: { cedula: "Esa cédula ya está registrada." } };
    }
  }

  await guardarPreferenciaRecordar(true);
  const supabase = await clienteServidor();
  const { data, error } = await supabase.auth.signUp({
    email: d.correo,
    password: d.contrasena,
    options: {
      data: { nombre_completo: d.nombreCompleto, telefono: d.telefono, cedula: d.cedula },
      emailRedirectTo: `${await origenSitio()}/auth/confirmar`,
    },
  });
  if (error) return { ok: false, mensaje: mensajeError(error, "No se pudo crear la cuenta.") };

  // Si Supabase pide confirmar el correo, todavía no hay sesión.
  if (!data.session || !data.user) {
    return { ok: true, mensaje: "Te enviamos un correo. Ábrelo y toca el enlace para confirmar tu cuenta." };
  }

  const foto = formulario.get("foto");
  if (foto instanceof File && foto.size > 0) {
    const ruta = await subirFotoPerfil(supabase, data.user.id, foto);
    if (ruta) {
      await supabase.rpc("actualizar_mi_perfil", {
        p_nombre_completo: d.nombreCompleto,
        p_telefono: d.telefono,
        p_cedula: d.cedula,
        p_foto_ruta: ruta,
      });
    }
  }

  await registrarDispositivo(data.user.id);
  const { data: perfil } = await supabase.from("perfiles").select("estado").eq("id", data.user.id).maybeSingle();
  redirect(perfil?.estado === "activo" ? "/" : "/pendiente");
}

/** "Olvidé mi contraseña": envía un enlace para crear una nueva. */
export async function enviarRecuperacion(datos: { correo: string }): Promise<Resultado> {
  const revisado = esquemaRecuperar.safeParse(datos);
  if (!revisado.success) {
    return { ok: false, mensaje: "Revisa el correo.", campos: erroresPorCampo(revisado.error) };
  }
  const supabase = await clienteServidor();
  const { error } = await supabase.auth.resetPasswordForEmail(revisado.data.correo, {
    redirectTo: `${await origenSitio()}/auth/confirmar?siguiente=/cambiar-contrasena`,
  });
  // Por seguridad no decimos si el correo existe o no; solo avisamos los límites.
  if (error && (error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit")) {
    return { ok: false, mensaje: mensajeError(error) };
  }
  return {
    ok: true,
    mensaje: "Si ese correo está registrado, te llegará un enlace para crear una contraseña nueva. Revisa también la carpeta de spam.",
  };
}

/** Guarda la contraseña nueva (después de abrir el enlace del correo o desde "Mi cuenta"). */
export async function cambiarContrasena(datos: DatosNuevaContrasena): Promise<Resultado> {
  const revisado = esquemaNuevaContrasena.safeParse(datos);
  if (!revisado.success) {
    return { ok: false, mensaje: "Revisa los datos.", campos: erroresPorCampo(revisado.error) };
  }
  const supabase = await clienteServidor();
  const { data: sesion } = await supabase.auth.getClaims();
  if (!sesion?.claims?.sub) return { ok: false, mensaje: "El enlace venció. Pide uno nuevo desde «Olvidé mi contraseña»." };

  const { error } = await supabase.auth.updateUser({ password: revisado.data.contrasena });
  if (error) return { ok: false, mensaje: mensajeError(error, "No se pudo cambiar la contraseña.") };
  await registrarDispositivo(sesion.claims.sub);
  return { ok: true, mensaje: "Listo, tu contraseña quedó guardada." };
}

const MAXIMO_INTENTOS_POR_HORA = 5;

/** "Olvidé mi correo": con el teléfono o la cédula muestra el correo enmascarado. */
export async function olvideCorreo(datos: { dato: string }): Promise<Resultado<{ correo: string }>> {
  const revisado = esquemaOlvideCorreo.safeParse(datos);
  if (!revisado.success) {
    return { ok: false, mensaje: "Revisa el dato.", campos: erroresPorCampo(revisado.error) };
  }
  if (!process.env.SUPABASE_SECRET_KEY) return { ok: false, mensaje: "Esta opción todavía no está configurada." };

  const admin = clienteAdmin();
  const clave = `ip:${await ipCliente()}`;
  const haceUnaHora = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("intentos_recuperar_correo")
    .select("id", { count: "exact", head: true })
    .eq("clave", clave)
    .gte("fecha", haceUnaHora);
  if ((count ?? 0) >= MAXIMO_INTENTOS_POR_HORA) {
    return { ok: false, mensaje: "Demasiados intentos. Espera una hora o pídele ayuda a la administradora." };
  }
  await admin.from("intentos_recuperar_correo").insert({ clave });

  const { data: correo } = await admin.rpc("buscar_correo_por_dato", { p_dato: revisado.data.dato.trim() });
  if (!correo) {
    return { ok: false, mensaje: "No encontramos una cuenta con ese dato. Pídele ayuda a la administradora." };
  }
  return { ok: true, datos: { correo: enmascararCorreo(correo as string) } };
}
