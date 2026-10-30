import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, test } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/tipos";
import { crearCuenta, sesionDe, vaciarProyecto } from "./ayuda";

/*
 * Fase 6 contra la base de pruebas: gastos de la tienda y personales, gastos
 * fijos, otros ingresos y el reporte de ganancia (bruta y neta).
 */

const DUENA = "duena@reportes.sandry.test";
const CAJERA = "cajera@reportes.sandry.test";

let duena: SupabaseClient<Database>;
let cajera: SupabaseClient<Database>;
const cuentas: Record<string, string> = {};
const categorias: Record<string, string> = {};
let coca: { id: string; unidad: string };

const n = (v: unknown) => Number(v);
const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guayaquil" }).format(new Date());

async function saldos() {
  const { data } = await duena.rpc("saldos_cuentas");
  return Object.fromEntries((data ?? []).map((c) => [c.nombre, n(c.saldo)]));
}
async function reporte() {
  const { data, error } = await duena.rpc("reporte", { p_desde: hoy, p_hasta: hoy });
  expect(error).toBeNull();
  return data as Record<string, unknown>;
}

beforeAll(async () => {
  await vaciarProyecto();
  await crearCuenta(DUENA, { nombre_completo: "Rosa Dueña" });
  const idCajera = await crearCuenta(CAJERA, { nombre_completo: "Ana Cajera" });
  duena = await sesionDe(DUENA);
  await duena.rpc("aprobar_usuario", { p_usuario: idCajera, p_rol: "cajera" });
  cajera = await sesionDe(CAJERA);
  for (const c of (await duena.from("cuentas_dinero").select("id, nombre")).data ?? []) cuentas[c.nombre] = c.id;
  for (const c of (await duena.from("categorias_gasto").select("id, nombre")).data ?? []) categorias[c.nombre] = c.id;

  // Coca a costo $0.75, precio $1.00; se venden 10.
  const { data: id } = await duena.rpc("guardar_producto", {
    p: { nombre: "Coca-Cola 500 ml", costo_unitario: 0.75, stock_inicial: 24, presentaciones: [{ nombre: "Unidad", factor: 1, precio_venta: 1, es_base: true, codigos: [] }] } as unknown as Json,
  });
  const { data: pres } = await duena.from("presentaciones").select("id").eq("producto_id", id!).single();
  coca = { id: id!, unidad: pres!.id };
  await duena.rpc("abrir_caja", { p_fondo: 50 });
  await duena.rpc("registrar_venta", {
    p: { id: randomUUID(), lineas: [{ producto_id: coca.id, presentacion_id: coca.unidad, cantidad: 10 }], pagos: [{ forma: "efectivo", monto: 10 }] } as unknown as Json,
  });
});

describe("gastos", () => {
  test("gasto de la tienda: sale el dinero y cuenta como gasto", async () => {
    const r = await duena.rpc("registrar_gasto", { p: { id: randomUUID(), categoria_id: categorias.Luz, monto: 12, cuenta_id: cuentas.Banco } });
    expect(r.error).toBeNull();
    expect((await saldos()).Banco).toBe(-12);
  });

  test("gasolina personal pagada con la caja: es retiro de la dueña, no gasto del negocio", async () => {
    const { data: carro } = await duena.rpc("guardar_vehiculo", { p: { nombre: "Chevrolet Aveo" } });
    const r = await duena.rpc("registrar_gasto", {
      p: { id: randomUUID(), categoria_id: categorias.Gasolina, monto: 20, cuenta_id: cuentas.Caja, personal: true, vehiculo_id: carro!, galones: 7.5, kilometraje: 120500 } as unknown as Json,
    });
    expect(r.error).toBeNull();
    const { data: mov } = await duena.from("movimientos_dinero").select("motivo, monto").eq("referencia_tipo", "gasto").order("id", { ascending: false }).limit(1).single();
    expect([mov?.motivo, n(mov?.monto)]).toEqual(["retiro", -20]);
  });

  test("anular un gasto devuelve el dinero", async () => {
    const id = randomUUID();
    await duena.rpc("registrar_gasto", { p: { id, categoria_id: categorias.Otros, monto: 3, cuenta_id: cuentas.Caja } });
    const caja = (await saldos()).Caja;
    expect((await duena.rpc("anular_gasto", { p_gasto: id })).error).toBeNull();
    expect((await saldos()).Caja).toBe(caja + 3);
    expect((await duena.rpc("anular_gasto", { p_gasto: id })).error?.message).toContain("ya está anulado");
  });

  test("la cajera no registra gastos ni ve reportes", async () => {
    expect((await cajera.rpc("registrar_gasto", { p: { id: randomUUID(), categoria_id: categorias.Luz, monto: 1, cuenta_id: cuentas.Caja } })).error?.code).toBe("42501");
    expect((await cajera.rpc("reporte", { p_desde: hoy, p_hasta: hoy })).error?.code).toBe("42501");
    expect((await cajera.rpc("panel_inicio")).error?.code).toBe("42501");
  });
});

