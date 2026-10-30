/**
 * Cálculos de compras, compartidos entre el navegador (también sin señal, en el
 * viaje) y el servidor. Montos siempre con decimales exactos.
 */
import { dec, leerNumero, type Dec } from "@/lib/dinero";
import type { UnidadBase } from "@/lib/catalogo";
import { normalizarTexto } from "@/lib/excel/productos";

/** Lo mínimo de un producto para comprarlo (se guarda en el celular para el viaje). */
export type ProductoLigero = {
  id: string;
  nombre: string;
  marca: string;
  sinonimos: string[];
  plu: string | null;
  unidadBase: UnidadBase;
  stock: string;
  costo: string | null; // por unidad base; null si no tiene permiso
  manejaCaducidad: boolean;
  presentaciones: { id: string; nombre: string; factor: string; esBase: boolean; paraCompra: boolean; codigos: string[] }[];
};

/** Una línea mientras se llena el formulario (todo como texto, tal cual se escribe). */
export type LineaCompra = {
  clave: string;
  productoId: string;
  presentacionId: string;
  cantidad: string;
  /** Costo de CADA presentación (ej. $9 la jaba) o de toda la línea, según `costoEs`. */
  costo: string;
  costoEs: "unidad" | "total";
  bonificacion: string;
  danados: string; // en unidad base («1 botella rota»)
  vence: string; // aaaa-mm-dd
};

export type DatosCompra = {
  id: string;
  proveedorId: string;
  viajeId?: string;
  pago: "contado" | "credito";
  cuentaId: string;
  vence: string;
  conFactura: boolean;
  numeroFactura: string;
  nota: string;
  /** Solo en un viaje: guardar el total y detallar después. */
  soloTotal: boolean;
  total: string;
  lineas: LineaCompra[];
  fotoRuta?: string | null;
};

export function lineaVacia(producto: ProductoLigero, presentacionId?: string): LineaCompra {
  const p =
    producto.presentaciones.find((x) => x.id === presentacionId) ??
    producto.presentaciones.find((x) => x.paraCompra && !x.esBase) ??
    producto.presentaciones.find((x) => x.esBase)!;
  // Se propone el último costo conocido (de esa presentación).
  const costo = producto.costo && Number(producto.costo) > 0 ? dec(producto.costo).times(p.factor).toDecimalPlaces(2).toString() : "";
  return {
    clave: `${producto.id}:${Date.now()}:${Math.random()}`,
    productoId: producto.id,
    presentacionId: p.id,
    cantidad: "1",
    costo,
    costoEs: "unidad",
    bonificacion: "",
    danados: "",
    vence: "",
  };
}

/** Costo total de la línea (lo que se pagó por ella). */
export function costoTotalLinea(l: Pick<LineaCompra, "cantidad" | "costo" | "costoEs">): Dec {
  const costo = leerNumero(l.costo) ?? dec(0);
  if (l.costoEs === "total") return costo.toDecimalPlaces(4);
  return (leerNumero(l.cantidad) ?? dec(0)).times(costo).toDecimalPlaces(4);
}

/** Costo por unidad base (jaba $9 ÷ 12 = $0.75). null si no hay cantidad. */
export function costoUnitarioLinea(l: LineaCompra, factor: string): Dec | null {
  const cantidad = leerNumero(l.cantidad);
  if (!cantidad || cantidad.lte(0)) return null;
  return costoTotalLinea(l).dividedBy(cantidad.times(factor)).toDecimalPlaces(4);
}

export function totalCompra(datos: Pick<DatosCompra, "soloTotal" | "total" | "lineas">): Dec {
  if (datos.soloTotal) return (leerNumero(datos.total) ?? dec(0)).toDecimalPlaces(2);
  return datos.lineas.reduce((t, l) => t.plus(costoTotalLinea(l)), dec(0)).toDecimalPlaces(2);
}

/** Revisa la compra antes de guardarla. Devuelve los problemas en español (vacío = todo bien). */
export function revisarCompra(datos: DatosCompra, productos: Map<string, ProductoLigero>): string[] {
  const errores: string[] = [];
  if (datos.pago === "contado" && !datos.cuentaId) errores.push("Elige de qué cuenta salió el dinero.");
  if (datos.pago === "credito" && !datos.proveedorId) errores.push("Para comprar a crédito elige el proveedor.");
  if (datos.soloTotal) {
    const total = leerNumero(datos.total);
    if (!total || total.lte(0)) errores.push("Escribe el total que pagaste.");
    return errores;
  }
  if (!datos.lineas.length) errores.push("Agrega al menos un producto.");
  datos.lineas.forEach((l, i) => {
    const p = productos.get(l.productoId);
    const nombre = p?.nombre ?? `Línea ${i + 1}`;
    const cantidad = leerNumero(l.cantidad);
    const bonif = l.bonificacion.trim() ? leerNumero(l.bonificacion) : dec(0);
    const danados = l.danados.trim() ? leerNumero(l.danados) : dec(0);
    const costo = l.costo.trim() ? leerNumero(l.costo) : dec(0);
    if (!cantidad || cantidad.isNegative()) errores.push(`${nombre}: la cantidad no es válida.`);
    if (!bonif || bonif.isNegative()) errores.push(`${nombre}: la bonificación no es válida.`);
    if (!danados || danados.isNegative()) errores.push(`${nombre}: los dañados no son válidos.`);
    if (!costo || costo.isNegative()) errores.push(`${nombre}: el costo no es válido.`);
    if (cantidad && bonif && cantidad.isZero() && bonif.isZero()) errores.push(`${nombre}: escribe cuántos compraste.`);
    if (cantidad && cantidad.gt(0) && costo && costo.isZero()) errores.push(`${nombre}: falta el costo (si fue regalo, ponlo en «bonificación»).`);
    const factor = p?.presentaciones.find((x) => x.id === l.presentacionId)?.factor ?? "1";
    if (cantidad && bonif && danados && danados.gt(cantidad.plus(bonif).times(factor))) {
      errores.push(`${nombre}: hay más dañados que lo que llegó.`);
    }
    if (l.vence && !/^\d{4}-\d{2}-\d{2}$/.test(l.vence)) errores.push(`${nombre}: la fecha de caducidad no es válida.`);
  });
  return errores;
}

