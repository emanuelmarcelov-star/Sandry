import { Suspense } from "react";
import { puede, requerirPermiso } from "@/server/sesion";
import { textosCatalogo } from "@/lib/textos";
import { PestanasCatalogo } from "./pestanas";

const t = textosCatalogo.pestanas;

export default function LayoutCatalogo({ children }: LayoutProps<"/catalogo">) {
  return (
    <div className="grid gap-6">
      <Suspense fallback={<div className="h-12" />}>
        <Pestanas />
      </Suspense>
      {children}
    </div>
  );
}

async function Pestanas() {
  const yo = await requerirPermiso("productos.ver");
  const pestanas: { href: string; etiqueta: string }[] = [{ href: "/catalogo", etiqueta: t.productos }];
  if (puede(yo, "productos.editar")) {
    pestanas.push(
      { href: "/catalogo/categorias", etiqueta: t.categorias },
      { href: "/catalogo/etiquetas", etiqueta: t.etiquetas },
      { href: "/catalogo/hoja-codigos", etiqueta: t.hoja },
      { href: "/catalogo/importar", etiqueta: t.importar },
    );
  }
  return <PestanasCatalogo pestanas={pestanas} />;
}
