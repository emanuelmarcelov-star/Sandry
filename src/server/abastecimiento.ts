import "server-only";
import { clienteServidor } from "@/lib/supabase/servidor";
import type { ProductoLigero } from "@/lib/compras";
import { buscarProductos } from "@/server/catalogo";
import type { UsuarioActual } from "@/server/sesion";

export type Proveedor = {
  id: string;
  nombre: string;
  tipo: string;
  ruc: string;
  contacto: string;
  telefono: string;
  direccion: string;
  diasVisita: number[];
  condiciones: string;
  notas: string;
  activo: boolean;
};
export type Cuenta = { id: string; nombre: string; tipo: string; activa: boolean };
export type CategoriaGasto = { id: string; nombre: string; esTransporte: boolean };

/** Todos los productos activos, livianos, para comprar (y guardarlos en el celular). */
export async function productosParaCompra(usuario: UsuarioActual): Promise<ProductoLigero[]> {
  const productos = await buscarProductos(usuario, { limite: 20000 });
  return productos.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    marca: p.marca,
    sinonimos: p.sinonimos,
    plu: p.plu,
    unidadBase: p.unidadBase,
    stock: p.stock,
    costo: p.costo,
    manejaCaducidad: p.manejaCaducidad,
    presentaciones: p.presentaciones.map((x) => ({
      id: x.id,
      nombre: x.nombre,
      factor: x.factor,
      esBase: x.esBase,
      paraCompra: x.paraCompra,
      codigos: x.codigos,
    })),
  }));
}

export async function listarProveedores(soloActivos = false): Promise<Proveedor[]> {
  const supabase = await clienteServidor();
  let consulta = supabase.from("proveedores").select("*").order("nombre");
  if (soloActivos) consulta = consulta.eq("activo", true);
  const { data } = await consulta;
  return (data ?? []).map((p) => ({
    id: p.id,
    nombre: p.nombre,
    tipo: p.tipo,
    ruc: p.ruc,
    contacto: p.contacto,
    telefono: p.telefono,
    direccion: p.direccion,
    diasVisita: p.dias_visita ?? [],
    condiciones: p.condiciones,
    notas: p.notas,
    activo: p.activo,
  }));
}

export async function listarCuentas(soloActivas = true): Promise<Cuenta[]> {
  const supabase = await clienteServidor();
  let consulta = supabase.from("cuentas_dinero").select("id, nombre, tipo, activa").order("orden");
  if (soloActivas) consulta = consulta.eq("activa", true);
  const { data } = await consulta;
  return data ?? [];
}

export async function categoriasGasto(): Promise<CategoriaGasto[]> {
  const supabase = await clienteServidor();
  const { data } = await supabase.from("categorias_gasto").select("id, nombre, es_transporte").eq("activa", true).order("orden");
  return (data ?? []).map((c) => ({ id: c.id, nombre: c.nombre, esTransporte: c.es_transporte }));
}

export type ResumenCompra = {
  id: string;
  fecha: string;
  lugar: string;
  estado: string;
  pago: string;
  total: string;
  conFactura: boolean;
  lineas: number;
  viajeId: string | null;
};

export async function listarCompras(limite = 100): Promise<ResumenCompra[]> {
  const supabase = await clienteServidor();
  const { data } = await supabase
    .from("compras")
    .select("id, fecha, estado, pago, total, con_factura, viaje_id, proveedores(nombre), compra_lineas(count)")
    .order("fecha", { ascending: false })
    .limit(limite);
  return (data ?? []).map((c) => ({
    id: c.id,
    fecha: c.fecha,
    lugar: (c.proveedores as { nombre: string } | null)?.nombre ?? "",
    estado: c.estado,
    pago: c.pago,
    total: String(c.total),
    conFactura: c.con_factura,
    lineas: (c.compra_lineas as unknown as { count: number }[])[0]?.count ?? 0,
    viajeId: c.viaje_id,
  }));
}

export type LineaGuardada = {
  id: number;
  productoId: string;
  producto: string;
  unidadBase: string;
  presentacionId: string;
  presentacion: string;
  factor: string;
  cantidad: string;
  costoTotal: string;
  bonificacion: string;
  danados: string;
  recibido: string | null;
  vence: string | null;
};

export type CompraDetalle = {
  id: string;
  fecha: string;
  proveedorId: string | null;
  lugar: string;
  estado: string;
  pago: string;
  cuentaId: string | null;
  cuenta: string;
  total: string;
  conFactura: boolean;
  numeroFactura: string;
  nota: string;
  lineas: LineaGuardada[];
};

const CAMPOS_COMPRA = `id, fecha, proveedor_id, estado, pago, cuenta_id, total, con_factura, numero_factura, nota,
  proveedores(nombre), cuentas_dinero(nombre),
  compra_lineas(id, producto_id, presentacion_id, factor, cantidad, costo_total, bonificacion, danados, recibido, vence,
    productos(nombre, unidad_base), presentaciones(nombre))`;

