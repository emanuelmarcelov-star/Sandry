import "server-only";
import { clienteServidor } from "@/lib/supabase/servidor";
import type { UsuarioActual } from "@/server/sesion";
import { puede } from "@/server/sesion";

/*
 * Lecturas del catálogo. Usan la sesión de la persona: la base de datos solo
 * devuelve lo que su rol puede ver (los costos, únicamente con "costos.ver").
 */

export type CategoriaPlana = {
  id: string;
  nombre: string;
  padreId: string | null;
  color: string;
  tarifaIva: string | null;
  margenObjetivo: string | null;
  orden: number;
  activa: boolean;
};

export async function listarCategorias(): Promise<CategoriaPlana[]> {
  const supabase = await clienteServidor();
  const { data } = await supabase
    .from("categorias")
    .select("id, nombre, padre_id, color, tarifa_iva, margen_objetivo, orden, activa")
    .order("orden")
    .order("nombre");
  return (data ?? []).map((c) => ({
    id: c.id,
    nombre: c.nombre,
    padreId: c.padre_id,
    color: c.color,
    tarifaIva: c.tarifa_iva,
    margenObjetivo: c.margen_objetivo === null ? null : String(c.margen_objetivo),
    orden: c.orden,
    activa: c.activa,
  }));
}

/** Categorías en orden de árbol con su nombre completo ("Bebidas › Gaseosas"). */
export function categoriasEnArbol(categorias: CategoriaPlana[]) {
  const resultado: (CategoriaPlana & { ruta: string; nivel: number })[] = [];
  const agregar = (padreId: string | null, ruta: string, nivel: number) => {
    for (const c of categorias.filter((x) => x.padreId === padreId)) {
      const r = ruta ? `${ruta} › ${c.nombre}` : c.nombre;
      resultado.push({ ...c, ruta: r, nivel });
      agregar(c.id, r, nivel + 1);
    }
  };
  agregar(null, "", 0);
  return resultado;
}

/** IVA y margen efectivos de cada categoría (heredados de la madre si no los tiene). */
export function valoresEfectivos(categorias: CategoriaPlana[]) {
  const porId = new Map(categorias.map((c) => [c.id, c]));
  const resolver = (id: string | null, campo: "tarifaIva" | "margenObjetivo"): string | null => {
    let actual = id ? porId.get(id) : undefined;
    while (actual) {
      if (actual[campo] !== null) return actual[campo];
      actual = actual.padreId ? porId.get(actual.padreId) : undefined;
    }
    return null;
  };
  return Object.fromEntries(
    categorias.map((c) => [c.id, { tarifaIva: resolver(c.id, "tarifaIva") ?? "15", margen: resolver(c.id, "margenObjetivo") ?? "25" }]),
  );
}

export type PresentacionCompleta = {
  id: string;
  nombre: string;
  factor: string;
  precioVenta: string | null;
  paraVenta: boolean;
  paraCompra: boolean;
  esBase: boolean;
  orden: number;
  codigos: string[];
};

export type ProductoCompleto = {
  id: string;
  nombre: string;
  marca: string;
  categoriaId: string | null;
  plu: string | null;
  sinonimos: string[];
  fotoRuta: string | null;
  unidadBase: "unidad" | "libra" | "kilo" | "litro";
  tarifaIva: "15" | "0" | "exento";
  stockMinimo: string;
  manejaCaducidad: boolean;
  retornable: boolean;
  soloMayores: boolean;
  ubicacion: string;
  activo: boolean;
  pendiente: boolean;
  stock: string;
  costo: string | null; // null si no tiene permiso
  presentaciones: PresentacionCompleta[];
};

const CAMPOS_PRODUCTO = `id, nombre, marca, categoria_id, plu, sinonimos, foto_ruta, unidad_base, tarifa_iva, stock_minimo,
  maneja_caducidad, retornable, solo_mayores, ubicacion, activo, pendiente,
  existencias(cantidad),
  presentaciones(id, nombre, factor, precio_venta, para_venta, para_compra, es_base, orden, activa),
  codigos_barras(codigo, presentacion_id)`;

type FilaProducto = {
  id: string; nombre: string; marca: string; categoria_id: string | null; plu: string | null; sinonimos: string[];
  foto_ruta: string | null; unidad_base: string; tarifa_iva: string; stock_minimo: number; maneja_caducidad: boolean;
  retornable: boolean; solo_mayores: boolean; ubicacion: string; activo: boolean; pendiente: boolean;
  existencias: { cantidad: number } | { cantidad: number }[] | null;
  presentaciones: { id: string; nombre: string; factor: number; precio_venta: number | null; para_venta: boolean; para_compra: boolean; es_base: boolean; orden: number; activa: boolean }[];
  codigos_barras: { codigo: string; presentacion_id: string | null }[];
};

