import { describe, expect, test } from "vitest";
import { dec, formatoDolares, formatoFecha, leerNumero, redondear } from "@/lib/dinero";

describe("cuentas exactas con Decimal", () => {
  test("0.1 + 0.2 da exactamente 0.3 (con number daría 0.30000000000000004)", () => {
    expect(dec("0.1").plus("0.2").equals("0.3")).toBe(true);
  });

  test("redondea a centavos con medio hacia arriba", () => {
    expect(redondear("1.005").toFixed(2)).toBe("1.01");
    expect(redondear("1.004").toFixed(2)).toBe("1.00");
    expect(redondear("-0.125").toFixed(2)).toBe("-0.13");
  });

  test("costo por unidad de una jaba: $9.00 / 12 = $0.75", () => {
    expect(dec("9").dividedBy(12).toFixed(4)).toBe("0.7500");
  });
});

describe("leerNumero acepta lo que escribe una persona o trae Excel", () => {
  test.each([
    ["1.50", "1.5"],
    ["1,50", "1.5"],
    ["$ 1.50", "1.5"],
    ["  2 ", "2"],
    ["1,234.50", "1234.5"],
    ["1.234,50", "1234.5"],
    ["0,4", "0.4"],
    ["-3", "-3"],
  ])("%s → %s", (texto, esperado) => {
    expect(leerNumero(texto)?.toString()).toBe(esperado);
  });

  test.each(["", "abc", "1.2.3x", null, undefined])("%s no es un número", (texto) => {
    expect(leerNumero(texto)).toBeNull();
  });
});

describe("formatos de Ecuador", () => {
  test.each([
    ["1.5", "$1.50"],
    ["0", "$0.00"],
    ["1234.5", "$1,234.50"],
    ["1000000", "$1,000,000.00"],
    ["-0.25", "-$0.25"],
    ["-0.001", "$0.00"],
  ])("%s → %s", (monto, esperado) => {
    expect(formatoDolares(monto)).toBe(esperado);
  });

  test("fecha dd/mm/aaaa con la hora de Ecuador (UTC-5)", () => {
    // 03:00 UTC del 1 de noviembre todavía es 31 de octubre en Ecuador.
    expect(formatoFecha("2026-11-01T03:00:00Z")).toBe("31/10/2026");
    expect(formatoFecha("2026-11-01T06:00:00Z")).toBe("01/11/2026");
  });
});
