/**
 * Lógica del punto de venta, sin pantalla: carrito, totales (igual que el
 * servidor), cambio en billetes, detección del lector de códigos y códigos de
 * balanza. Todo con decimales exactos.
 */
import { dec, leerNumero, type Dec } from "@/lib/dinero";
import type { UnidadBase } from "@/lib/catalogo";

/** Un producto tal como lo necesita la caja (se carga una vez y se busca en el dispositivo). */
export type ProductoVenta = {
  id: string;
  nombre: string;
  marca: string;
  sinonimos: string[];
  plu: string | null;
  unidadBase: UnidadBase;
  stock: string;
  categoriaId: string | null;
  soloMayores: boolean;
  fotoRuta: string | null;
  presentaciones: { id: string; nombre: string; factor: string; precio: string | null; esBase: boolean; paraVenta: boolean; codigos: string[] }[];
};

export type LineaCarrito = {
  clave: string;
  productoId: string | null; // null = «Varios»
  presentacionId: string | null;
  descripcion: string;
  cantidad: string;
  precio: string; // por presentación
  factor: string;
  descuento: string; // monto
  unidadBase: UnidadBase;
  soloMayores: boolean;
};

export type Carrito = { lineas: LineaCarrito[]; descuento: string; clienteId: string | null; nota: string };

export const carritoVacio = (): Carrito => ({ lineas: [], descuento: "", clienteId: null, nota: "" });

const numero = (t: string) => leerNumero(t) ?? dec(0);

export function totalLinea(l: LineaCarrito): Dec {
  return numero(l.cantidad).times(numero(l.precio)).toDecimalPlaces(2).minus(numero(l.descuento));
}

export function totales(c: Carrito): { subtotal: Dec; descuento: Dec; total: Dec; unidades: number } {
  const subtotal = c.lineas.reduce((s, l) => s.plus(totalLinea(l)), dec(0));
  const descuento = numero(c.descuento);
  return { subtotal, descuento, total: subtotal.minus(descuento).toDecimalPlaces(2), unidades: c.lineas.length };
}

/** % de descuento total sobre el precio sin descuentos (para saber si pide autorización). */
export function porcentajeDescuento(c: Carrito): Dec {
  const bruto = c.lineas.reduce((s, l) => s.plus(numero(l.cantidad).times(numero(l.precio)).toDecimalPlaces(2)), dec(0));
  if (bruto.isZero()) return dec(0);
  const desc = c.lineas.reduce((s, l) => s.plus(numero(l.descuento)), dec(0)).plus(numero(c.descuento));
  return desc.dividedBy(bruto).times(100).toDecimalPlaces(2);
}

/**
 * Agrega un producto. Si ya está en el carrito con la misma presentación, sube
 * la cantidad. `cantidad` permite «6 × escanear» o libras.
 */
export function agregar(c: Carrito, p: ProductoVenta, presentacionId?: string, cantidad = "1"): Carrito {
  const pres =
    p.presentaciones.find((x) => x.id === presentacionId) ??
    p.presentaciones.find((x) => x.esBase && x.paraVenta) ??
    p.presentaciones.find((x) => x.paraVenta) ??
    p.presentaciones[0];
  const existente = c.lineas.find((l) => l.presentacionId === pres.id && numero(l.descuento).isZero());
  if (existente) {
    return {
      ...c,
      lineas: c.lineas.map((l) => (l === existente ? { ...l, cantidad: numero(l.cantidad).plus(numero(cantidad)).toString() } : l)),
    };
  }
  const nueva: LineaCarrito = {
    clave: `${pres.id}:${Date.now()}:${Math.random()}`,
    productoId: p.id,
    presentacionId: pres.id,
    descripcion: pres.esBase ? p.nombre : `${p.nombre} (${pres.nombre})`,
    cantidad: numero(cantidad).toString(),
    precio: pres.precio ?? "0",
    factor: pres.factor,
    descuento: "",
    unidadBase: p.unidadBase,
    soloMayores: p.soloMayores,
  };
  return { ...c, lineas: [...c.lineas, nueva] };
}

export function agregarVarios(c: Carrito, monto: string, descripcion = "Varios"): Carrito {
  return {
    ...c,
    lineas: [
      ...c.lineas,
      {
        clave: `varios:${Date.now()}:${Math.random()}`,
        productoId: null,
        presentacionId: null,
        descripcion: descripcion.trim() || "Varios",
        cantidad: "1",
        precio: numero(monto).toString(),
        factor: "1",
        descuento: "",
        unidadBase: "unidad",
        soloMayores: false,
      },
    ],
  };
}

/** «Deme $1 de papas»: cuántas libras son por ese monto (3 decimales). */
export function cantidadPorMonto(monto: string, precio: string): string | null {
  const m = leerNumero(monto);
  const p = leerNumero(precio);
  if (!m || !p || p.lte(0) || m.lte(0)) return null;
  return m.dividedBy(p).toDecimalPlaces(3).toString();
}

