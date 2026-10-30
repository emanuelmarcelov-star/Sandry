import { describe, expect, test } from "vitest";
import { rangoPeriodo, rankings, variacion } from "@/lib/reportes";

describe("períodos de los reportes", () => {
  // 30/10/2026 es viernes.
  const hoy = "2026-10-30";
  test("hoy, ayer, semana (desde el lunes), mes, mes pasado y año", () => {
    expect(rangoPeriodo("hoy", hoy)).toEqual({ desde: hoy, hasta: hoy });
    expect(rangoPeriodo("ayer", hoy)).toEqual({ desde: "2026-10-29", hasta: "2026-10-29" });
    expect(rangoPeriodo("semana", hoy)).toEqual({ desde: "2026-10-26", hasta: hoy });
    expect(rangoPeriodo("mes", hoy)).toEqual({ desde: "2026-10-01", hasta: hoy });
    expect(rangoPeriodo("mesPasado", hoy)).toEqual({ desde: "2026-09-01", hasta: "2026-09-30" });
    expect(rangoPeriodo("anio", hoy)).toEqual({ desde: "2026-01-01", hasta: hoy });
  });

  test("la semana que empieza un domingo va desde el lunes anterior", () => {
    expect(rangoPeriodo("semana", "2026-11-01")).toEqual({ desde: "2026-10-26", hasta: "2026-11-01" });
  });

  test("mes pasado en enero es diciembre del año anterior", () => {
    expect(rangoPeriodo("mesPasado", "2027-01-15")).toEqual({ desde: "2026-12-01", hasta: "2026-12-31" });
  });
});

describe("cálculos", () => {
  test("variación frente a la semana pasada", () => {
    expect(variacion(120, 100)).toBe(20);
    expect(variacion(80, 100)).toBe(-20);
    expect(variacion(50, 0)).toBeNull();
  });

  test("rankings de productos", () => {
    const r = rankings([
      { producto_id: "a", producto: "Coca", cantidad: 30, ventas: 30, ganancia: 7.5 },
      { producto_id: "b", producto: "Pan", cantidad: 100, ventas: 15, ganancia: 5 },
      { producto_id: "c", producto: "Leche", cantidad: 5, ventas: 5, ganancia: -0.5 },
    ]);
    expect(r.masVendidos.map((p) => p.producto)).toEqual(["Pan", "Coca", "Leche"]);
    expect(r.masRentables[0].producto).toBe("Coca");
    expect(r.menosRentables.map((p) => p.producto)).toEqual(["Pan", "Coca"]);
    expect(r.aPerdida.map((p) => p.producto)).toEqual(["Leche"]);
  });
});
