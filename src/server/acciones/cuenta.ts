"use server";

import { revalidatePath } from "next/cache";
import { clienteServidor } from "@/lib/supabase/servidor";
import { clienteAdmin } from "@/lib/supabase/admin";
import { mensajeError, type Resultado } from "@/lib/errores";
import { erroresPorCampo, esquemaMiPerfil, esquemaPin } from "@/lib/esquemas/usuarios";
import { requerirUsuarioActivo } from "@/server/sesion";
import { subirFotoPerfil } from "@/server/fotos";

/** Actualiza nombre, teléfono, cédula y (opcional) la foto propia. */
export async function guardarMiPerfil(formulario: FormData): Promise<Resultado> {
  const yo = await requerirUsuarioActivo();
  const revisado = esquemaMiPerfil.safeParse({
    nombreCompleto: formulario.get("nombreCompleto"),
    telefono: formulario.get("telefono"),
    cedula: formulario.get("cedula") ?? "",
  });
  if (!revisado.success) return { ok: false, mensaje: "Revisa los datos.", campos: erroresPorCampo(revisado.error) };
  const d = revisado.data;

  if (d.cedula && process.env.SUPABASE_SECRET_KEY) {
    const { count } = await clienteAdmin()
      .from("perfiles")
      .select("id", { count: "exact", head: true })
      .eq("cedula", d.cedula)
      .neq("id", yo.id);
    if (count) return { ok: false, mensaje: "Revisa los datos.", campos: { cedula: "Esa cédula ya está registrada." } };
  }

  const supabase = await clienteServidor();
  let fotoRuta = yo.fotoRuta;
  const foto = formulario.get("foto");
  if (foto instanceof File && foto.size > 0) {
    fotoRuta = await subirFotoPerfil(supabase, yo.id, foto);
    if (!fotoRuta) {
      return { ok: false, mensaje: "La foto debe ser JPG, PNG o WEBP y pesar menos de 2 MB.", campos: { foto: "Foto no válida." } };
    }
  }

  const { error } = await supabase.rpc("actualizar_mi_perfil", {
    p_nombre_completo: d.nombreCompleto,
    p_telefono: d.telefono,
    p_cedula: d.cedula,
    p_foto_ruta: fotoRuta ?? "",
  });
  if (error) return { ok: false, mensaje: mensajeError(error) };
  revalidatePath("/", "layout");
  return { ok: true, mensaje: "Tus datos quedaron guardados." };
}

export async function definirMiPin(pin: string, confirmacion: string): Promise<Resultado> {
  await requerirUsuarioActivo();
  const revisado = esquemaPin.safeParse({ pin });
  if (!revisado.success) return { ok: false, mensaje: erroresPorCampo(revisado.error).pin, campos: erroresPorCampo(revisado.error) };
  if (pin !== confirmacion) return { ok: false, mensaje: "Los dos PIN no son iguales.", campos: { confirmacion: "No coincide." } };

  const supabase = await clienteServidor();
  const { error } = await supabase.rpc("definir_mi_pin", { p_pin: pin });
  if (error) return { ok: false, mensaje: mensajeError(error) };
  revalidatePath("/mi-cuenta");
  return { ok: true, mensaje: "PIN guardado. Ya puedes cambiar de usuario con tu PIN en este dispositivo." };
}
