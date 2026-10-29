import { Suspense } from "react";
import Link from "next/link";
import { Marca } from "@/components/marca";
import { MenuPrincipal, type OpcionMenu } from "@/components/menu-principal";
import { VigilanteInactividad } from "@/components/vigilante-inactividad";
import { clienteServidor } from "@/lib/supabase/servidor";
import { puede, requerirUsuarioActivo } from "@/server/sesion";
import { textos, textosCatalogo } from "@/lib/textos";

const t = textos.menu;

/** Marco de las pantallas con sesión: barra superior con el menú. */
export default function LayoutApp({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-3 px-4">
          <Link href="/" aria-label={t.inicio}>
            <Marca />
          </Link>
          <Suspense fallback={<div className="h-12 w-32 animate-pulse rounded-lg bg-muted" />}>
            <MenuDeLaPersona />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </>
  );
}

async function MenuDeLaPersona() {
  const usuario = await requerirUsuarioActivo();
  const supabase = await clienteServidor();
  const { data: ajustes } = await supabase.from("ajustes").select("minutos_inactividad").maybeSingle();

  const opciones: OpcionMenu[] = [{ href: "/", etiqueta: t.inicio, icono: "Home" }];
  if (puede(usuario, "productos.ver")) opciones.push({ href: "/catalogo", etiqueta: textosCatalogo.menu, icono: "Package" });
  if (puede(usuario, "usuarios.gestionar")) {
    opciones.push({ href: "/usuarios", etiqueta: t.usuarios, icono: "Users" });
    opciones.push({ href: "/usuarios/roles", etiqueta: t.roles, icono: "ShieldCheck" });
  }
  if (puede(usuario, "bitacora.ver")) opciones.push({ href: "/bitacora", etiqueta: t.bitacora, icono: "History" });
  if (puede(usuario, "ajustes.gestionar")) opciones.push({ href: "/ajustes", etiqueta: t.ajustes, icono: "Settings" });
  opciones.push({ href: "/mi-cuenta", etiqueta: t.miCuenta, icono: "UserRound" });

  return (
    <>
      <VigilanteInactividad minutos={ajustes?.minutos_inactividad ?? 30} />
      <MenuPrincipal nombre={usuario.nombre} rol={usuario.rol?.nombre ?? ""} opciones={opciones} />
    </>
  );
}
