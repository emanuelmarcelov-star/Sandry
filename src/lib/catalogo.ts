/**
 * Cálculos del catálogo: códigos de barras, presentaciones, margen, precio
 * sugerido e IVA. Todo con Decimal (nunca number para dinero).
 */
import type Decimal from "decimal.js";
import { Dec, dec } from "@/lib/dinero";

export type UnidadBase = "unidad" | "libra" | "kilo" | "litro";
export type TarifaIva = "15" | "0" | "exento";

export const UNIDADES: Record<UnidadBase, { nombre: string; presentacionBase: string; decimales: boolean }> = {
  unidad: { nombre: "Unidad", presentacionBase: "Unidad", decimales: false },
  libra: { nombre: "Libra", presentacionBase: "Libra", decimales: true },
  kilo: { nombre: "Kilo", presentacionBase: "Kilo", decimales: true },
  litro: { nombre: "Litro", presentacionBase: "Litro", decimales: true },
};

export const TARIFAS_IVA: Record<TarifaIva, { nombre: string; tasa: Dec }> = {
  "15": { nombre: "IVA 15%", tasa: dec("0.15") },
  "0": { nombre: "IVA 0%", tasa: dec(0) },
  exento: { nombre: "Exento de IVA", tasa: dec(0) },
};

// --------------------------------------------------------------- códigos

/** Dígito verificador EAN-13 / UPC / EAN-8 / ITF-14 (mismo algoritmo, pesos 3-1 desde la derecha). */
export function digitoVerificadorGtin(sinVerificador: string): number {
  const suma = sinVerificador
    .split("")
    .reverse()
    .reduce((t, c, i) => t + Number(c) * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (suma % 10)) % 10;
}

/** ¿Es un código GTIN válido (EAN-8, UPC-A de 12, EAN-13 o ITF-14)? */
export function esGtinValido(codigo: string): boolean {
  if (!/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(codigo)) return false;
  return digitoVerificadorGtin(codigo.slice(0, -1)) === Number(codigo.at(-1));
}

/** Los códigos internos de la tienda: EAN-13 que empieza con 29. */
export function esCodigoInterno(codigo: string): boolean {
  return /^29\d{11}$/.test(codigo) && esGtinValido(codigo);
}

/** Qué tipo de código de barras dibujar para un código. */
export function tipoDeCodigo(codigo: string): "ean13" | "ean8" | "upca" | "itf14" | "code128" {
  if (esGtinValido(codigo)) {
    if (codigo.length === 13) return "ean13";
    if (codigo.length === 8) return "ean8";
    if (codigo.length === 12) return "upca";
    if (codigo.length === 14) return "itf14";
  }
  return "code128";
}

// --------------------------------------------------------------- presentaciones

/** Cantidad en la unidad base: 2 jabas x12 → 24 unidades. */
export function aUnidadBase(cantidad: Decimal.Value, factor: Decimal.Value): Dec {
  return dec(cantidad).times(factor);
}

/** Costo por unidad base a partir del costo de una presentación: jaba $9.00 / 12 → $0.75. */
export function costoPorUnidadBase(costoPresentacion: Decimal.Value, factor: Decimal.Value): Dec {
  return dec(costoPresentacion).dividedBy(factor).toDecimalPlaces(4);
}

// --------------------------------------------------------------- precios

/**
 * Margen sobre el costo (como lo calcula la tienda):
 * costo $1.00, precio $1.20 → 20%. Devuelve null si no hay costo.
 */
export function margenSobreCosto(precio: Decimal.Value | null, costo: Decimal.Value | null): Dec | null {
  if (precio === null || costo === null) return null;
  const c = dec(costo);
  if (c.isZero()) return null;
  return dec(precio).minus(c).dividedBy(c).times(100).toDecimalPlaces(1);
}

/** Ganancia en dólares por presentación. */
export function gananciaPorPresentacion(precio: Decimal.Value, costo: Decimal.Value): Dec {
  return dec(precio).minus(costo);
}

/** Redondea HACIA ARRIBA al múltiplo indicado (por defecto $0.05): 1.21 → 1.25. */
export function redondearPrecio(precio: Decimal.Value, multiplo: Decimal.Value = "0.05"): Dec {
  const m = dec(multiplo);
  return dec(precio).dividedBy(m).toDecimalPlaces(0, Dec.ROUND_CEIL).times(m).toDecimalPlaces(2);
}

/** Precio sugerido = costo × (1 + margen objetivo), redondeado hacia arriba. */
export function precioSugerido(costo: Decimal.Value, margenObjetivo: Decimal.Value, multiplo: Decimal.Value = "0.05"): Dec {
  return redondearPrecio(dec(costo).times(dec(1).plus(dec(margenObjetivo).dividedBy(100))), multiplo);
}

/** Desglose del IVA de un precio que ya lo incluye: $1.15 con 15% → base $1.00 + IVA $0.15. */
export function desglosarIva(precioConIva: Decimal.Value, tarifa: TarifaIva): { base: Dec; iva: Dec } {
  const precio = dec(precioConIva);
  const tasa = TARIFAS_IVA[tarifa].tasa;
  const base = precio.dividedBy(dec(1).plus(tasa)).toDecimalPlaces(2);
  return { base, iva: precio.minus(base) };
}
