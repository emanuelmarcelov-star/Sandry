import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, test } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/tipos";
import { crearCuenta, sesionDe, vaciarProyecto } from "./ayuda";

/*
 * Fase 5 contra la base de pruebas: caja, ventas (precios del servidor, costo del
 * momento, stock), pagos por cuenta, fiado con límite, descuentos y anulaciones
 * con PIN de la administradora, productos pendientes y permisos.
 */

const DUENA = "duena@ventas.sandry.test";
const CAJERA = "cajera@ventas.sandry.test";

let duena: SupabaseClient<Database>;
let cajera: SupabaseClient<Database>;
const cuentas: Record<string, string> = {};
let coca: { id: string; unidad: string; jaba: string };
let cliente: string;

const n = (v: unknown) => Number(v);
const venta = (c: SupabaseClient<Database>, p: Record<string, unknown>) =>
  c.rpc("registrar_venta", { p: { id: randomUUID(), ...p } as unknown as Json });
const linea = (cantidad = 1, presentacion = coca.unidad) => ({ producto_id: coca.id, presentacion_id: presentacion, cantidad });

async function saldos() {
  const { data } = await duena.rpc("saldos_cuentas");
  return Object.fromEntries((data ?? []).map((c) => [c.nombre, n(c.saldo)]));
}
async function stock() {
  return n((await duena.from("existencias").select("cantidad").eq("producto_id", coca.id).single()).data?.cantidad);
}

beforeAll(async () => {
  await vaciarProyecto();
  await crearCuenta(DUENA, { nombre_completo: "Rosa Dueña" });
  const idCajera = await crearCuenta(CAJERA, { nombre_completo: "Ana Cajera" });
  duena = await sesionDe(DUENA);
  await duena.rpc("aprobar_usuario", { p_usuario: idCajera, p_rol: "cajera" });
  cajera = await sesionDe(CAJERA);
  await duena.rpc("definir_mi_pin", { p_pin: "4321" });
  for (const c of (await duena.from("cuentas_dinero").select("id, nombre")).data ?? []) cuentas[c.nombre] = c.id;

  const { data: id } = await duena.rpc("guardar_producto", {
    p: {
      nombre: "Coca-Cola 500 ml", costo_unitario: 0.75, stock_inicial: 24,
      presentaciones: [
        { nombre: "Unidad", factor: 1, precio_venta: 1, es_base: true, codigos: [] },
        { nombre: "Jaba x12", factor: 12, precio_venta: 10.8, codigos: [] },
      ],
    } as unknown as Json,
  });
  const { data: pres } = await duena.from("presentaciones").select("id, nombre").eq("producto_id", id!);
  coca = { id: id!, unidad: pres!.find((p) => p.nombre === "Unidad")!.id, jaba: pres!.find((p) => p.nombre === "Jaba x12")!.id };
});

describe("caja", () => {
  test("no se vende con la caja cerrada", async () => {
    const r = await venta(cajera, { lineas: [linea()], pagos: [{ forma: "efectivo", monto: 1 }] });
    expect(r.error?.message).toContain("Abre la caja");
  });

  test("al abrir, la cuenta Caja queda con lo que se contó", async () => {
    expect((await cajera.rpc("abrir_caja", { p_fondo: 20 })).error).toBeNull();
    expect((await saldos()).Caja).toBe(20);
    expect((await cajera.rpc("abrir_caja", { p_fondo: 20 })).error?.message).toContain("ya está abierta");
  });
});

