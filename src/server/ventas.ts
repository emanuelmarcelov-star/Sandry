import "server-only";
import { clienteServidor } from "@/lib/supabase/servidor";
import type { ProductoVenta } from "@/lib/ventas";
import { buscarProductos, urlFotoProducto } from "@/server/catalogo";
import type { UsuarioActual } from "@/server/sesion";

/** Todos los productos activos con sus precios, para buscar al instante en la caja. */
export async function productosParaVenta(usuario: UsuarioActual): Promise<ProductoVenta[]> {
  const productos = await buscarProductos(usuario, { limite: 20000 });
  return productos.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    marca: p.marca,
    sinonimos: p.sinonimos,
    plu: p.plu,
    unidadBase: p.unidadBase,
    stock: p.stock,
    categoriaId: p.categoriaId,
    soloMayores: p.soloMayores,
    fotoRuta: urlFotoProducto(p.fotoRuta),
    presentaciones: p.presentaciones
      .filter((x) => x.paraVenta || x.esBase)
      .map((x) => ({ id: x.id, nombre: x.nombre, factor: x.factor, precio: x.precioVenta, esBase: x.esBase, paraVenta: x.paraVenta, codigos: x.codigos })),
  }));
}

export type FormaPago = { id: string; nombre: string; activa: boolean; cuentaId: string | null };

export async function formasDePago(soloActivas = true): Promise<FormaPago[]> {
  const supabase = await clienteServidor();
  let consulta = supabase.from("formas_pago").select("id, nombre, activa, cuenta_id").order("orden");
  if (soloActivas) consulta = consulta.eq("activa", true);
  const { data } = await consulta;
  return (data ?? []).map((f) => ({ id: f.id, nombre: f.nombre, activa: f.activa, cuentaId: f.cuenta_id }));
}

export type AjustesVenta = {
  tienda: string;
  ventaSinStock: "avisar" | "bloquear";
  deunaQr: string | null;
  banco: { banco?: string; tipo?: string; numero?: string; titular?: string; identificacion?: string };
  ticketAncho: 58 | 80;
  ticketMensaje: string;
  descuentoMaximo: string;
  alcoholDesde: string | null;
  alcoholHasta: string | null;
  correoResumen: string;
};