/** Lo que recibe la función registrar_venta. */
export function armarVenta(id: string, c: Carrito, pagos: PagoVenta[], pin?: string) {
  return {
    id,
    cliente_id: c.clienteId,
    nota: c.nota,
    descuento: numero(c.descuento).toString(),
    pin: pin ?? null,
    lineas: c.lineas.map((l) =>
      l.productoId
        ? { producto_id: l.productoId, presentacion_id: l.presentacionId, cantidad: numero(l.cantidad).toString(), descuento: numero(l.descuento).toString() }
        : { descripcion: l.descripcion, precio: numero(l.precio).toString(), cantidad: numero(l.cantidad).toString() },
    ),
    pagos: pagos.map((p) => ({
      forma: p.forma,
      monto: numero(p.monto).toString(),
      referencia: p.referencia ?? "",
      recibido: p.recibido ? numero(p.recibido).toString() : null,
    })),
  };
}

// ------------------------------------------------------------------ pagos y cambio

export type PagoVenta = { forma: string; monto: string; referencia?: string; recibido?: string };

export function faltaPorPagar(total: Dec, pagos: PagoVenta[]): Dec {
  return total.minus(pagos.reduce((s, p) => s.plus(numero(p.monto)), dec(0))).toDecimalPlaces(2);
}

const DENOMINACIONES = ["20", "10", "5", "1", "0.5", "0.25", "0.1", "0.05", "0.01"];

/** Cómo dar el cambio con la menor cantidad de billetes y monedas: [["5", 1], ["1", 2], ...]. */
export function desgloseCambio(cambio: Dec): [string, number][] {
  let resto = cambio.toDecimalPlaces(2);
  const resultado: [string, number][] = [];
  for (const d of DENOMINACIONES) {
    const cuantos = resto.dividedToIntegerBy(d).toNumber();
    if (cuantos > 0) {
      resultado.push([d, cuantos]);
      resto = resto.minus(dec(d).times(cuantos));
    }
  }
  return resultado;
}

/** Botones rápidos de efectivo: exacto y los billetes que alcanzan. */
export function montosRapidos(total: Dec): string[] {
  const opciones = new Set<string>([total.toFixed(2)]);
  for (const b of [1, 5, 10, 20, 50]) {
    if (dec(b).gte(total)) opciones.add(dec(b).toFixed(2));
  }
  const siguiente5 = total.dividedBy(5).ceil().times(5);
  if (siguiente5.gt(total)) opciones.add(siguiente5.toFixed(2));
  return [...opciones].sort((a, b) => Number(a) - Number(b)).slice(0, 5);
}

/** Total contado en el arqueo: { "20": 3, "0.25": 8 } → 62. */
export function totalArqueo(conteo: Record<string, string>): Dec {
  return Object.entries(conteo).reduce((s, [d, c]) => s.plus(dec(d).times(Number.parseInt(c || "0", 10) || 0)), dec(0));
}

export const DENOMINACIONES_ARQUEO = ["20", "10", "5", "1", "0.5", "0.25", "0.1", "0.05", "0.01"];

// ------------------------------------------------------------------ lector de códigos

/**
 * Distingue un lector de códigos (escribe muy rápido y termina en Enter) de una
 * persona escribiendo. Recibe cada tecla con su hora y devuelve el código cuando
 * lo reconoce.
 */
export class DetectorLector {
  private buffer = "";
  private ultima = 0;
  private inicio = 0;

  constructor(
    private readonly maxEntreTeclas = 50, // ms
    private readonly minLargo = 3,
  ) {}

  tecla(key: string, ahora: number): string | null {
    if (key === "Enter") {
      const codigo = this.buffer;
      const duracion = this.ultima - this.inicio;
      const promedio = codigo.length > 1 ? duracion / (codigo.length - 1) : Infinity;
      this.buffer = "";
      if (codigo.length >= this.minLargo && promedio <= this.maxEntreTeclas && ahora - this.ultima <= this.maxEntreTeclas * 2) {
        return codigo;
      }
      return null;
    }
    if (key.length !== 1) return null;
    if (!this.buffer || ahora - this.ultima > this.maxEntreTeclas * 2) {
      this.buffer = "";
      this.inicio = ahora;
    }
    this.buffer += key;
    this.ultima = ahora;
    return null;
  }
}

// ------------------------------------------------------------------ balanza

/**
 * Código de balanza (EAN-13 con prefijo 20–28): 2X + código del producto (5) +
 * precio en centavos (5) + verificador. Devuelve el código corto y el precio.
 */
export function leerCodigoBalanza(codigo: string): { plu: string; precio: string } | null {
  if (!/^2[0-8]\d{11}$/.test(codigo)) return null;
  const plu = codigo.slice(2, 7).replace(/^0+(?=\d)/, "");
  const centavos = Number.parseInt(codigo.slice(7, 12), 10);
  return { plu, precio: dec(centavos).dividedBy(100).toFixed(2) };
}
