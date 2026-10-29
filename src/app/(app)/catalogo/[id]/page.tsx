import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PaginaProducto } from "../pagina-producto";

export default function EditarProducto({ params }: PageProps<"/catalogo/[id]">) {
  return (
    <Suspense fallback={<p className="text-lg">Cargando…</p>}>
      <Contenido params={params} />
    </Suspense>
  );
}

async function Contenido({ params }: { params: PageProps<"/catalogo/[id]">["params"] }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  return <PaginaProducto id={id} />;
}