export function urlImagenTienda(ruta: string | null): string | null {
  return ruta ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/tienda/${ruta}` : null;
}

export async function ajustesVenta(): Promise<AjustesVenta> {
  const supabase = await clienteServidor();
  const { data: a } = await supabase
    .from("ajustes")
    .select("nombre_tienda, venta_sin_stock, deuna_qr_ruta, banco, ticket_ancho, ticket_mensaje, descuento_max_sin_autorizacion, alcohol_desde, alcohol_hasta, correo_resumen")
    .maybeSingle();
  return {
    tienda: a?.nombre_tienda ?? "Sandry",
    ventaSinStock: (a?.venta_sin_stock as "avisar" | "bloquear") ?? "avisar",
    deunaQr: urlImagenTienda(a?.deuna_qr_ruta ?? null),
    banco: (a?.banco as AjustesVenta["banco"]) ?? {},
    ticketAncho: (a?.ticket_ancho === 58 ? 58 : 80) as 58 | 80,
    ticketMensaje: a?.ticket_mensaje ?? "",
    descuentoMaximo: String(a?.descuento_max_sin_autorizacion ?? 5),
    alcoholDesde: a?.alcohol_desde?.slice(0, 5) ?? null,
    alcoholHasta: a?.alcohol_hasta?.slice(0, 5) ?? null,
    correoResumen: a?.correo_resumen ?? "",
  };
}

export type ClienteResumen = { id: string; nombre: string; identificacion: string; telefono: string; limite: string; saldo: string; activo: boolean; ultimaCompra: string | null };

export async function clientesConSaldo(): Promise<ClienteResumen[]> {
  const supabase = await clienteServidor();
  const { data } = await supabase.rpc("clientes_con_saldo");
  return (data ?? []).map((c) => ({
    id: c.id,
    nombre: c.nombre,
    identificacion: c.identificacion,
    telefono: c.telefono,
    limite: String(c.limite_credito),
    saldo: String(c.saldo),
    activo: c.activo,
    ultimaCompra: c.ultima_compra,
  }));
}

export type ResumenCaja = {
  id: string;
  estado: string;
  abiertaEn: string;
  cerradaEn: string | null;
  abiertaPor: string;
  fondo: string;
  ventas: number;
  totalVentas: string;
  porForma: Record<string, string>;
  abonos: string;
  esperado: string;
  contado: string | null;
  diferencia: string | null;
};

export async function resumenCaja(cajaId?: string): Promise<ResumenCaja | null> {
  const supabase = await clienteServidor();
  const { data } = await supabase.rpc("resumen_caja", { p_caja: cajaId });
  if (!data) return null;
  const r = data as Record<string, unknown>;
  const texto = (v: unknown) => (v === null || v === undefined ? null : String(v));
  return {
    id: String(r.id),
    estado: String(r.estado),
    abiertaEn: String(r.abierta_en),
    cerradaEn: texto(r.cerrada_en),
    abiertaPor: String(r.abierta_por ?? ""),
    fondo: String(r.fondo),
    ventas: Number(r.ventas),
    totalVentas: String(r.total_ventas),
    porForma: Object.fromEntries(Object.entries((r.por_forma as Record<string, number>) ?? {}).map(([k, v]) => [k, String(v)])),
    abonos: String(r.abonos),
    esperado: String(r.esperado),
    contado: texto(r.contado),
    diferencia: texto(r.diferencia),
  };
}

export async function cajaAbierta(): Promise<boolean> {
  const supabase = await clienteServidor();
  const { count } = await supabase.from("cajas").select("id", { count: "exact", head: true }).eq("estado", "abierta");
  if (count !== null) return count > 0;
  return false;
}

export async function favoritos(): Promise<string[]> {
  const supabase = await clienteServidor();
  const { data } = await supabase.rpc("productos_favoritos", { p_limite: 24 });
  return (data ?? []).map((f) => f.producto_id);
}

export type VentaDetalle = {
  id: string;
  numero: number;
  fecha: string;
  vendedor: string;
  cliente: { id: string; nombre: string; telefono: string } | null;
  subtotal: string;
  descuento: string;
  total: string;
  estado: string;
  motivoAnulacion: string | null;
  nota: string;
  lineas: { id: number; descripcion: string; cantidad: string; precio: string; descuento: string; total: string; devuelto: string; revisar: boolean }[];
  pagos: { forma: string; monto: string; referencia: string; recibido: string | null; cambio: string | null }[];
};

export async function obtenerVenta(id: string): Promise<VentaDetalle | null> {
  const supabase = await clienteServidor();
  const { data: v } = await supabase
    .from("ventas")
    .select(`id, numero, fecha, subtotal, descuento, total, estado, motivo_anulacion, nota,
      perfiles!ventas_usuario_id_fkey(nombre_completo), clientes(id, nombre, telefono),
      venta_lineas(id, descripcion, cantidad, precio, descuento, total, devuelto, revisar),
      venta_pagos(forma_pago_id, monto, referencia, recibido, cambio)`)
    .eq("id", id)
    .maybeSingle();
  if (!v) return null;
  const s = (x: unknown) => (x === null || x === undefined ? null : String(x));
  return {
    id: v.id,
    numero: v.numero,
    fecha: v.fecha,
    vendedor: (v.perfiles as unknown as { nombre_completo: string } | null)?.nombre_completo ?? "",
    cliente: (v.clientes as unknown as { id: string; nombre: string; telefono: string } | null) ?? null,
    subtotal: String(v.subtotal),
    descuento: String(v.descuento),
    total: String(v.total),
    estado: v.estado,
    motivoAnulacion: v.motivo_anulacion,
    nota: v.nota,
    lineas: [...v.venta_lineas]
      .sort((a, b) => a.id - b.id)
      .map((l) => ({
        id: l.id,
        descripcion: l.descripcion,
        cantidad: String(l.cantidad),
        precio: String(l.precio),
        descuento: String(l.descuento),
        total: String(l.total),
        devuelto: String(l.devuelto),
        revisar: l.revisar,
      })),
    pagos: v.venta_pagos.map((p) => ({ forma: p.forma_pago_id, monto: String(p.monto), referencia: p.referencia, recibido: s(p.recibido), cambio: s(p.cambio) })),
  };
}
