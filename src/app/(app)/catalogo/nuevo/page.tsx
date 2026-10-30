import { Suspense } from "react";
import { PaginaProducto } from "../pagina-producto";

export default function NuevoProducto({ searchParams }: PageProps<"/catalogo/nuevo">) {
  return (
    <Suspense fallback={<p className="text-lg">Cargando…</p>}>
      <Contenido searchParams={searchParams} />
    </Suspense>
  );
}

/** ?codigo=… cuando se crea desde la caja al escanear algo que no está registrado. */
async function Contenido({ searchParams }: { searchParams: PageProps<"/catalogo/nuevo">["searchParams"] }) {
  const { codigo } = (await searchParams) as Record<string, string | undefined>;
  return <PaginaProducto codigo={codigo?.replace(/[^0-9A-Za-z.-]/g, "")} />;
}
