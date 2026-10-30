import { Suspense } from "react";
import { textos, textosVentas } from "@/lib/textos";
import { puede, requerirPermiso } from "@/server/sesion";
import { clientesConSaldo } from "@/server/ventas";
import { ListaClientes } from "./lista-clientes";

export default function Clientes() {
  return (
    <div className="grid max-w-2xl gap-5">
      <h1 className="text-3xl font-bold">{textosVentas.clientes.titulo}</h1>
      <Suspense fallback={<p className="text-lg">{textos.general.cargando}</p>}>
        <Contenido />
      </Suspense>
    </div>
  );
}

async function Contenido() {
  const yo = await requerirPermiso("clientes.gestionar");
  return <ListaClientes clientes={await clientesConSaldo()} puedeSubirLimite={puede(yo, "clientes.fiar_sobre_limite")} />;
}
