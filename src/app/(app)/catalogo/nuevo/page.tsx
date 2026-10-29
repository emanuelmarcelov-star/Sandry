import { Suspense } from "react";
import { PaginaProducto } from "../pagina-producto";

export default function NuevoProducto() {
  return (
    <Suspense fallback={<p className="text-lg">Cargando…</p>}>
      <PaginaProducto />
    </Suspense>
  );
}
