"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { clienteServidor } from "@/lib/supabase/servidor";
import { mensajeError, type Resultado } from "@/lib/errores";
import { formatoDolares, formatoFecha, hoyEcuador, leerNumero } from "@/lib/dinero";
import { armarVenta, type Carrito, type PagoVenta } from "@/lib/ventas";
import type { Json } from "@/lib/supabase/tipos";
import { puede, requerirPermiso } from "@/server/sesion";
import { textosVentas } from "@/lib/textos";
import { armarCorreo, correoConfigurado, enviarCorreo } from "@/server/correo";
import { obtenerReporte } from "@/server/reportes";
import { resumenCaja } from "@/server/ventas";

function refrescar() {
  revalidatePath("/vender", "layout");
  revalidatePath("/clientes", "layout");
  revalidatePath("/dinero");
  revalidatePath("/catalogo", "layout");
}

/** Errores que se arreglan pidiendo el PIN de la administradora. */
function pidePin(mensaje: string) {
  return mensaje.includes("PIN");
}

export type VentaRegistrada = { id: string; numero: number; cambio: string; sinStock: string[] };

export async function registrarVenta(
  id: string,
  carrito: Carrito,
  pagos: PagoVenta[],
  pin?: string,
): Promise<Resultado<VentaRegistrada> & { pin?: boolean }> {
  await requerirPermiso("ventas.vender");
  if (!carrito.lineas.length) return { ok: false, mensaje: "No hay nada para cobrar." };
  const supabase = await clienteServidor();
  const { data, error } = await supabase.rpc("registrar_venta", { p: armarVenta(id, carrito, pagos, pin) as unknown as Json });
  if (error) {
    const mensaje = mensajeError(error, "No se pudo guardar la venta.");
    return { ok: false, mensaje, pin: pidePin(mensaje) };
  }
  refrescar();
  const r = data as { id: string; numero: number; cambio: number; sin_stock?: string[] };
  return { ok: true, datos: { id: r.id, numero: r.numero, cambio: String(r.cambio ?? 0), sinStock: r.sin_stock ?? [] } };
}

export async function crearProductoPendiente(nombre: string, precio: string, codigo: string): Promise<Resultado<{ productoId: string; presentacionId: string }>> {
  await requerirPermiso("ventas.vender");
  const p = leerNumero(precio);
  if (!p || p.lte(0)) return { ok: false, mensaje: "Escribe el precio." };
  const supabase = await clienteServidor();
  const { data, error } = await supabase.rpc("crear_producto_pendiente", { p_nombre: nombre, p_precio: Number(p.toString()), p_codigo: codigo || undefined });
  if (error) return { ok: false, mensaje: mensajeError(error, "No se pudo crear.") };
  revalidatePath("/catalogo", "layout");
  const r = data as { producto_id: string; presentacion_id: string };
  return { ok: true, datos: { productoId: r.producto_id, presentacionId: r.presentacion_id } };
}

export async function devolverVenta(entrada: {
  ventaId: string;
  motivo: string;
  pin: string;
  cuentaId?: string;
  lineas: { lineaId: number; cantidad: string }[] | null;
}): Promise<Resultado<{ monto: string }> & { pin?: boolean }> {
  await requerirPermiso("ventas.vender");
  const lineas = entrada.lineas
    ?.map((l) => ({ linea_id: l.lineaId, cantidad: leerNumero(l.cantidad)?.toString() ?? "0" }))
    .filter((l) => Number(l.cantidad) > 0);
  if (entrada.lineas && !lineas?.length) return { ok: false, mensaje: "Elige qué se devuelve." };
  const supabase = await clienteServidor();
  const { data, error } = await supabase.rpc("devolver_venta", {
    p: { venta_id: entrada.ventaId, motivo: entrada.motivo, pin: entrada.pin, cuenta_id: entrada.cuentaId ?? null, lineas: lineas ?? null } as unknown as Json,
  });
  if (error) {
    const mensaje = mensajeError(error, "No se pudo hacer la devolución.");
    return { ok: false, mensaje, pin: pidePin(mensaje) };
  }
  refrescar();
  return { ok: true, datos: { monto: String(data) }, mensaje: entrada.lineas ? "Devolución registrada." : "Venta anulada." };
}

// ------------------------------------------------------------------ caja