/** Lo que recibe la función registrar_compra de la base de datos. */
export function armarCompra(datos: DatosCompra) {
  return {
    id: datos.id,
    proveedor_id: datos.proveedorId || null,
    viaje_id: datos.viajeId || null,
    pago: datos.pago,
    cuenta_id: datos.pago === "contado" ? datos.cuentaId : null,
    vence: datos.pago === "credito" ? datos.vence || null : null,
    con_factura: datos.conFactura,
    numero_factura: datos.numeroFactura.trim(),
    nota: datos.nota.trim(),
    foto_ruta: datos.fotoRuta ?? null,
    total: datos.soloTotal ? totalCompra(datos).toString() : null,
    lineas: datos.soloTotal ? [] : armarLineas(datos.lineas),
  };
}

export function armarLineas(lineas: LineaCompra[]) {
  return lineas.map((l) => ({
    producto_id: l.productoId,
    presentacion_id: l.presentacionId,
    cantidad: (leerNumero(l.cantidad) ?? dec(0)).toString(),
    costo_total: costoTotalLinea(l).toString(),
    bonificacion: (leerNumero(l.bonificacion) ?? dec(0)).toString(),
    danados: (leerNumero(l.danados) ?? dec(0)).toString(),
    vence: l.vence || null,
  }));
}

// ------------------------------------------------------------------ búsqueda sin internet

/**
 * Busca en la lista guardada en el celular: por código de barras exacto, por
 * código corto, o por todas las palabras escritas (sin tildes ni mayúsculas).
 */
/** Lo mínimo para buscar un producto (sirve para compras, ventas y conteos). */
export type Buscable = { id: string; nombre: string; marca: string; sinonimos: string[]; plu: string | null; presentaciones: { id: string; codigos: string[] }[] };

export function buscarLocal<T extends Buscable>(productos: T[], texto: string, limite = 12): { producto: T; presentacionId?: string }[] {
  const t = texto.trim();
  if (!t) return [];
  const codigo = t.replace(/\s/g, "");
  for (const p of productos) {
    const pres = p.presentaciones.find((x) => x.codigos.includes(codigo));
    if (pres) return [{ producto: p, presentacionId: pres.id }];
  }
  const plu = codigo.replace(/^0+(?=\d)/, "");
  const porPlu = productos.find((p) => p.plu && p.plu === plu);
  const palabras = normalizarTexto(t).split(" ").filter(Boolean);
  const resultado = productos
    .map((p) => {
      const pajar = normalizarTexto(`${p.nombre} ${p.marca} ${p.sinonimos.join(" ")}`);
      if (!palabras.every((w) => pajar.includes(w))) return null;
      const nombre = normalizarTexto(p.nombre);
      const puntos = (nombre.startsWith(palabras[0]) ? 2 : 0) + (nombre.includes(palabras.join(" ")) ? 1 : 0);
      return { producto: p, puntos };
    })
    .filter((x): x is { producto: T; puntos: number } => x !== null)
    .sort((a, b) => b.puntos - a.puntos || a.producto.nombre.localeCompare(b.producto.nombre, "es"))
    .map(({ producto }) => ({ producto }));
  if (porPlu) return [{ producto: porPlu }, ...resultado.filter((r) => r.producto.id !== porPlu.id)].slice(0, limite);
  return resultado.slice(0, limite);
}

// ------------------------------------------------------------------ resumen del viaje

/** Qué porcentaje son los gastos del viaje sobre lo comprado. */
export function porcentajeGastos(comprado: Dec, gastos: Dec): Dec | null {
  if (comprado.lte(0)) return null;
  return gastos.dividedBy(comprado).times(100).toDecimalPlaces(1);
}

/** Mensaje de WhatsApp para el pedido al preventista. */
export function textoPedido(tienda: string, lineas: { producto: string; presentacion: string; cantidad: string }[]): string {
  return [
    `Hola, pedido de ${tienda}:`,
    ...lineas.map((l) => `• ${l.cantidad} ${l.presentacion} — ${l.producto}`),
    "Gracias.",
  ].join("\n");
}

/** Enlace de WhatsApp. El teléfono ecuatoriano 09xxxxxxxx se convierte a 5939xxxxxxxx. */
export function enlaceWhatsApp(telefono: string, texto: string): string {
  let numero = telefono.replace(/\D/g, "");
  if (numero.startsWith("0")) numero = `593${numero.slice(1)}`;
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}