describe("vender", () => {
  test("efectivo con cambio: el precio sale de la base, baja el stock y entra el dinero a Caja", async () => {
    const { data, error } = await venta(cajera, {
      lineas: [linea(2), linea(1, coca.jaba)],
      pagos: [{ forma: "efectivo", monto: 12.8, recibido: 20 }],
    });
    expect(error).toBeNull();
    expect(data).toMatchObject({ total: 12.8, cambio: 7.2 });
    expect(await stock()).toBe(24 - 2 - 12);
    expect((await saldos()).Caja).toBe(32.8);
    // El costo del momento queda guardado (solo lo ve quien ve costos).
    const { data: lineas } = await duena.from("venta_lineas").select("id, descripcion, total").eq("venta_id", (data as { id: string }).id).order("id");
    expect(lineas?.map((l) => [l.descripcion, n(l.total)])).toEqual([["Coca-Cola 500 ml", 2], ["Coca-Cola 500 ml (Jaba x12)", 10.8]]);
    const { data: costos } = await duena.from("venta_linea_costos").select("costo_total").in("linea_id", lineas!.map((l) => l.id));
    expect(costos?.map((c) => n(c.costo_total)).sort()).toEqual([1.5, 9]);
    expect((await cajera.from("venta_linea_costos").select("*")).data).toEqual([]);
  });

  test("si se reintenta la misma venta (sin señal), no se duplica", async () => {
    const id = randomUUID();
    const p = { id, lineas: [linea()], pagos: [{ forma: "deuna", monto: 1, referencia: "123456" }] } as unknown as Json;
    await cajera.rpc("registrar_venta", { p });
    const otra = await cajera.rpc("registrar_venta", { p });
    expect(otra.data).toMatchObject({ repetida: true });
    expect((await saldos()).Deuna).toBe(1);
  });

  test("pago mixto que no cuadra se rechaza; sin stock avisa pero deja vender", async () => {
    const mal = await venta(cajera, { lineas: [linea(2)], pagos: [{ forma: "efectivo", monto: 1 }] });
    expect(mal.error?.message).toContain("Los pagos suman $1.00 pero la venta es de $2.00");
    const { data } = await venta(cajera, {
      lineas: [linea(20)],
      pagos: [{ forma: "efectivo", monto: 10 }, { forma: "transferencia", monto: 10, referencia: "Pichincha 998" }],
    });
    expect(data).toMatchObject({ sin_stock: ["Coca-Cola 500 ml"] });
    expect(await stock()).toBe(9 - 20);
  });

  test("«Varios» se cobra con monto libre y queda para revisar", async () => {
    const { data } = await venta(cajera, { lineas: [{ descripcion: "Fundita de caramelos", precio: 0.5, cantidad: 1 }], pagos: [{ forma: "efectivo", monto: 0.5 }] });
    const { data: l } = await duena.from("venta_lineas").select("revisar, producto_id").eq("venta_id", (data as { id: string }).id).single();
    expect(l).toEqual({ revisar: true, producto_id: null });
  });

  test("descuento mayor al 5 %: la cajera necesita el PIN de la administradora", async () => {
    const sinPin = await venta(cajera, { lineas: [linea(10)], descuento: 2, pagos: [{ forma: "efectivo", monto: 8 }] });
    expect(sinPin.error?.message).toContain("Hace falta el PIN");
    const malo = await venta(cajera, { lineas: [linea(10)], descuento: 2, pin: "0000", pagos: [{ forma: "efectivo", monto: 8 }] });
    expect(malo.error?.message).toContain("PIN incorrecto");
    const bien = await venta(cajera, { lineas: [linea(10)], descuento: 2, pin: "4321", pagos: [{ forma: "efectivo", monto: 8 }] });
    expect(bien.error).toBeNull();
    // Un descuento pequeño no pide nada.
    expect((await venta(cajera, { lineas: [linea(10)], descuento: 0.5, pagos: [{ forma: "efectivo", monto: 9.5 }] })).error).toBeNull();
  });

  test("la cajera no puede vender una presentación a otro precio", async () => {
    const { data } = await venta(cajera, { lineas: [{ ...linea(), precio: 0.01 }], pagos: [{ forma: "efectivo", monto: 1 }] });
    expect(data).toMatchObject({ total: 1 });
  });
});

describe("fiado", () => {
  test("solo a clientes, hasta su límite; sobre el límite pide PIN; y se abona", async () => {
    const r = await duena.rpc("guardar_cliente", { p: { nombre: "Don Lucho", telefono: "0991112233", limite_credito: 5 } });
    expect(r.error).toBeNull();
    cliente = r.data!;
    // La cajera no puede subirle el límite.
    expect((await cajera.rpc("guardar_cliente", { p: { id: cliente, nombre: "Don Lucho", limite_credito: 50 } })).error?.message).toContain("Solo la administradora");

    expect((await venta(cajera, { lineas: [linea(3)], pagos: [{ forma: "fiado", monto: 3 }] })).error?.message).toContain("elige el cliente");
    expect((await venta(cajera, { cliente_id: cliente, lineas: [linea(3)], pagos: [{ forma: "fiado", monto: 3 }] })).error).toBeNull();
    const sobre = await venta(cajera, { cliente_id: cliente, lineas: [linea(3)], pagos: [{ forma: "fiado", monto: 3 }] });
    expect(sobre.error?.message).toContain("Hace falta el PIN");
    expect((await venta(cajera, { cliente_id: cliente, lineas: [linea(3)], pin: "4321", pagos: [{ forma: "fiado", monto: 3 }] })).error).toBeNull();

    let { data: lista } = await cajera.rpc("clientes_con_saldo");
    expect(n(lista?.find((c) => c.id === cliente)?.saldo)).toBe(6);
    const caja = (await saldos()).Caja;
    expect((await duena.rpc("registrar_abono", { p: { cliente_id: cliente, monto: 4, forma_pago_id: "efectivo" } })).error).toBeNull();
    expect((await duena.rpc("registrar_abono", { p: { cliente_id: cliente, monto: 4, forma_pago_id: "efectivo" } })).error?.message).toContain("Solo debe $2");
    ({ data: lista } = await cajera.rpc("clientes_con_saldo"));
    expect(n(lista?.find((c) => c.id === cliente)?.saldo)).toBe(2);
    expect((await saldos()).Caja).toBe(caja + 4);
  });
});

