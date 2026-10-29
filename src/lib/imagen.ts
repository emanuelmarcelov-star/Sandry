/**
 * Achica una foto en el navegador antes de subirla (máx. 800 px, JPEG).
 * Así cada foto pesa ~100 KB y el plan gratuito de Supabase alcanza para años.
 */
export async function achicarFoto(archivo: File, ladoMaximo = 800): Promise<File> {
  if (!archivo.type.startsWith("image/")) return archivo;
  const imagen = await createImageBitmap(archivo).catch(() => null);
  if (!imagen) return archivo;
  const escala = Math.min(1, ladoMaximo / Math.max(imagen.width, imagen.height));
  const lienzo = document.createElement("canvas");
  lienzo.width = Math.round(imagen.width * escala);
  lienzo.height = Math.round(imagen.height * escala);
  const ctx = lienzo.getContext("2d");
  if (!ctx) return archivo;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, lienzo.width, lienzo.height);
  ctx.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
  const blob = await new Promise<Blob | null>((ok) => lienzo.toBlob(ok, "image/jpeg", 0.82));
  return blob ? new File([blob], "foto.jpg", { type: "image/jpeg" }) : archivo;
}