type FilaCompra = {
  id: string; fecha: string; proveedor_id: string | null; estado: string; pago: string; cuenta_id: string | null;
  total: number; con_factura: boolean; numero_factura: string; nota: string;
  proveedores: { nombre: string } | null; cuentas_dinero: { nombre: string } | null;
  compra_lineas: {
    id: number; producto_id: string; presentacion_id: string; factor: number; cantidad: number; costo_total: number;
    bonificacion: number; danados: number; recibido: number | null; vence: string | null;
    productos: { nombre: string; unidad_base: string } | null; presentaciones: { nombre: string } | null;
  }[];
};

function armarCompra(c: FilaCompra): CompraDetalle {
  return {
    id: c.id,
    fecha: c.fecha,
    proveedorId: c.proveedor_id,
    lugar: c.proveedores?.nombre ?? "",
    estado: c.estado,
    pago: c.pago,
    cuentaId: c.cuenta_id,
    cuenta: c.cuentas_dinero?.nombre ?? "",
    total: String(c.total),
    conFactura: c.con_factura,
    numeroFactura: c.numero_factura,
    nota: c.nota,
    lineas: [...c.compra_lineas]
      .sort((a, b) => a.id - b.id)
      .map((l) => ({
        id: l.id,
        productoId: l.producto_id,
        producto: l.productos?.nombre ?? "",
        unidadBase: l.productos?.unidad_base ?? "unidad",
        presentacionId: l.presentacion_id,
        presentacion: l.presentaciones?.nombre ?? "",
        factor: String(l.factor),
        cantidad: String(l.cantidad),
        costoTotal: String(l.costo_total),
        bonificacion: String(l.bonificacion),
        danados: String(l.danados),
        recibido: l.recibido === null ? null : String(l.recibido),
        vence: l.vence,
      })),
  };
}

export async function obtenerCompra(id: string): Promise<CompraDetalle | null> {
  const supabase = await clienteServidor();
  const { data } = await supabase.from("compras").select(CAMPOS_COMPRA).eq("id", id).maybeSingle();
  return data ? armarCompra(data as unknown as FilaCompra) : null;
}

export type ViajeDetalle = {
  id: string;
  inicio: string;
  estado: string;
  lista: { productoId: string; nombre: string; unidadBase: string; cantidad: string | null; tachado: boolean }[];
  compras: CompraDetalle[];
  gastos: { id: string; categoria: string; descripcion: string; monto: string; cuenta: string }[];
};

export async function obtenerViaje(id: string): Promise<ViajeDetalle | null> {
  const supabase = await clienteServidor();
  const { data: v } = await supabase.from("viajes").select("id, inicio, estado").eq("id", id).maybeSingle();
  if (!v) return null;
  const [{ data: lista }, { data: compras }, { data: gastos }] = await Promise.all([
    supabase.from("viaje_lista").select("producto_id, cantidad, tachado, productos(nombre, unidad_base)").eq("viaje_id", id),
    supabase.from("compras").select(CAMPOS_COMPRA).eq("viaje_id", id).order("fecha"),
    supabase.from("gastos").select("id, descripcion, monto, categorias_gasto(nombre), cuentas_dinero(nombre)").eq("viaje_id", id).order("fecha"),
  ]);
  return {
    id: v.id,
    inicio: v.inicio,
    estado: v.estado,
    lista: (lista ?? [])
      .map((l) => {
        const p = l.productos as { nombre: string; unidad_base: string } | null;
        return {
          productoId: l.producto_id,
          nombre: p?.nombre ?? "",
          unidadBase: p?.unidad_base ?? "unidad",
          cantidad: l.cantidad === null ? null : String(l.cantidad),
          tachado: l.tachado,
        };
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    compras: ((compras ?? []) as unknown as FilaCompra[]).map(armarCompra),
    gastos: (gastos ?? []).map((g) => ({
      id: g.id,
      categoria: (g.categorias_gasto as { nombre: string } | null)?.nombre ?? "",
      descripcion: g.descripcion,
      monto: String(g.monto),
      cuenta: (g.cuentas_dinero as { nombre: string } | null)?.nombre ?? "",
    })),
  };
}

/** El viaje en curso más reciente (para continuarlo en otro dispositivo). */
export async function viajeEnCurso(): Promise<ViajeDetalle | null> {
  const supabase = await clienteServidor();
  const { data } = await supabase.from("viajes").select("id").eq("estado", "en_curso").order("inicio", { ascending: false }).limit(1);
  return data?.[0] ? obtenerViaje(data[0].id) : null;
}

export type Sugerido = {
  productoId: string;
  nombre: string;
  unidadBase: string;
  stock: string;
  stockMinimo: string;
  sugerido: string;
  proveedorId: string | null;
  proveedor: string;
};

export async function listaSugerida(): Promise<Sugerido[]> {
  const supabase = await clienteServidor();
  const { data } = await supabase.rpc("lista_sugerida");
  return (data ?? []).map((s) => ({
    productoId: s.producto_id,
    nombre: s.nombre,
    unidadBase: s.unidad_base,
    stock: String(s.stock),
    stockMinimo: String(s.stock_minimo),
    sugerido: String(s.sugerido),
    proveedorId: s.proveedor_id,
    proveedor: s.proveedor,
  }));
}
