import { Suspense } from "react";
import { Pestanas, type Pestana } from "@/components/pestanas";
import { puede, requerirUsuarioActivo } from "@/server/sesion";
import { textosCompras } from "@/lib/textos";

const t = textosCompras.pestanas;

export default function LayoutCompras({ children }: LayoutProps<"/compras">) {
  return (
    <div className="grid gap-6">
      <Suspense fallback={<div className="h-12" />}>
        <PestanasCompras />
      </Suspense>
      {children}
    </div>
  );
}

async function PestanasCompras() {
  const yo = await requerirUsuarioActivo();
  const pestanas: Pestana[] = [];
  if (puede(yo, "compras.registrar")) pestanas.push({ href: "/compras", etiqueta: t.compras, exacta: true });
  pestanas.push({ href: "/compras/nueva", etiqueta: t.nueva });
  if (puede(yo, "compras.registrar")) {
    pestanas.push(
      { href: "/compras/viaje", etiqueta: t.viaje },
      { href: "/compras/por-pagar", etiqueta: t.porPagar },
      { href: "/compras/pedidos", etiqueta: t.pedidos },
    );
  }
  if (puede(yo, "proveedores.gestionar")) pestanas.push({ href: "/compras/proveedores", etiqueta: t.proveedores });
  return <Pestanas pestanas={pestanas} nombre={textosCompras.menu} />;
}
