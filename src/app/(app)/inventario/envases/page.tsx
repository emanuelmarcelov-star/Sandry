import { Suspense } from "react";
import { clienteServidor } from "@/lib/supabase/servidor";
import { textos, textosInventario } from "@/lib/textos";
import { puede, requerirPermiso } from "@/server/sesion";
import { listarCuentas, listarProveedores } from "@/server/abastecimiento";
import { PantallaEnvases } from "./pantalla-envases";

export default function Envases() {
  return (
    <div className="grid max-w-3xl gap-5">
      <h1 className="text-3xl font-bold">{textosInventario.envases.titulo}</h1>
      <p className="text-muted-foreground">{textosInventario.envases.ayuda}</p>
      <Suspense fallback={<p className="text-lg">{textos.general.cargando}</p>}>
        <Contenido />
      </Suspense>
    </div>
  );
}

async function Contenido() {
  const yo = await requerirPermiso("productos.ver");
  const supabase = await clienteServidor();
  const gestionar = puede(yo, "proveedores.gestionar");
  const [{ data }, cuentas, proveedores] = await Promise.all([
    supabase.rpc("saldos_envases"),
    listarCuentas(),
    gestionar ? listarProveedores(true) : Promise.resolve([]),
  ]);
  return (
    <PantallaEnvases
      envases={(data ?? []).map((e) => ({
        id: e.id,
        nombre: e.nombre,
        garantia: String(e.garantia),
        proveedor: e.proveedor,
        activo: e.activo,
        vacios: Number(e.vacios),
        debidos: Number(e.debidos),
        garantias: Number(e.garantias),
      }))}
      cuentas={cuentas}
      proveedores={proveedores.map((p) => ({ id: p.id, nombre: p.nombre }))}
      puedeGestionar={gestionar}
      puedeRegistrar={["compras.registrar", "compras.recibir", "ventas.vender"].some((p) => puede(yo, p))}
    />
  );
}
