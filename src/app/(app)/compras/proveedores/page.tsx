import { Suspense } from "react";
import { textos, textosCompras } from "@/lib/textos";
import { requerirPermiso } from "@/server/sesion";
import { listarProveedores } from "@/server/abastecimiento";
import { ListaProveedores } from "./lista-proveedores";

export default function Proveedores() {
  return (
    <div className="grid max-w-3xl gap-5">
      <h1 className="text-3xl font-bold">{textosCompras.proveedores.titulo}</h1>
      <Suspense fallback={<p className="text-lg">{textos.general.cargando}</p>}>
        <Contenido />
      </Suspense>
    </div>
  );
}

async function Contenido() {
  await requerirPermiso("proveedores.gestionar");
  return <ListaProveedores proveedores={await listarProveedores()} />;
}
