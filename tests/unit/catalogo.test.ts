import { describe, expect, test } from "vitest";
import {
  aUnidadBase,
  costoPorUnidadBase,
  desglosarIva,
  digitoVerificadorGtin,
  esCodigoInterno,
  esGtinValido,
  margenSobreCosto,
  precioSugerido,
  redondearPrecio,
  tipoDeCodigo,
} from "@/lib/catalogo";

describe("códigos de barras", () => {
  test("dígito verificador EAN-13", () => {
    expect(digitoVerificadorGtin("786100123456")).toBe(5);
    expect(esGtinValido("7861001234565")).toBe(true);
    expect(esGtinValido("7861001234567")).toBe(false);
  });

  test("ITF-14 de la caja y EAN-8", () => {
    expect(esGtinValido("17861001234562")).toBe(true);
    expect(esGtinValido("96385074")).toBe(true);
  });

  test("códigos internos con prefijo 29", () => {
    const doce = "290000000001";
    const codigo = doce + digitoVerificadorGtin(doce);
    expect(esCodigoInterno(codigo)).toBe(true);
    expect(esCodigoInterno("7861001234565")).toBe(false);
  });

  test("elige qué dibujar", () => {
    expect(tipoDeCodigo("7861001234565")).toBe("ean13");
    expect(tipoDeCodigo("17861001234562")).toBe("itf14");
    expect(tipoDeCodigo("ABC-123")).toBe("code128");
    expect(tipoDeCodigo("7861001234567")).toBe("code128"); // verificador malo: no se fuerza EAN
  });
});

describe("presentaciones", () => {
  test("2 jabas x12 son 24 unidades", () => {
    expect(aUnidadBase(2, 12).toString()).toBe("24");
  });

  test("libras con decimales: 1.5 «unidades» de papa de 0.4 lb = 0.6 lb", () => {
    expect(aUnidadBase("1.5", "0.4").toString()).toBe("0.6");
  });

  test("costo por unidad base: jaba de $9.00 / 12 = $0.75", () => {
    expect(costoPorUnidadBase("9", 12).toString()).toBe("0.75");
  });

  test("funda de 100 caramelos a $2.00 → $0.02 cada uno", () => {
    expect(costoPorUnidadBase("2", 100).toString()).toBe("0.02");
  });
});

describe("precios y margen (sobre el costo)", () => {
  test("costo $1.00 y precio $1.20 → 20%", () => {
    expect(margenSobreCosto("1.20", "1.00")?.toString()).toBe("20");
  });

  test("vender a pérdida da margen negativo", () => {
    expect(margenSobreCosto("0.70", "0.75")?.toString()).toBe("-6.7");
  });

  test("sin costo no hay margen", () => {
    expect(margenSobreCosto("1", null)).toBeNull();
    expect(margenSobreCosto("1", 0)).toBeNull();
  });

  test.each([
    ["1.21", "0.05", "1.25"],
    ["1.25", "0.05", "1.25"],
    ["1.201", "0.05", "1.25"],
    ["0.33", "0.10", "0.4"],
    ["2.01", "0.25", "2.25"],
  ])("redondear %s a múltiplos de %s → %s", (precio, multiplo, esperado) => {
    expect(redondearPrecio(precio, multiplo).toString()).toBe(esperado);
  });

  test("precio sugerido: costo $0.75 + 20% = $0.90", () => {
    expect(precioSugerido("0.75", 20).toString()).toBe("0.9");
  });

  test("precio sugerido redondeado: costo $0.62 + 35% = 0.837 → $0.85", () => {
    expect(precioSugerido("0.62", 35).toString()).toBe("0.85");
  });
});

describe("IVA (los precios lo incluyen)", () => {
  test("$1.15 con 15% → base $1.00 + IVA $0.15", () => {
    const { base, iva } = desglosarIva("1.15", "15");
    expect([base.toString(), iva.toString()]).toEqual(["1", "0.15"]);
  });

  test("$1.00 con 15% → base $0.87 + IVA $0.13 (suman exacto)", () => {
    const { base, iva } = desglosarIva("1.00", "15");
    expect([base.toFixed(2), iva.toFixed(2)]).toEqual(["0.87", "0.13"]);
  });

  test("tarifa 0% y exento no tienen IVA", () => {
    expect(desglosarIva("2.50", "0").iva.toString()).toBe("0");
    expect(desglosarIva("2.50", "exento").base.toString()).toBe("2.5");
  });
});