export async function abrirCaja(fondo: string): Promise<Resultado> {
  await requerirPermiso("caja.abrir_cerrar");
  const n = leerNumero(fondo || "0");
  if (!n || n.isNegative()) return { ok: false, mensaje: "Escribe cuánto dinero hay en la caja." };
  const supabase = await clienteServidor();
  const { error } = await supabase.rpc("abrir_caja", { p_fondo: Number(n.toString()) });
  if (error) return { ok: false, mensaje: mensajeError(error, "No se pudo abrir la caja.") };
  refrescar();
  return { ok: true, mensaje: "Caja abierta." };
}

export async function cerrarCaja(conteo: Record<string, string>, nota: string): Promise<Resultado<{ contado: string; esperado: string; diferencia: string }>> {
  const yo = await requerirPermiso("caja.abrir_cerrar");
  const limpio: Record<string, number> = {};
  for (const [d, c] of Object.entries(conteo)) {
    const n = Number.parseInt(c || "0", 10);
    if (!Number.isFinite(n) || n < 0) return { ok: false, mensaje: "Las cantidades deben ser números enteros." };
    if (n > 0) limpio[d] = n;
  }
  const supabase = await clienteServidor();
  const { data, error } = await supabase.rpc("cerrar_caja", { p_conteo: limpio, p_nota: nota });
  if (error) return { ok: false, mensaje: mensajeError(error, "No se pudo cerrar la caja.") };
  refrescar();
  const r = data as { id: string; contado: number; esperado: number; diferencia: number };
  const enviado = await enviarResumenDelDia(r.id, yo.nombre, puede(yo, "reportes.ver"));
  return {
    ok: true,
    datos: { contado: String(r.contado), esperado: String(r.esperado), diferencia: String(r.diferencia) },
    mensaje: enviado ? `Caja cerrada. Resumen enviado a ${enviado}.` : "Caja cerrada.",
  };
}

/**
 * Resumen del día por correo al cerrar la caja (si el Gmail de la tienda está
 * configurado). La ganancia solo va si quien cierra puede ver reportes.
 * Nunca impide cerrar la caja: si falla, solo no se envía.
 */
async function enviarResumenDelDia(cajaId: string, quien: string, conGanancia: boolean): Promise<string | null> {
  if (!correoConfigurado()) return null;
  const supabase = await clienteServidor();
  const [{ data: para }, caja] = await Promise.all([supabase.rpc("correo_resumen_dia"), resumenCaja(cajaId)]);
  if (!para || !caja) return null;
  const $ = (v: string | number | null) => formatoDolares(Number(v ?? 0));
  const filas: [string, string][] = [
    ["Ventas", `${caja.ventas} · ${$(caja.totalVentas)}`],
    ...Object.entries(caja.porForma).map(([f, v]) => [`   ${textosVentas.ventas.pagos[f] ?? f}`, $(v)] as [string, string]),
    ["Abonos de fiados", $(caja.abonos)],
    ["Efectivo esperado", $(caja.esperado)],
    ["Efectivo contado", $(caja.contado)],
    ["Diferencia", $(caja.diferencia)],
  ];
  if (conGanancia) {
    const { reporte } = await obtenerReporte(hoyEcuador(), hoyEcuador());
    if (reporte) filas.splice(1, 0, ["Ganancia bruta", $(reporte.ganancia_bruta)], ["Gastos de hoy", $(reporte.gastos)]);
  }
  filas.push(["Cerró", quien]);
  const { texto, html } = armarCorreo(`Resumen del día ${formatoFecha(new Date())}`, filas);
  const r = await enviarCorreo(String(para), `Sandry: resumen del ${formatoFecha(new Date())}`, texto, html);
  return r.ok ? String(para) : null;
}

export async function reabrirCaja(): Promise<Resultado> {
  await requerirPermiso("caja.reabrir");
  const supabase = await clienteServidor();
  const { error } = await supabase.rpc("reabrir_caja");
  if (error) return { ok: false, mensaje: mensajeError(error) };
  refrescar();
  return { ok: true, mensaje: "Caja reabierta." };
}

// ------------------------------------------------------------------ clientes

export type DatosCliente = {
  id?: string;
  nombre: string;
  identificacion: string;
  telefono: string;
  correo: string;
  direccion: string;
  limite: string;
  notas: string;
  activo: boolean;
};

