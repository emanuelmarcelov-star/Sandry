/**
 * Dirección y clave pública de Supabase. Vienen de `.env.local` en la
 * computadora y de las variables de entorno de Netlify en producción.
 * La clave "publishable" es pública por diseño: lo que protege los datos
 * son las reglas RLS de la base de datos.
 */
export function configSupabase(): { url: string; clave: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !clave) return null;
  return { url, clave };
}