describe("gastos fijos", () => {
  test("vienen arriendo, luz, agua, internet y sueldo; al pagar uno deja de estar pendiente", async () => {
    let { data } = await duena.rpc("recurrentes_pendientes");
    expect(data?.map((r) => r.descripcion).sort()).toEqual(["Agua", "Arriendo del local", "Internet", "Luz", "Sueldo de la trabajadora"]);
    const arriendo = data!.find((r) => r.descripcion === "Arriendo del local")!;
    await duena.rpc("guardar_recurrente", { p: { id: arriendo.id, categoria_id: arriendo.categoria_id, descripcion: "Arriendo del local", monto: 150, dia: 5 } as unknown as Json });
    await duena.rpc("registrar_gasto", { p: { id: randomUUID(), categoria_id: arriendo.categoria_id, monto: 150, cuenta_id: cuentas.Banco, recurrente_id: arriendo.id } });
    ({ data } = await duena.rpc("recurrentes_pendientes"));
    expect(data?.map((r) => r.descripcion)).not.toContain("Arriendo del local");
  });
});

describe("reporte de ganancia", () => {
  test("ventas, costo, ganancia bruta y neta del día", async () => {
    await duena.rpc("registrar_ingreso", { p: { monto: 5, cuenta_id: cuentas.Caja, descripcion: "Comisión de recargas" } });
    await duena.rpc("ajustar_stock", { p_producto: coca.id, p_tipo: "autoconsumo", p_cantidad: 2 });
    const r = await reporte();
    expect(n(r.ventas)).toBe(10);
    expect(n(r.costo)).toBe(7.5);
    expect(n(r.ganancia_bruta)).toBe(2.5);
    expect(n(r.margen)).toBe(33.3);
    // Gastos del negocio: luz 12 + arriendo 150 (la gasolina personal y el anulado no cuentan).
    expect(n(r.gastos)).toBe(162);
    expect(n(r.gastos_personales)).toBe(20);
    expect(n(r.perdidas)).toBe(1.5); // 2 cocas a $0.75 de consumo de la casa
    expect(n(r.ganancia_neta)).toBe(2.5 - 162 - 1.5);
    expect(r.por_forma).toEqual({ efectivo: 10 });
    expect((r.flujo as { motivo: string; entra: number }[]).find((f) => f.motivo === "otro_ingreso")?.entra).toBe(5);
    expect(r.inventario).toMatchObject({ costo: 9, venta: 12 }); // quedan 12 cocas
  });

  test("panel de inicio: hoy, la semana pasada y alertas", async () => {
    const { data, error } = await duena.rpc("panel_inicio");
    expect(error).toBeNull();
    const p = data as { hoy: { ventas: number }; caja_abierta: boolean; efectivo_esperado: number; alertas: Record<string, number> };
    expect(n(p.hoy.ventas)).toBe(10);
    expect(p.caja_abierta).toBe(true);
    expect(n(p.efectivo_esperado)).toBe(50 + 10 - 20 + 5); // fondo + venta − gasolina personal + recargas
    expect(p.alertas.gastos_fijos).toBeGreaterThanOrEqual(0);
  });

  test("conciliación: se marca verificado lo cobrado por Deuna", async () => {
    await duena.rpc("registrar_venta", {
      p: { id: randomUUID(), lineas: [{ producto_id: coca.id, presentacion_id: coca.unidad, cantidad: 1 }], pagos: [{ forma: "deuna", monto: 1, referencia: "778899" }] } as unknown as Json,
    });
    await duena.rpc("marcar_conciliado", { p_fecha: hoy, p_forma: "deuna", p_verificado: true });
    const r = await reporte();
    expect(r.conciliacion).toEqual([{ dia: hoy, forma: "deuna", total: 1, verificado: true }]);
  });
});
