import { Suspense } from "react";
import { Pestanas, type Pestana } from "@/components/pestanas";
import { puede, requerirPermiso } from "@/server/sesion";
import { textosVentas } from "@/lib/textos";

const t = textosVentas.pestanas;

export default function LayoutVender({ children }: LayoutProps<"/vender">) {
  return (
    <div className="grid gap-4">
      <Suspense fallback={<div className="h-12" />}>
        <PestanasVender />
      </Suspense>
      {children}
    </div>
  );
}

async function PestanasVender() {
  const yo = await requerirPermiso("ventas.vender");
  const pestanas: Pestana[] = [{ href: "/vender", etiqueta: t.vender, exacta: true }];
  if (puede(yo, "ventas.ver_propias") || puede(yo, "ventas.ver_todas")) pestanas.push({ href: "/vender/ventas", etiqueta: t.ventas });
  if (puede(yo, "caja.abrir_cerrar")) pestanas.push({ href: "/vender/caja", etiqueta: t.caja });
  return <Pestanas pestanas={pestanas} nombre={textosVentas.menu} />;
}
