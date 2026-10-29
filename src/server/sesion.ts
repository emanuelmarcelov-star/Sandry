import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";

export type EstadoUsuario = "pendiente" | "activo" | "desactivado";

export type UsuarioActual = {
  id: string;
  nombre: string;
  correo: string;
  estado: EstadoUsuario;
  fotoRuta: string | null;
  rol: { id: string; nombre: string; esAdministradora: boolean } | null;
  permisos: string[];
};

/**
 * Quién está usando la app ahora (o null). Se consulta en cada pantalla, sin
 * guardar en caché: si la administradora desactiva a alguien o le quita un
 * permiso, el cambio vale de inmediato.
 */
export const obtenerUsuario = cache(async (): Promise<UsuarioActual | null> => {
  await connection(); // La sesión se revisa en cada visita, nunca al preparar la página.
  const supabase = await clienteServidor();
  const { data: sesion } = await supabase.auth.getClaims();
  const id = sesion?.claims?.sub;
  if (!id) return null;

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("id, nombre_completo, correo, estado, foto_ruta, rol_id")
    .eq("id", id)
    .maybeSingle();
  if (!perfil) return null;

  let rol: UsuarioActual["rol"] = null;
  let permisos: string[] = [];
  if (perfil.estado === "activo") {
    const [{ data: filaRol }, { data: lista }] = await Promise.all([
      supabase.from("roles").select("id, nombre, es_administradora").eq("id", perfil.rol_id ?? "").maybeSingle(),
      supabase.rpc("mis_permisos"),
    ]);
    if (filaRol) rol = { id: filaRol.id, nombre: filaRol.nombre, esAdministradora: filaRol.es_administradora };
    permisos = (lista as string[] | null) ?? [];
  }

  return {
    id: perfil.id,
    nombre: perfil.nombre_completo,
    correo: perfil.correo,
    estado: perfil.estado as EstadoUsuario,
    fotoRuta: perfil.foto_ruta,
    rol,
    permisos,
  };
});

/** Exige una persona con sesión y cuenta activa; si no, la manda donde corresponde. */
export async function requerirUsuarioActivo(): Promise<UsuarioActual> {
  const usuario = await obtenerUsuario();
  if (!usuario) redirect("/entrar");
  if (usuario.estado === "pendiente") redirect("/pendiente");
  if (usuario.estado === "desactivado") redirect("/salir?motivo=desactivada");
  return usuario;
}

/** Exige además un permiso. Sin permiso, vuelve al inicio con un aviso. */
export async function requerirPermiso(permiso: string): Promise<UsuarioActual> {
  const usuario = await requerirUsuarioActivo();
  if (!usuario.permisos.includes(permiso)) redirect("/?aviso=sin-permiso");
  return usuario;
}

export function puede(usuario: UsuarioActual, permiso: string): boolean {
  return usuario.permisos.includes(permiso);
}
