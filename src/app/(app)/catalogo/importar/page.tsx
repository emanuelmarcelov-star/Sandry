import { Suspense } from "react";
import { requerirPermiso } from "@/server/sesion";
import { textosCatalogo } from "@/lib/textos";
import { Importador } from "./importador";

export default function Importar() {
  return (
    <Suspense fallback={<p className="text-lg">Cargando…</p>}>
      <Contenido />
    </Suspense>
  );
}

async function Contenido() {
  await requerirPermiso("productos.editar");
  return (
    <div className="grid gap-6">
      <h1 className="text-3xl font-bold">{textosCatalogo.importar.titulo}</h1>
      <Importador />
    </div>
  );
}
