import { NextResponse, type NextRequest } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";

const MOTIVOS = new Set(["inactividad", "desactivada"]);

/** Cierra la sesión y vuelve a "Entrar" (con el motivo, si lo hay). */
export async function GET(request: NextRequest) {
  const supabase = await clienteServidor();
  await supabase.auth.signOut({ scope: "local" });
  const motivo = request.nextUrl.searchParams.get("motivo");
  const destino = new URL("/entrar", request.nextUrl);
  if (motivo && MOTIVOS.has(motivo)) destino.searchParams.set("motivo", motivo);
  return NextResponse.redirect(destino);
}
