import { Suspense } from "react";
import Link from "next/link";
import { Aviso } from "@/components/formulario";
import { buttonVariants } from "@/components/ui/button";
import { clienteServidor } from "@/lib/supabase/servidor";
import { puede, requerirUsuarioActivo } from "@/server/sesion";
import { textos, textosPanel } from "@/lib/textos";
import { PanelInicio } from "@/components/reportes/panel-inicio";
import { panelInicio } from "@/server/reportes";

const t = textos.inicio;

export default function Inicio({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<p className="text-lg">{textos.general.cargando}</p>}>
      <Contenido searchParams={searchParams} />
    </Suspense>
  );
}

async function Contenido({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const usuario = await requerirUsuarioActivo();
  const { aviso } = await searchParams;
  const supabase = await clienteServidor();

  const [{ data: tienePin }, pendientes] = await Promise.all([
    supabase.rpc("tengo_pin"),
    puede(usuario, "usuarios.gestionar")
      ? supabase.from("perfiles").select("id", { count: "exact", head: true }).eq("estado", "pendiente")
      : Promise.resolve({ count: 0 }),
  ]);
  const primerNombre = usuario.nombre.split(" ")[0];
  const panel = puede(usuario, "reportes.ver") ? await panelInicio() : null;

  return (
    <div className="grid gap-6">
      <h1 className="text-3xl font-bold">
        {t.hola}, {primerNombre} 👋
      </h1>
      {aviso === "sin-permiso" && <Aviso tipo="error">{textos.general.sinPermiso}</Aviso>}
      {!!pendientes.count && (
        <Aviso tipo="info">
          <div className="flex flex-wrap items-center gap-3">
            <span>{t.pendientesDeAprobar(pendientes.count)}</span>
            <Link href="/usuarios" className={buttonVariants({ size: "sm" })}>
              {t.revisar}
            </Link>
          </div>
        </Aviso>
      )}
      {!tienePin && (
        <Aviso tipo="info">
          <Link href="/mi-cuenta" className="underline">
            {t.crearPin}
          </Link>
        </Aviso>
      )}
      {panel ? (
        <PanelInicio p={panel} />
      ) : (
        puede(usuario, "ventas.vender") && (
          <Link href="/vender" className={buttonVariants({ size: "lg", className: "h-16 justify-self-start text-xl" })}>
            {textosPanel.irVender}
          </Link>
        )
      )}
    </div>
  );
}
