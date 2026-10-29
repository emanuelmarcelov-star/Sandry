import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Clock } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { obtenerUsuario } from "@/server/sesion";
import { textos } from "@/lib/textos";

const t = textos.acceso;

export default function Pendiente() {
  return (
    <div className="grid gap-6 text-center">
      <Clock className="mx-auto size-14 text-amber-500" aria-hidden />
      <h1 className="text-3xl font-bold">{t.tituloPendiente}</h1>
      <p className="text-lg text-muted-foreground">{t.ayudaPendiente}</p>
      <Suspense>
        <SiYaFueAprobada />
      </Suspense>
      {/* Enlaces normales (no <Link>) para que no se precarguen. */}
      <a href="/pendiente" className={buttonVariants({ size: "lg" })}>
        {t.revisarDeNuevo}
      </a>
      <a href="/salir" className="text-base font-medium text-primary underline">
        {textos.menu.salir}
      </a>
    </div>
  );
}

async function SiYaFueAprobada() {
  const usuario = await obtenerUsuario();
  if (!usuario) redirect("/entrar");
  if (usuario.estado === "activo") redirect("/");
  if (usuario.estado === "desactivado") redirect("/salir?motivo=desactivada");
  return null;
}