function armar(f: FilaProducto, costos: Map<string, string>): ProductoCompleto {
  const existencia = Array.isArray(f.existencias) ? f.existencias[0] : f.existencias;
  const base = f.presentaciones.find((p) => p.es_base && p.activa);
  const presentaciones = f.presentaciones
    .filter((p) => p.activa)
    .sort((a, b) => Number(b.es_base) - Number(a.es_base) || Number(a.factor) - Number(b.factor) || a.orden - b.orden)
    .map((p) => ({
      id: p.id,
      nombre: p.nombre,
      factor: String(p.factor),
      precioVenta: p.precio_venta === null ? null : String(p.precio_venta),
      paraVenta: p.para_venta,
      paraCompra: p.para_compra,
      esBase: p.es_base,
      orden: p.orden,
      codigos: f.codigos_barras
        .filter((c) => c.presentacion_id === p.id || (c.presentacion_id === null && p.id === base?.id))
        .map((c) => c.codigo),
    }));
  return {
    id: f.id,
    nombre: f.nombre,
    marca: f.marca,
    categoriaId: f.categoria_id,
    plu: f.plu,
    sinonimos: f.sinonimos,
    fotoRuta: f.foto_ruta,
    unidadBase: f.unidad_base as ProductoCompleto["unidadBase"],
    tarifaIva: f.tarifa_iva as ProductoCompleto["tarifaIva"],
    stockMinimo: String(f.stock_minimo),
    manejaCaducidad: f.maneja_caducidad,
    retornable: f.retornable,
    soloMayores: f.solo_mayores,
    ubicacion: f.ubicacion,
    activo: f.activo,
    pendiente: f.pendiente,
    stock: String(existencia?.cantidad ?? 0),
    costo: costos.get(f.id) ?? null,
    presentaciones,
  };
}

async function costosDe(ids: string[], usuario: UsuarioActual): Promise<Map<string, string>> {
  if (!puede(usuario, "costos.ver") || !ids.length) return new Map();
  const supabase = await clienteServidor();
  const mapa = new Map<string, string>();
  // De a 200 para no pasar el largo máximo de la dirección.
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await supabase.from("producto_costos").select("producto_id, costo_promedio").in("producto_id", ids.slice(i, i + 200));
    for (const c of data ?? []) mapa.set(c.producto_id, String(c.costo_promedio));
  }
  return mapa;
}

export async function obtenerProducto(id: string, usuario: UsuarioActual): Promise<ProductoCompleto | null> {
  const supabase = await clienteServidor();
  const { data } = await supabase.from("productos").select(CAMPOS_PRODUCTO).eq("id", id).maybeSingle();
  if (!data) return null;
  return armar(data as unknown as FilaProducto, await costosDe([id], usuario));
}

/** Lista o búsqueda de productos (por nombre, apodo, código o PLU). */
export async function buscarProductos(
  usuario: UsuarioActual,
  opciones: { texto?: string; categoriaId?: string; incluirInactivos?: boolean; limite?: number } = {},
): Promise<ProductoCompleto[]> {
  const supabase = await clienteServidor();
  const { data: encontrados } = await supabase.rpc("buscar_productos", {
    p_texto: opciones.texto ?? "",
    p_limite: opciones.limite ?? 300,
    p_categoria: opciones.categoriaId || undefined,
    p_incluir_inactivos: opciones.incluirInactivos ?? false,
  });
  const ids = (encontrados ?? []).map((p) => p.id);
  if (!ids.length) return [];

  const filas: FilaProducto[] = [];
  for (let i = 0; i < ids.length; i += 150) {
    const { data } = await supabase.from("productos").select(CAMPOS_PRODUCTO).in("id", ids.slice(i, i + 150));
    filas.push(...((data ?? []) as unknown as FilaProducto[]));
  }
  const orden = new Map(ids.map((id, i) => [id, i]));
  filas.sort((a, b) => orden.get(a.id)! - orden.get(b.id)!);
  const costos = await costosDe(ids, usuario);
  return filas.map((f) => armar(f, costos));
}

export function urlFotoProducto(ruta: string | null): string | null {
  if (!ruta) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return `${base}/storage/v1/object/public/fotos-productos/${ruta}`;
}
