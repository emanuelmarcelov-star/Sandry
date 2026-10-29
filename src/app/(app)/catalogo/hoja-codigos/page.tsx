import { Suspense } from "react";
import { requerirPermiso } from "@/server/sesion";
import { buscarProductos, urlFotoProducto } from "@/server/catalogo";
import { esCodigoInterno } from "@/lib/catalogo";
import { textosCatalogo } from "@/lib/textos";
import { HojaCodigos } from "./hoja";

const t = textosCatalogo.hoja;

export default function PaginaHojaCodigos({ searchParams }: PageProps<"/catalogo/hoja-codigos">) {
  return (
    <Suspense fallback={<p className="text-lg">Cargando…</p>}>
      <Contenido searchParams={searchParams} />
    </Suspense>
  );
}

async function Contenido({ searchParams }: { searchParams: PageProps<"/catalogo/hoja-codigos">["searchParams"] }) {
  const yo = await requerirPermiso("productos.editar");
  const { todos } = (await searchParams) as { todos?: string };
  const productos = await buscarProductos(yo, { limite: 5000 });

  const filas = productos
    .map((p) => {
      const base = p.presentaciones.find((x) => x.esBase);
      const codigos = base?.codigos ?? [];
      const delFabricante = codigos.some((c) => !esCodigoInterno(c));
      return {
        id: p.id,
        nombre: p.nombre,
        presentacion: base?.nombre ?? "",
        plu: p.plu,
        precio: base?.precioVenta ?? null,
        codigo: codigos.find(esCodigoInterno) ?? codigos[0] ?? null,
        foto: urlFotoProducto(p.fotoRuta),
        delFabricante,
      };
    })
    .filter((p) => todos === "1" || !p.delFabricante)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  return (
    <div className="grid gap-5">
      <div className="grid gap-1 print:hidden">
        <h1 className="text-3xl font-bold">{t.titulo}</h1>
        <p className="text-lg text-muted-foreground">{t.ayuda}</p>
      </div>
      <HojaCodigos productos={filas} todos={todos === "1"} />
    </div>
  );
}
