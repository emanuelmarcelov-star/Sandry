"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import ExcelJS from "exceljs";
import { clienteServidor } from "@/lib/supabase/servidor";
import { mensajeError, type Resultado } from "@/lib/errores";
import { erroresPorCampo } from "@/lib/esquemas/usuarios";
import { esquemaCategoria, esquemaProducto, separarCodigos, type DatosCategoria, type DatosProducto } from "@/lib/esquemas/catalogo";
import { dec, leerNumero } from "@/lib/dinero";
import {
  armarImportacion,
  buscarCategoria,
  COLUMNAS_PRODUCTOS,
  mapearEncabezados,
  normalizarPlu,
  normalizarTexto,
  revisarFilas,
  textoDeCelda,
  type ContextoImportacion,
  type FilaProducto,
  type ProductoActual,
} from "@/lib/excel/productos";
import type { TarifaIva } from "@/lib/catalogo";
import type { Json } from "@/lib/supabase/tipos";
import { puede, requerirPermiso } from "@/server/sesion";
import { buscarProductos, itemsDeEtiqueta, listarCategorias, valoresEfectivos, type ItemEtiqueta } from "@/server/catalogo";

const numero = (t: string) => (t.trim() === "" ? null : leerNumero(t)!.toString());

// ------------------------------------------------------------------ productos

export async function guardarProducto(datos: DatosProducto): Promise<Resultado<{ id: string }>> {
  const yo = await requerirPermiso("productos.editar");
  const revisado = esquemaProducto.safeParse(datos);
  if (!revisado.success) return { ok: false, mensaje: "Revisa los datos marcados.", campos: erroresPorCampo(revisado.error) };
  const d = revisado.data;
  const supabase = await clienteServidor();

  const payload = {
    ...(d.id ? { id: d.id } : {}),
    nombre: d.nombre,
    marca: d.marca,
    categoria_id: d.categoriaId || null,
    plu: d.plu ? normalizarPlu(d.plu) : null,
    sinonimos: d.sinonimos.split(",").map((s) => s.trim()).filter(Boolean),
    foto_ruta: d.fotoRuta || null,
    unidad_base: d.unidadBase,
    tarifa_iva: d.tarifaIva,
    stock_minimo: numero(d.stockMinimo) ?? "0",
    maneja_caducidad: d.manejaCaducidad,
    retornable: d.retornable,
    solo_mayores: d.soloMayores,
    ubicacion: d.ubicacion,
    activo: d.activo,
    presentaciones: d.presentaciones.map((p, i) => ({
      ...(p.id ? { id: p.id } : {}),
      nombre: p.nombre,
      factor: p.esBase ? "1" : numero(p.factor),
      precio_venta: numero(p.precioVenta),
      para_venta: p.paraVenta,
      para_compra: p.paraCompra,
      es_base: p.esBase,
      orden: i,
      codigos: separarCodigos(p.codigos),
    })),
    // Sin IVA: el costo es el que escribe la tienda (si algo lleva IVA, ella ya lo suma).
    ...(puede(yo, "costos.ver") && d.costoUnitario.trim() ? { costo_unitario: numero(d.costoUnitario) } : {}),
    ...(!d.id && d.stockInicial.trim() ? { stock_inicial: numero(d.stockInicial) } : {}),
  };

  const { data, error } = await supabase.rpc("guardar_producto", { p: payload });
  if (error) return { ok: false, mensaje: mensajeError(error, "No se pudo guardar el producto.") };
  revalidatePath("/catalogo");
  return { ok: true, datos: { id: data as string }, mensaje: "Producto guardado." };
}

export type TipoAjuste = "compra" | "conteo" | "merma" | "caducado" | "robo" | "autoconsumo" | "regalo";

/**
 * Ajuste rápido de stock desde la ficha del producto. La cantidad viene en la
 * presentación elegida (ej. 2 jabas) y se convierte a unidad base. Al sumar,
 * la base de datos usa el costo que ya tiene el producto (no se vuelve a pedir).
 */