describe("anular y devolver", () => {
  test("anular con PIN devuelve el stock y el dinero; queda con motivo", async () => {
    const { data } = await venta(cajera, { lineas: [linea(2)], pagos: [{ forma: "efectivo", monto: 2 }] });
    const id = (data as { id: string }).id;
    const antes = { stock: await stock(), caja: (await saldos()).Caja };
    expect((await cajera.rpc("devolver_venta", { p: { venta_id: id, motivo: "Se equivocó", pin: "" } })).error?.message).toContain("Hace falta el PIN");
    expect((await cajera.rpc("devolver_venta", { p: { venta_id: id, motivo: "", pin: "4321" } })).error?.message).toContain("motivo");
    expect((await cajera.rpc("devolver_venta", { p: { venta_id: id, motivo: "Se equivocó", pin: "4321" } })).error).toBeNull();
    expect(await stock()).toBe(antes.stock + 2);
    expect((await saldos()).Caja).toBe(antes.caja - 2);
    const { data: v } = await duena.from("ventas").select("estado, motivo_anulacion").eq("id", id).single();
    expect(v).toEqual({ estado: "anulada", motivo_anulacion: "Se equivocó" });
  });

  test("devolución parcial: 1 de 3, el dinero sale de la caja", async () => {
    const { data } = await venta(cajera, { lineas: [linea(3)], pagos: [{ forma: "efectivo", monto: 3 }] });
    const id = (data as { id: string }).id;
    const { data: l } = await duena.from("venta_lineas").select("id").eq("venta_id", id).single();
    const caja = (await saldos()).Caja;
    const r = await duena.rpc("devolver_venta", { p: { venta_id: id, motivo: "Venía dañada", cuenta_id: cuentas.Caja, lineas: [{ linea_id: l!.id, cantidad: 1 }] } as unknown as Json });
    expect(n(r.data)).toBe(1);
    expect((await saldos()).Caja).toBe(caja - 1);
    expect((await duena.rpc("devolver_venta", { p: { venta_id: id, motivo: "x", cuenta_id: cuentas.Caja, lineas: [{ linea_id: l!.id, cantidad: 3 }] } as unknown as Json })).error?.message).toContain("más de lo vendido");
  });
});

describe("productos pendientes y permisos de lectura", () => {
  test("la cajera vende algo que no está registrado; queda pendiente", async () => {
    const { data, error } = await cajera.rpc("crear_producto_pendiente", { p_nombre: "Shampoo sachet", p_precio: 0.35, p_codigo: "7700000000017" });
    expect(error).toBeNull();
    const { producto_id, presentacion_id } = data as { producto_id: string; presentacion_id: string };
    expect((await venta(cajera, { lineas: [{ producto_id, presentacion_id, cantidad: 2 }], pagos: [{ forma: "efectivo", monto: 0.7 }] })).error).toBeNull();
    const { data: p } = await duena.from("productos").select("pendiente").eq("id", producto_id).single();
    expect(p?.pendiente).toBe(true);
  });

  test("la cajera ve solo sus ventas; la dueña ve todas", async () => {
    await duena.rpc("abrir_caja", { p_fondo: 0 }); // ya está abierta: no pasa nada
    await venta(duena, { lineas: [linea()], pagos: [{ forma: "efectivo", monto: 1 }] });
    const { data: deCajera } = await cajera.from("ventas").select("usuario_id");
    const { data: todas } = await duena.from("ventas").select("usuario_id");
    expect(new Set(deCajera?.map((v) => v.usuario_id)).size).toBe(1);
    expect(todas!.length).toBeGreaterThan(deCajera!.length);
  });
});

describe("cerrar caja", () => {
  test("el arqueo compara con lo esperado y corrige el faltante", async () => {
    const { data: resumen } = await cajera.rpc("resumen_caja");
    const esperado = n((resumen as { esperado: number }).esperado);
    // Faltan $0.50: se cuenta todo menos dos monedas de 25 centavos.
    const total = Math.round((esperado - 0.5) * 100);
    const conteo = { "1": Math.floor(total / 100), "0.01": total % 100 };
    const { data, error } = await cajera.rpc("cerrar_caja", { p_conteo: conteo, p_nota: "" });
    expect(error).toBeNull();
    expect(n((data as { diferencia: number }).diferencia)).toBe(-0.5);
    expect((await saldos()).Caja).toBe(esperado - 0.5);
    expect((await cajera.rpc("reabrir_caja")).error?.code).toBe("42501");
    expect((await duena.rpc("reabrir_caja")).error).toBeNull();
  });
});