export async function guardarCliente(d: DatosCliente): Promise<Resultado<{ id: string }>> {
  await requerirPermiso("clientes.gestionar");
  const limite = d.limite.trim() ? leerNumero(d.limite) : null;
  if (d.limite.trim() && (!limite || limite.isNegative())) return { ok: false, mensaje: "El límite no es válido." };
  const supabase = await clienteServidor();
  const { data, error } = await supabase.rpc("guardar_cliente", {
    p: {
      id: d.id ?? null, nombre: d.nombre, identificacion: d.identificacion, telefono: d.telefono, correo: d.correo,
      direccion: d.direccion, limite_credito: limite?.toString() ?? "0", notas: d.notas, activo: d.activo,
    },
  });
  if (error) return { ok: false, mensaje: mensajeError(error, "No se pudo guardar el cliente.") };
  revalidatePath("/clientes", "layout");
  return { ok: true, datos: { id: data as string }, mensaje: "Cliente guardado." };
}

export async function registrarAbono(clienteId: string, monto: string, formaPagoId: string): Promise<Resultado> {
  await requerirPermiso("clientes.gestionar");
  const n = leerNumero(monto);
  if (!n || n.lte(0)) return { ok: false, mensaje: "Escribe un monto mayor que 0." };
  const supabase = await clienteServidor();
  const { error } = await supabase.rpc("registrar_abono", { p: { cliente_id: clienteId, monto: n.toString(), forma_pago_id: formaPagoId } });
  if (error) return { ok: false, mensaje: mensajeError(error, "No se pudo registrar el abono.") };
  refrescar();
  return { ok: true, mensaje: "Abono registrado." };
}

// ------------------------------------------------------------------ ajustes de venta

export async function guardarAjustesVenta(entrada: {
  ventaSinStock: string;
  ticketAncho: string;
  ticketMensaje: string;
  banco: Record<string, string>;
  alcoholDesde: string;
  alcoholHasta: string;
  correoResumen: string;
  formas: { id: string; cuentaId: string; activa: boolean }[];
}): Promise<Resultado> {
  await requerirPermiso("ajustes.gestionar");
  const supabase = await clienteServidor();
  const { error } = await supabase.rpc("guardar_ajustes_venta", {
    p: {
      venta_sin_stock: entrada.ventaSinStock,
      ticket_ancho: entrada.ticketAncho,
      ticket_mensaje: entrada.ticketMensaje,
      banco: entrada.banco,
      alcohol_desde: entrada.alcoholDesde,
      alcohol_hasta: entrada.alcoholHasta,
      correo_resumen: entrada.correoResumen,
    },
  });
  if (error) return { ok: false, mensaje: mensajeError(error, "No se pudieron guardar los ajustes.") };
  for (const f of entrada.formas) {
    const r = await supabase.rpc("guardar_forma_pago", { p_id: f.id, p_cuenta: f.cuentaId || (null as unknown as string), p_activa: f.activa });
    if (r.error) return { ok: false, mensaje: mensajeError(r.error) };
  }
  revalidatePath("/ajustes");
  revalidatePath("/vender", "layout");
  return { ok: true, mensaje: "Ajustes guardados." };
}

/** Sube la imagen del QR de Deuna (ya achicada en el navegador). */
export async function subirQrDeuna(formulario: FormData): Promise<Resultado> {
  await requerirPermiso("ajustes.gestionar");
  const foto = formulario.get("foto");
  if (!(foto instanceof File) || !foto.size) return { ok: false, mensaje: "Elige la imagen del QR." };
  const extension = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[foto.type];
  if (!extension || foto.size > 2 * 1024 * 1024) return { ok: false, mensaje: "La imagen debe ser JPG, PNG o WEBP de hasta 2 MB." };
  const supabase = await clienteServidor();
  const ruta = `deuna-${randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from("tienda").upload(ruta, foto, { contentType: foto.type });
  if (error) return { ok: false, mensaje: "No se pudo subir la imagen." };
  const r = await supabase.rpc("guardar_ajustes_venta", { p: { deuna_qr_ruta: ruta } });
  if (r.error) return { ok: false, mensaje: mensajeError(r.error) };
  revalidatePath("/ajustes");
  revalidatePath("/vender", "layout");
  return { ok: true, mensaje: "QR de Deuna guardado." };
}