export async function ajustarStock(entrada: {
  productoId: string;
  tipo: TipoAjuste;
  cantidad: string;
  factor: string;
  nota: string;
}): Promise<Resultado<{ saldo: string }>> {
  await requerirPermiso(entrada.tipo === "compra" ? "compras.registrar" : "inventario.ajustar");
  const cantidad = leerNumero(entrada.cantidad);
  const factor = leerNumero(entrada.factor) ?? dec(1);
  if (!cantidad || cantidad.isNegative() || (entrada.tipo !== "conteo" && cantidad.isZero())) {
    return { ok: false, mensaje: "Escribe una cantidad mayor que 0.", campos: { cantidad: "Cantidad no válida." } };
  }

  const supabase = await clienteServidor();
  const { data, error } = await supabase.rpc("ajustar_stock", {
    p_producto: entrada.productoId,
    p_tipo: entrada.tipo,
    p_cantidad: Number(cantidad.times(factor).toDecimalPlaces(3).toString()),
    p_nota: entrada.nota.trim(),
  });
  if (error) return { ok: false, mensaje: mensajeError(error, "No se pudo ajustar el stock.") };
  revalidatePath("/catalogo", "layout");
  return { ok: true, datos: { saldo: String(data) }, mensaje: "Stock actualizado." };
}

export async function sugerirPlu(): Promise<string | null> {
  await requerirPermiso("productos.editar");
  const supabase = await clienteServidor();
  const { data } = await supabase.rpc("siguiente_plu");
  return (data as string | null) ?? null;
}

export async function generarCodigoInterno(): Promise<Resultado<{ codigo: string }>> {
  await requerirPermiso("productos.editar");
  const supabase = await clienteServidor();
  const { data, error } = await supabase.rpc("generar_codigo_interno");
  if (error) return { ok: false, mensaje: mensajeError(error) };
  return { ok: true, datos: { codigo: data as string } };
}

/** Pone código interno a los productos que no tienen (para etiquetas y hoja de códigos). */
export async function asignarCodigosInternos(productoIds: string[]): Promise<Resultado<{ codigos: Record<string, string> }>> {
  await requerirPermiso("productos.editar");
  const supabase = await clienteServidor();
  const codigos: Record<string, string> = {};
  for (const id of productoIds) {
    const { data, error } = await supabase.rpc("asignar_codigo_interno", { p_producto: id });
    if (error) return { ok: false, mensaje: mensajeError(error) };
    codigos[id] = data as string;
  }
  revalidatePath("/catalogo", "layout");
  return { ok: true, datos: { codigos } };
}

/** Búsqueda para agregar productos a la lista de etiquetas. */
export async function buscarParaEtiquetas(texto: string): Promise<ItemEtiqueta[]> {
  const yo = await requerirPermiso("productos.editar");
  if (!texto.trim()) return [];
  return itemsDeEtiqueta(await buscarProductos(yo, { texto, limite: 15 }));
}

export async function marcarEtiquetasImpresas(presentacionIds: string[]): Promise<Resultado> {
  await requerirPermiso("productos.editar");
  const supabase = await clienteServidor();
  const { error } = await supabase.rpc("marcar_etiquetas_impresas", { p_presentaciones: presentacionIds });
  if (error) return { ok: false, mensaje: mensajeError(error) };
  revalidatePath("/catalogo", "layout");
  return { ok: true, mensaje: "Listo, quitadas de «por reimprimir»." };
}

// ------------------------------------------------------------------ fotos

const TIPOS_FOTO = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

