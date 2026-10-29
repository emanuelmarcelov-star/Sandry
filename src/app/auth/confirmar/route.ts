import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { clienteServidor } from "@/lib/supabase/servidor";
import { rutaSegura } from "@/server/utilidades";

/**
 * A esta dirección llegan los enlaces de los correos (recuperar contraseña,
 * invitación, confirmar cuenta). Crea la sesión y lleva a la pantalla que toca.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const siguiente = rutaSegura(url.searchParams.get("siguiente"));
  const codigo = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const tipo = url.searchParams.get("type") as EmailOtpType | null;
  const supabase = await clienteServidor();

  let error: unknown = null;
  if (codigo) {
    ({ error } = await supabase.auth.exchangeCodeForSession(codigo));
  } else if (tokenHash && tipo) {
    ({ error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: tipo }));
  } else {
    // Algunos enlaces traen la sesión después del "#", que solo ve el navegador.
    return NextResponse.redirect(new URL(`/auth/enlace?siguiente=${encodeURIComponent(siguiente)}`, url));
  }

  if (error) return NextResponse.redirect(new URL("/entrar?motivo=enlace-vencido", url));
  return NextResponse.redirect(new URL(siguiente, url));
}
