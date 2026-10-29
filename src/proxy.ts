import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { configSupabase } from "@/lib/supabase/config";
import { COOKIE_RECORDAR, ajustarOpcionesSesion, quiereRecordar } from "@/lib/supabase/cookies";

/** Pantallas que se pueden ver sin iniciar sesión. */
const RUTAS_PUBLICAS = ["/entrar", "/registro", "/recuperar", "/olvide-correo", "/auth", "/cambiar-usuario"];

function esPublica(ruta: string) {
  return RUTAS_PUBLICAS.some((p) => ruta === p || ruta.startsWith(`${p}/`));
}

/**
 * Corre antes de cada pantalla: renueva la sesión de Supabase y manda a
 * "Entrar" a quien no tiene sesión. (Los permisos se revisan de nuevo en cada
 * pantalla y en la base de datos; esto es solo la primera puerta.)
 */
export async function proxy(request: NextRequest) {
  const config = configSupabase();
  if (!config) return NextResponse.next();

  const recordar = quiereRecordar(request.cookies.get(COOKIE_RECORDAR)?.value);
  let respuesta = NextResponse.next({ request });

  const supabase = createServerClient(config.url, config.clave, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (lista) => {
        lista.forEach(({ name, value }) => request.cookies.set(name, value));
        respuesta = NextResponse.next({ request });
        lista.forEach(({ name, value, options }) =>
          respuesta.cookies.set(name, value, ajustarOpcionesSesion(options, recordar)),
        );
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const conSesion = Boolean(data?.claims?.sub);
  const ruta = request.nextUrl.pathname;

  if (!conSesion && !esPublica(ruta)) {
    const destino = request.nextUrl.clone();
    destino.pathname = "/entrar";
    destino.search = ruta === "/" ? "" : `?siguiente=${encodeURIComponent(ruta)}`;
    return NextResponse.redirect(destino);
  }
  return respuesta;
}

export const config = {
  matcher: [
    // Todo menos archivos estáticos, íconos, manifest y service worker.
    "/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|sw.js|sin-conexion.html|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)",
  ],
};