async function subirImagen(contenido: Blob, tipo: string): Promise<Resultado<{ ruta: string }>> {
  const extension = TIPOS_FOTO.get(tipo);
  if (!extension) return { ok: false, mensaje: "La foto debe ser JPG, PNG o WEBP." };
  if (contenido.size > 3 * 1024 * 1024) return { ok: false, mensaje: "La foto pesa más de 3 MB." };
  const ruta = `${randomUUID()}.${extension}`;
  const supabase = await clienteServidor();
  const { error } = await supabase.storage.from("fotos-productos").upload(ruta, contenido, { contentType: tipo });
  if (error) return { ok: false, mensaje: "No se pudo subir la foto." };
  return { ok: true, datos: { ruta } };
}

export async function subirFotoProducto(formulario: FormData): Promise<Resultado<{ ruta: string }>> {
  await requerirPermiso("productos.editar");
  const foto = formulario.get("foto");
  if (!(foto instanceof File) || !foto.size) return { ok: false, mensaje: "No llegó ninguna foto." };
  return subirImagen(foto, foto.type);
}

// ------------------------------------------------------------------ Open Food Facts

export type DatosOpenFoodFacts = { nombre: string; marca: string; foto: string | null };

/** Busca nombre, marca y foto de un producto por su código en Open Food Facts (gratis). */
export async function buscarEnOpenFoodFacts(codigo: string): Promise<Resultado<DatosOpenFoodFacts>> {
  await requerirPermiso("productos.editar");
  if (!/^\d{8,14}$/.test(codigo)) return { ok: false, mensaje: "Ese código no es de un producto de supermercado." };
  try {
    const respuesta = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${codigo}.json?fields=product_name,product_name_es,brands,quantity,image_front_url`,
      { headers: { "User-Agent": "Sandry/1.0 (tienda de barrio; tiendasandry.ec@gmail.com)" }, signal: AbortSignal.timeout(8000) },
    );
    const json = (await respuesta.json()) as {
      status?: number;
      product?: { product_name?: string; product_name_es?: string; brands?: string; quantity?: string; image_front_url?: string };
    };
    if (json.status !== 1 || !json.product) return { ok: false, mensaje: "No se encontró en Open Food Facts. Llena los datos a mano." };
    const p = json.product;
    const nombreBase = (p.product_name_es || p.product_name || "").trim();
    const nombre = [nombreBase, p.quantity && !nombreBase.includes(p.quantity) ? p.quantity : ""].filter(Boolean).join(" ");
    return {
      ok: true,
      datos: { nombre, marca: (p.brands ?? "").split(",")[0].trim(), foto: p.image_front_url ?? null },
    };
  } catch {
    return { ok: false, mensaje: "No se pudo consultar Open Food Facts. Revisa la conexión o llena los datos a mano." };
  }
}

/** Descarga la foto de Open Food Facts y la guarda en las fotos de la tienda. */
export async function guardarFotoDesdeOpenFoodFacts(url: string): Promise<Resultado<{ ruta: string }>> {
  await requerirPermiso("productos.editar");
  if (!/^https:\/\/images\.openfoodfacts\.org\//.test(url)) return { ok: false, mensaje: "Dirección de foto no válida." };
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const tipo = r.headers.get("content-type")?.split(";")[0] ?? "";
    return subirImagen(await r.blob(), tipo);
  } catch {
    return { ok: false, mensaje: "No se pudo descargar la foto." };
  }
}

// ------------------------------------------------------------------ categorías

export async function guardarCategoria(datos: DatosCategoria): Promise<Resultado<{ id: string }>> {
  await requerirPermiso("productos.editar");
  const revisado = esquemaCategoria.safeParse(datos);
  if (!revisado.success) return { ok: false, mensaje: "Revisa los datos.", campos: erroresPorCampo(revisado.error) };
  const d = revisado.data;
  const supabase = await clienteServidor();
  const { data, error } = await supabase.rpc("guardar_categoria", {
    p: {
      ...(d.id ? { id: d.id } : {}),
      nombre: d.nombre,
      padre_id: d.padreId || null,
      color: d.color,
      tarifa_iva: d.tarifaIva || null,
      margen_objetivo: numero(d.margenObjetivo),
      activa: d.activa,
    },
  });
  if (error) return { ok: false, mensaje: mensajeError(error, "No se pudo guardar la categoría.") };
  revalidatePath("/catalogo", "layout");
  return { ok: true, datos: { id: data as string }, mensaje: "Categoría guardada." };
}

// ------------------------------------------------------------------ importar desde Excel

async function contextoImportacion(): Promise<{ contexto: ContextoImportacion; actuales: Map<string, ProductoActual> }> {
  const yo = await requerirPermiso("productos.editar");
  const [categorias, productos] = await Promise.all([
    listarCategorias(),
    buscarProductos(yo, { incluirInactivos: true, limite: 20000 }),
  ]);
  const actuales = new Map<string, ProductoActual>(
    productos.map((p) => [
      p.id,
      { ...p, presentaciones: p.presentaciones.map((x) => ({ ...x })) },
    ]),
  );
  return {
    contexto: {
      puedeVerCostos: puede(yo, "costos.ver"),
      categorias: categorias.map((c) => ({ id: c.id, nombre: c.nombre, padreId: c.padreId })),
      productos: productos.map((p) => ({
        id: p.id,
        nombre: p.nombre,
        marca: p.marca,
        plu: p.plu,
        codigos: p.presentaciones.flatMap((x) => x.codigos),
      })),
    },
    actuales,
  };
}

export type LecturaExcel = { filas: FilaProducto[]; contexto: ContextoImportacion; avisos: string[] };

/** Lee la hoja «Productos» del archivo subido. Todavía no guarda nada. */
export async function leerExcelProductos(formulario: FormData): Promise<Resultado<LecturaExcel>> {
  const { contexto } = await contextoImportacion();
  const archivo = formulario.get("archivo");
  if (!(archivo instanceof File) || !archivo.size) return { ok: false, mensaje: "Elige un archivo de Excel (.xlsx)." };
  if (archivo.size > 10 * 1024 * 1024) return { ok: false, mensaje: "El archivo pesa más de 10 MB." };

  const libro = new ExcelJS.Workbook();
  try {
    await libro.xlsx.load(await archivo.arrayBuffer());
  } catch {
    return { ok: false, mensaje: "No se pudo leer el archivo. Debe ser un Excel .xlsx (no .xls ni .csv)." };
  }
  const hoja = libro.worksheets.find((h) => normalizarTexto(h.name) === "productos") ?? libro.worksheets[0];
  if (!hoja) return { ok: false, mensaje: "El archivo no tiene hojas." };

  const titulos: string[] = [];
  hoja.getRow(1).eachCell({ includeEmpty: true }, (celda, col) => (titulos[col - 1] = textoDeCelda(celda.value)));
  const mapa = mapearEncabezados(titulos);
  if (mapa.nombre === undefined && mapa.codigoBarras === undefined) {
    return { ok: false, mensaje: "No encontré las columnas «Nombre» o «Código de barras» en la primera fila. Usa la plantilla de Sandry." };
  }

  const filas: FilaProducto[] = [];
  hoja.eachRow({ includeEmpty: false }, (fila, numeroFila) => {
    if (numeroFila === 1) return;
    const valores = Object.fromEntries(
      COLUMNAS_PRODUCTOS.map((c) => {
        const col = mapa[c.clave];
        return [c.clave, col === undefined ? "" : textoDeCelda(fila.getCell(col + 1).value)];
      }),
    ) as Record<(typeof COLUMNAS_PRODUCTOS)[number]["clave"], string>;
    if (Object.values(valores).some((v) => v.trim() !== "")) filas.push({ fila: numeroFila, ...valores });
  });
  if (!filas.length) return { ok: false, mensaje: "La hoja «Productos» está vacía." };
  if (filas.length > 5000) return { ok: false, mensaje: "Son más de 5.000 filas. Divide el archivo en partes." };

  const avisos: string[] = [];
  for (const nombre of ["compras", "gastos"]) {
    const otra = libro.worksheets.find((h) => normalizarTexto(h.name) === nombre);
    if (otra && otra.actualRowCount > 1) {
      avisos.push(`La hoja «${otra.name}» tiene datos: se podrá importar cuando esté lista la fase de ${nombre}. Por ahora solo se cargan productos.`);
    }
  }
  return { ok: true, datos: { filas, contexto, avisos } };
}

/** Guarda lo revisado. Vuelve a revisar todo en el servidor con datos frescos. */
export async function confirmarImportacion(entrada: {
  filas: FilaProducto[];
  crearCategorias: boolean;
  unirParecidos: number[];
}): Promise<Resultado<{ nuevos: number; actualizados: number }>> {
  const { contexto, actuales } = await contextoImportacion();
  const { filas: revisadas, categoriasNuevas } = revisarFilas(entrada.filas, contexto);
  const conErrores = revisadas.filter((f) => f.errores.length);
  if (conErrores.length) {
    return { ok: false, mensaje: `Hay ${conErrores.length} fila(s) con errores. Corrígelas antes de guardar.` };
  }
  if (categoriasNuevas.length && !entrada.crearCategorias) {
    return { ok: false, mensaje: `Hay categorías nuevas (${categoriasNuevas.join(", ")}). Marca «Crear las categorías nuevas» o corrígelas.` };
  }

  const supabase = await clienteServidor();
  const categorias = [...contexto.categorias];
  const crear = async (nombre: string, padreId: string | null) => {
    const { data, error } = await supabase.rpc("guardar_categoria", { p: { nombre, padre_id: padreId } });
    if (error) throw new Error(mensajeError(error));
    const nueva = { id: data as string, nombre, padreId };
    categorias.push(nueva);
    return nueva;
  };
  const ids = new Map<string, string>();
  try {
    for (const f of revisadas) {
      const d = f.datos;
      if (!d?.categoria) continue;
      const clave = `${normalizarTexto(d.categoria)}|${normalizarTexto(d.subcategoria ?? "")}`;
      if (ids.has(clave)) continue;
      const madre =
        buscarCategoria(categorias, d.categoria, null) ?? buscarCategoria(categorias, d.categoria) ?? (await crear(d.categoria, null));
      let destino = madre;
      if (d.subcategoria) {
        destino = buscarCategoria(categorias, d.subcategoria, madre.id) ?? (await crear(d.subcategoria, madre.id));
      }
      ids.set(clave, destino.id);
    }
  } catch (e) {
    return { ok: false, mensaje: e instanceof Error ? e.message : "No se pudieron crear las categorías." };
  }

  const efectivos = valoresEfectivos(await listarCategorias());
  const { productos } = armarImportacion(revisadas, {
    unirParecidos: new Set(entrada.unirParecidos),
    actuales,
    categoriaId: (c, s) => (c ? (ids.get(`${normalizarTexto(c)}|${normalizarTexto(s ?? "")}`) ?? null) : null),
    ivaDeCategoria: (id) => ((id && efectivos[id]?.tarifaIva) || "15") as TarifaIva,
  });
  if (!productos.length) return { ok: false, mensaje: "No hay filas para guardar." };

  const { data, error } = await supabase.rpc("importar_productos", { p_productos: productos as unknown as Json });
  if (error) return { ok: false, mensaje: mensajeError(error, "No se pudo importar.") };
  revalidatePath("/catalogo", "layout");
  const r = data as { creados: number; actualizados: number; stock_corregido?: number };
  const corregidos = r.stock_corregido ? ` Se corrigió el stock de ${r.stock_corregido}.` : "";
  return {
    ok: true,
    datos: { nuevos: r.creados, actualizados: r.actualizados },
    mensaje: `Listo: ${r.creados} producto(s) nuevo(s) y ${r.actualizados} actualizado(s).${corregidos}`,
  };
}
