"use server";

import { revalidatePath } from "next/cache";
import { clienteServidor } from "@/lib/supabase/servidor";
import { mensajeError, type Resultado } from "@/lib/errores";
import { leerNumero } from "@/lib/dinero";
import type { Json } from "@/lib/supabase/tipos";
import { requerirPermiso } from "@/server/sesion";

function refrescar() {
  revalidatePath("/gastos");
  revalidatePath("/dinero");
  revalidatePath("/reportes");
  revalidatePath("/");
}

export type DatosGastoNegocio = {
  id: string;
  categoriaId: string;
  monto: string;
  cuentaId: string;
  descripcion: string;
  personal: boolean;
  vehiculoId: string;
  galones: string;
  kilometraje: string;
  recurrenteId?: string;
  fotoRuta?: string | null;
};

export async function registrarGastoNegocio(d: DatosGastoNegocio): Promise<Resultado> {
  await requerirPermiso("gastos.registrar");
  const monto = leerNumero(d.monto);
  if (!monto || monto.lte(0)) return { ok: false, mensaje: "Escribe un monto mayor que 0." };
  const galones = d.galones.trim() ? leerNumero(d.galones) : null;
  if (d.galones.trim() && (!galones || galones.lte(0))) return { ok: false, mensaje: "Los galones no son válidos." };
  const km = d.kilometraje.trim() ? Number.parseInt(d.kilometraje.replace(/\D/g, ""), 10) : null;
  const supabase = await clienteServidor();
  const { error } = await supabase.rpc("registrar_gasto", {
    p: {
      id: d.id,
      categoria_id: d.categoriaId,
      monto: monto.toString(),
      cuenta_id: d.cuentaId,
      descripcion: d.descripcion,
      personal: d.personal,
      vehiculo_id: d.vehiculoId || null,
      galones: galones?.toString() ?? null,
      kilometraje: km,
      recurrente_id: d.recurrenteId ?? null,
      foto_ruta: d.fotoRuta ?? null,
    } as unknown as Json,
  });
  if (error) return { ok: false, mensaje: mensajeError(error, "No se pudo guardar el gasto.") };
  refrescar();
  return { ok: true, mensaje: d.personal ? "Anotado como gasto personal (retiro de la dueña)." : "Gasto anotado." };
}

export async function anularGasto(id: string): Promise<Resultado> {
  await requerirPermiso("gastos.registrar");
  const supabase = await clienteServidor();
  const { error } = await supabase.rpc("anular_gasto", { p_gasto: id });
  if (error) return { ok: false, mensaje: mensajeError(error) };
  refrescar();
  return { ok: true, mensaje: "Gasto anulado." };
}

export async function registrarIngreso(monto: string, cuentaId: string, descripcion: string): Promise<Resultado> {
  await requerirPermiso("gastos.registrar");
  const n = leerNumero(monto);
  if (!n || n.lte(0)) return { ok: false, mensaje: "Escribe un monto mayor que 0." };
  const supabase = await clienteServidor();
  const { error } = await supabase.rpc("registrar_ingreso", { p: { monto: n.toString(), cuenta_id: cuentaId, descripcion } });
  if (error) return { ok: false, mensaje: mensajeError(error, "No se pudo guardar el ingreso.") };
  refrescar();
  return { ok: true, mensaje: "Ingreso anotado." };
}

export async function guardarRecurrente(d: {
  id?: string;
  categoriaId: string;
  descripcion: string;
  monto: string;
  dia: string;
  cuentaId: string;
  activo: boolean;
}): Promise<Resultado> {
  await requerirPermiso("gastos.registrar");
  const monto = d.monto.trim() ? leerNumero(d.monto) : null;
  if (d.monto.trim() && (!monto || monto.lte(0))) return { ok: false, mensaje: "El monto no es válido." };
  const dia = Number.parseInt(d.dia, 10);
  if (!Number.isInteger(dia) || dia < 1 || dia > 28) return { ok: false, mensaje: "El día debe ser del 1 al 28." };
  const supabase = await clienteServidor();
  const { error } = await supabase.rpc("guardar_recurrente", {
    p: { id: d.id ?? null, categoria_id: d.categoriaId, descripcion: d.descripcion, monto: monto?.toString() ?? null, dia, cuenta_id: d.cuentaId || null, activo: d.activo } as unknown as Json,
  });
  if (error) return { ok: false, mensaje: mensajeError(error, "No se pudo guardar.") };
  refrescar();
  return { ok: true, mensaje: "Gasto fijo guardado." };
}

export async function guardarVehiculo(nombre: string): Promise<Resultado<{ id: string }>> {
  await requerirPermiso("gastos.registrar");
  const supabase = await clienteServidor();
  const { data, error } = await supabase.rpc("guardar_vehiculo", { p: { nombre } });
  if (error) return { ok: false, mensaje: mensajeError(error) };
  revalidatePath("/gastos");
  return { ok: true, datos: { id: data as string } };
}

export async function marcarConciliado(fecha: string, forma: string, verificado: boolean): Promise<Resultado> {
  await requerirPermiso("reportes.ver");
  const supabase = await clienteServidor();
  const { error } = await supabase.rpc("marcar_conciliado", { p_fecha: fecha, p_forma: forma, p_verificado: verificado });
  if (error) return { ok: false, mensaje: mensajeError(error) };
  revalidatePath("/reportes");
  return { ok: true };
}
