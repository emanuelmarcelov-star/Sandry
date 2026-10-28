/**
 * Dinero, cantidades y fechas.
 *
 * Regla del proyecto: NUNCA usar `number` para montos. Todo pasa por Decimal
 * (decimal.js), que hace las cuentas exactas como en un cuaderno. Solo al
 * mostrar o guardar el total final se redondea a 2 decimales.
 */
import Decimal from "decimal.js";

/** Decimal con redondeo "de toda la vida": 0.005 sube a 0.01. */
export const Dec = Decimal.clone({ precision: 30, rounding: Decimal.ROUND_HALF_UP });
export type Dec = InstanceType<typeof Dec>;

export const ZONA_HORARIA = "America/Guayaquil";

/** Convierte un valor ya limpio (número en texto o Decimal) a Decimal. */
export function dec(valor: Decimal.Value): Dec {
  return new Dec(valor);
}

/**
 * Lee un monto o cantidad escrito por una persona o venido de Excel.
 * Acepta "1.50", "1,50", "$ 1.50", " 2 ", "1,234.50" y "1.234,50".
 * Devuelve null si no es un número válido.
 */
export function leerNumero(texto: string | number | null | undefined): Dec | null {
  if (texto === null || texto === undefined) return null;
  let t = String(texto).trim().replace(/\$/g, "").replace(/\s+/g, "");
  if (t === "") return null;

  const ultimaComa = t.lastIndexOf(",");
  const ultimoPunto = t.lastIndexOf(".");
  if (ultimaComa !== -1 && ultimoPunto !== -1) {
    // El separador que aparece al final es el decimal; el otro es de miles.
    if (ultimaComa > ultimoPunto) t = t.replace(/\./g, "").replace(",", ".");
    else t = t.replace(/,/g, "");
  } else if (ultimaComa !== -1) {
    t = t.replace(",", ".");
  }

  if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
  return new Dec(t);
}

/** Redondea un monto a centavos (2 decimales). */
export function redondear(monto: Decimal.Value): Dec {
  return new Dec(monto).toDecimalPlaces(2);
}

/** Formato de Ecuador para mostrar: $1.50, $1,234.50, -$0.25 */
export function formatoDolares(monto: Decimal.Value): string {
  const r = redondear(monto);
  const [entero, centavos] = r.abs().toFixed(2).split(".");
  const conMiles = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${r.isNegative() && !r.isZero() ? "-" : ""}$${conMiles}.${centavos}`;
}

/** Fecha en formato dd/mm/aaaa, siempre con la hora de Ecuador. */
export function formatoFecha(fecha: Date | string): string {
  const partes = new Intl.DateTimeFormat("en-GB", {
    timeZone: ZONA_HORARIA,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(new Date(fecha));
  const valor = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "";
  return `${valor("day")}/${valor("month")}/${valor("year")}`;
}
