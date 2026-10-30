import { Suspense } from "react";
import { clienteServidor } from "@/lib/supabase/servidor";
import { textos, textosGastos } from "@/lib/textos";
import { requerirPermiso } from "@/server/sesion";
import { listarCuentas } from "@/server/abastecimiento";
import { PantallaGastos } from "./pantalla-gastos";

export default function Gastos() {
  return (
    <div className="grid max-w-2xl gap-6">
      <h1 className="text-3xl font-bold">{textosGastos.titulo}</h1>
      <Suspense fallback={<p className="text-lg">{textos.general.cargando}</p>}>
        <Contenido />
      </Suspense>
    </div>
  );
}

async function Contenido() {
  await requerirPermiso("gastos.registrar");
  const supabase = await clienteServidor();
  const [cuentas, { data: categorias }, { data: vehiculos }, { data: pendientes }, { data: fijos }, { data: gastos }] = await Promise.all([
    listarCuentas(),
    supabase.from("categorias_gasto").select("id, nombre, grupo, es_vehiculo").eq("activa", true).order("orden"),
    supabase.from("vehiculos").select("id, nombre").eq("activo", true).order("nombre"),
    supabase.rpc("recurrentes_pendientes"),
    supabase.from("gastos_recurrentes").select("id, categoria_id, descripcion, monto, dia, cuenta_id, activo").order("dia"),
    supabase
      .from("gastos")
      .select("id, fecha, monto, descripcion, personal, anulado, viaje_id, categorias_gasto(nombre), cuentas_dinero(nombre)")
      .order("fecha", { ascending: false })
      .limit(80),
  ]);
  return (
    <PantallaGastos
      cuentas={cuentas.map((c) => ({ id: c.id, nombre: c.nombre }))}
      categorias={(categorias ?? []).map((c) => ({ id: c.id, nombre: c.nombre, grupo: c.grupo, esVehiculo: c.es_vehiculo }))}
      vehiculos={vehiculos ?? []}
      pendientes={(pendientes ?? []).map((p) => ({
        id: p.id,
        descripcion: p.descripcion,
        categoriaId: p.categoria_id,
        monto: p.monto === null ? null : String(p.monto),
        dia: p.dia,
        cuentaId: p.cuenta_id,
        vence: p.vence,
      }))}
      fijos={(fijos ?? []).map((f) => ({
        id: f.id,
        categoriaId: f.categoria_id,
        descripcion: f.descripcion,
        monto: f.monto === null ? "" : String(f.monto),
        dia: String(f.dia),
        cuentaId: f.cuenta_id ?? "",
        activo: f.activo,
      }))}
      gastos={(gastos ?? []).map((g) => ({
        id: g.id,
        fecha: g.fecha,
        monto: String(g.monto),
        descripcion: g.descripcion,
        personal: g.personal,
        anulado: g.anulado,
        categoria: (g.categorias_gasto as { nombre: string } | null)?.nombre ?? "",
        cuenta: (g.cuentas_dinero as { nombre: string } | null)?.nombre ?? "",
      }))}
    />
  );
}
