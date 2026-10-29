import { Suspense } from "react";
import { Pestanas, type Pestana } from "@/components/pestanas";
import { puede, requerirPermiso } from "@/server/sesion";
import { textosInventario } from "@/lib/textos";

const t = textosInventario.pestanas;

export default function LayoutInventario({ children }: LayoutProps<"/inventario">) {
  return (
    <div className="grid gap-6">
      <Suspense fallback={<div className="h-12" />}>
        <PestanasInventario />
      </Suspense>
      {children}
    </div>
  );
}

async function PestanasInventario() {
  const yo = await requerirPermiso("productos.ver");
  const pestanas: Pestana[] = [{ href: "/inventario", etiqueta: t.alertas, exacta: true }];
  if (puede(yo, "inventario.contar") || puede(yo, "inventario.aprobar")) pestanas.push({ href: "/inventario/conteos", etiqueta: t.conteos });
  pestanas.push({ href: "/inventario/envases", etiqueta: t.envases });
  return <Pestanas pestanas={pestanas} nombre={textosInventario.menu} />;
}
