import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

const TIPOS = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);
const MAXIMO_BYTES = 2 * 1024 * 1024;

/**
 * Sube la foto de perfil a la carpeta privada de la persona.
 * Devuelve la ruta guardada, o null si la foto no es válida.
 */
export async function subirFotoPerfil(
  supabase: SupabaseClient,
  usuarioId: string,
  foto: File,
): Promise<string | null> {
  const extension = TIPOS.get(foto.type);
  if (!extension || foto.size > MAXIMO_BYTES) return null;
  const ruta = `${usuarioId}/perfil-${Date.now()}.${extension}`;
  const { error } = await supabase.storage.from("fotos-perfil").upload(ruta, foto, {
    contentType: foto.type,
    upsert: true,
  });
  return error ? null : ruta;
}

/** Enlace temporal (1 hora) para mostrar una foto privada. */
export async function enlaceFoto(supabase: SupabaseClient, ruta: string | null): Promise<string | null> {
  if (!ruta) return null;
  const { data } = await supabase.storage.from("fotos-perfil").createSignedUrl(ruta, 60 * 60);
  return data?.signedUrl ?? null;
}
