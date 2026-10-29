import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, test } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/tipos";
import { admin, crearCuenta, sesionDe, vaciarProyecto } from "./ayuda";

/*
 * Fase 4 contra la base de pruebas: cuentas de dinero, proveedores, compras
 * (suelta, crédito, viaje), gastos del viaje, lotes con caducidad, lista
 * sugerida, pedidos, envases y conteo de inventario.
 */

const DUENA = "duena@abastecimiento.sandry.test";
const CAJERA = "cajera@abastecimiento.sandry.test";
const BODEGA = "bodega@abastecimiento.sandry.test";

let duena: SupabaseClient<Database>;
let cajera: SupabaseClient<Database>;
let bodega: SupabaseClient<Database>;
const cuentas: Record<string, string> = {};
let coca: { id: string; unidad: string; jaba: string };
let leche: { id: string; unidad: string };
let distribuidor: string;
let mercado: string;
let mayorista: string;

const n = (v: unknown) => Number(v);

async function saldos() {
  const { data } = await duena.rpc("saldos_cuentas");
  return Object.fromEntries((data ?? []).map((c) => [c.nombre, n(c.saldo)]));
}
async function stock(id: string) {
  return n((await duena.from("existencias").select("cantidad").eq("producto_id", id).single()).data?.cantidad);
}
async function costo(id: string) {
  return n((await duena.from("producto_costos").select("costo_promedio").eq("producto_id", id).single()).data?.costo_promedio);
}
async function producto(nombre: string, presentaciones: { nombre: string; factor: number; es_base?: boolean }[], extra = {}) {
  const { data, error } = await duena.rpc("guardar_producto", {
    p: { nombre, presentaciones: presentaciones.map((p) => ({ ...p, precio_venta: 1, codigos: [] })), ...extra },
  });
  expect(error).toBeNull();
  const { data: pres } = await duena.from("presentaciones").select("id, nombre").eq("producto_id", data!);
  return { id: data!, pres: Object.fromEntries((pres ?? []).map((p) => [p.nombre, p.id])) };
}

beforeAll(async () => {
  await vaciarProyecto();
  await crearCuenta(DUENA, { nombre_completo: "Rosa Dueña" });
  const idCajera = await crearCuenta(CAJERA, { nombre_completo: "Ana Cajera" });
  const idBodega = await crearCuenta(BODEGA, { nombre_completo: "Luz Bodega" });
  duena = await sesionDe(DUENA);
  await duena.rpc("aprobar_usuario", { p_usuario: idCajera, p_rol: "cajera" });
  await duena.rpc("aprobar_usuario", { p_usuario: idBodega, p_rol: "inventario" });
  cajera = await sesionDe(CAJERA);
  bodega = await sesionDe(BODEGA);

  for (const c of (await duena.from("cuentas_dinero").select("id, nombre")).data ?? []) cuentas[c.nombre] = c.id;
  const c = await producto("Coca-Cola 500 ml", [
    { nombre: "Unidad", factor: 1, es_base: true },
    { nombre: "Jaba x12", factor: 12 },
  ], { stock_minimo: 12 });
  coca = { id: c.id, unidad: c.pres["Unidad"], jaba: c.pres["Jaba x12"] };
  const l = await producto("Leche entera 1 L", [{ nombre: "Unidad", factor: 1, es_base: true }]);
  leche = { id: l.id, unidad: l.pres["Unidad"] };
});

describe("cuentas de dinero", () => {
  test("vienen Caja, Banco, Deuna y Dinero personal de la dueña, en $0", async () => {
    expect(await saldos()).toEqual({ Caja: 0, Banco: 0, Deuna: 0, "Dinero personal de la dueña": 0 });
  });

  test("saldo inicial, transferencia, aporte y retiro de la dueña", async () => {
    const mover = (p: Record<string, unknown>) => duena.rpc("mover_dinero", { p });
    expect((await mover({ tipo: "correccion", destino: cuentas.Caja, monto: 100 })).error).toBeNull();
    expect((await mover({ tipo: "correccion", destino: cuentas.Banco, monto: 500 })).error).toBeNull();
    await mover({ tipo: "transferencia", origen: cuentas.Caja, destino: cuentas.Banco, monto: 40, nota: "depósito" });
    await mover({ tipo: "aporte", destino: cuentas.Caja, monto: 20 });
    await mover({ tipo: "retiro", origen: cuentas.Caja, monto: 10, nota: "para la casa" });
    expect(await saldos()).toMatchObject({ Caja: 70, Banco: 540, "Dinero personal de la dueña": -10 });
    // Corregir: «conté la caja y hay $65».
    await mover({ tipo: "correccion", destino: cuentas.Caja, monto: 65 });
    expect((await saldos()).Caja).toBe(65);
    expect((await mover({ tipo: "transferencia", origen: cuentas.Caja, destino: cuentas.Caja, monto: 1 })).error?.message).toContain("dos cuentas distintas");
  });

  test("la cajera no ve saldos ni mueve dinero, pero sí ve los nombres de las cuentas", async () => {
    expect((await cajera.rpc("saldos_cuentas")).data).toEqual([]);
    expect((await cajera.from("movimientos_dinero").select("*")).data).toEqual([]);
    expect((await cajera.from("cuentas_dinero").select("nombre")).data).toHaveLength(4);
    expect((await cajera.rpc("mover_dinero", { p: { tipo: "retiro", origen: cuentas.Caja, monto: 5 } })).error?.code).toBe("42501");
  });
});

describe("proveedores", () => {
  test("se crean con tipo y días de visita; RUC y nombre se validan", async () => {
    const guardar = (p: Record<string, unknown>) => duena.rpc("guardar_proveedor", { p });
    const r = await guardar({ nombre: "Coca-Cola (Arca)", tipo: "distribuidor", telefono: "0991234567", dias_visita: [2] });
    expect(r.error).toBeNull();
    distribuidor = r.data!;
    mercado = (await guardar({ nombre: "Mercado Mayorista", tipo: "mercado" })).data!;
    mayorista = (await guardar({ nombre: "Bodega Don Lucho", tipo: "mayorista" })).data!;
    expect((await guardar({ nombre: "coca-cola (ARCA)" })).error?.message).toContain("Ya existe");
    expect((await guardar({ nombre: "Otro", ruc: "123" })).error?.message).toContain("13 números");
    expect((await cajera.rpc("guardar_proveedor", { p: { nombre: "X" } })).error?.code).toBe("42501");
  });
});

describe("compras", () => {
  test("compra suelta de contado: suma stock, saca el dinero y calcula el costo promedio", async () => {
    // 2 jabas a $9 c/u + 1 jaba de bonificación → 36 unidades; 24 a $0.75 y 12 a $0.
    const id = randomUUID();
    const { data, error } = await duena.rpc("registrar_compra", {
      p: {
        id, proveedor_id: distribuidor, pago: "contado", cuenta_id: cuentas.Caja, con_factura: true, numero_factura: "001-002-123",
        lineas: [{ producto_id: coca.id, presentacion_id: coca.jaba, cantidad: 2, costo_total: 18, bonificacion: 1 }],
      },
    });
    expect(error).toBeNull();
    expect(data).toMatchObject({ id, repetida: false });
    expect(await stock(coca.id)).toBe(36);
    expect(await costo(coca.id)).toBe(0.5); // (24 × 0.75 + 12 × 0) / 36
    expect((await saldos()).Caja).toBe(65 - 18);
    const { data: kardex } = await duena.from("movimientos_stock").select("tipo, cantidad").eq("producto_id", coca.id).order("id");
    expect(kardex?.map((k) => [k.tipo, n(k.cantidad)])).toEqual([["compra", 24], ["bonificacion", 12]]);
  });

  test("si se reintenta la misma compra (sin señal), no se duplica", async () => {
    const id = randomUUID();
    const p = { id, proveedor_id: mercado, pago: "contado", cuenta_id: cuentas.Caja,
      lineas: [{ producto_id: coca.id, presentacion_id: coca.unidad, cantidad: 6, costo_total: 6 }] };
    await duena.rpc("registrar_compra", { p });
    const otra = await duena.rpc("registrar_compra", { p });
    expect(otra.data).toMatchObject({ repetida: true });
    expect(await stock(coca.id)).toBe(42);
    expect((await saldos()).Caja).toBe(47 - 6);
  });

  test("avisa si el costo subió y si en otro lugar estaba más barato", async () => {
    // En la Bodega a $1.20 la unidad: subió (antes $1.00 en el mercado) y en Arca estaba a $0.75.
    const { data } = await duena.rpc("registrar_compra", {
      p: { id: randomUUID(), proveedor_id: mayorista, pago: "contado", cuenta_id: cuentas.Banco,
        lineas: [{ producto_id: coca.id, presentacion_id: coca.unidad, cantidad: 10, costo_total: 12 }] },
    });
    const avisos = (data as { avisos: Record<string, unknown>[] }).avisos;
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toMatchObject({ producto: "Coca-Cola 500 ml", mas_barato_en: "Coca-Cola (Arca)" });
    expect(n(avisos[0].antes)).toBe(1);
    expect(n(avisos[0].ahora)).toBe(1.2);
    expect(n(avisos[0].costo_mas_barato)).toBe(0.75);
    const { data: lugares } = await duena.rpc("precios_por_lugar", { p_producto: coca.id });
    expect(lugares?.map((l) => [l.lugar, n(l.costo)])).toEqual([
      ["Coca-Cola (Arca)", 0.75], ["Mercado Mayorista", 1], ["Bodega Don Lucho", 1.2],
    ]);
  });

  test("a crédito: no sale dinero, queda por pagar y se abona", async () => {
    const id = randomUUID();
    const antes = await saldos();
    await duena.rpc("registrar_compra", {
      p: { id, proveedor_id: distribuidor, pago: "credito", vence: "2026-11-15",
        lineas: [{ producto_id: coca.id, presentacion_id: coca.jaba, cantidad: 1, costo_total: 9 }] },
    });
    expect(await saldos()).toEqual(antes);
    let { data: deudas } = await duena.rpc("cuentas_por_pagar");
    expect(deudas?.map((d) => [d.proveedor, n(d.saldo), d.vence])).toEqual([["Coca-Cola (Arca)", 9, "2026-11-15"]]);
    await duena.rpc("pagar_compra", { p: { compra_id: id, monto: 4, cuenta_id: cuentas.Deuna } });
    expect((await duena.rpc("pagar_compra", { p: { compra_id: id, monto: 6, cuenta_id: cuentas.Deuna } })).error?.message).toContain("Solo se deben $5");
    await duena.rpc("pagar_compra", { p: { compra_id: id, monto: 5, cuenta_id: cuentas.Deuna } });
    ({ data: deudas } = await duena.rpc("cuentas_por_pagar"));
    expect(deudas).toEqual([]);
    expect((await saldos()).Deuna).toBe(-9);
  });

  test("lo que llegó dañado entra y sale como merma; la fecha de caducidad crea un lote", async () => {
    await duena.rpc("registrar_compra", {
      p: { id: randomUUID(), proveedor_id: distribuidor, pago: "contado", cuenta_id: cuentas.Caja,
        lineas: [{ producto_id: leche.id, presentacion_id: leche.unidad, cantidad: 12, costo_total: 12, danados: 2, vence: "2026-11-05" }] },
    });
    expect(await stock(leche.id)).toBe(10);
    const { data: lote } = await duena.from("lotes").select("vence, cantidad").eq("producto_id", leche.id).single();
    expect([lote?.vence, n(lote?.cantidad)]).toEqual(["2026-11-05", 10]);
    expect((await duena.from("productos").select("maneja_caducidad").eq("id", leche.id).single()).data?.maneja_caducidad).toBe(true);
  });

  test("lo que sale del stock se descuenta primero del lote que vence antes", async () => {
    await duena.rpc("registrar_compra", {
      p: { id: randomUUID(), pago: "contado", cuenta_id: cuentas.Caja,
        lineas: [{ producto_id: leche.id, presentacion_id: leche.unidad, cantidad: 6, costo_total: 6, vence: "2026-11-20" }] },
    });
    await duena.rpc("ajustar_stock", { p_producto: leche.id, p_tipo: "caducado", p_cantidad: 12 });
    const { data: lotes } = await duena.from("lotes").select("vence, cantidad").eq("producto_id", leche.id).order("vence");
    expect(lotes?.map((l) => [l.vence, n(l.cantidad)])).toEqual([["2026-11-05", 0], ["2026-11-20", 4]]);
  });

  test("la cajera no puede registrar compras ni ver costos de compras", async () => {
    const r = await cajera.rpc("registrar_compra", {
      p: { id: randomUUID(), pago: "contado", cuenta_id: cuentas.Caja,
        lineas: [{ producto_id: coca.id, presentacion_id: coca.unidad, cantidad: 1, costo_total: 1 }] },
    });
    expect(r.error?.code).toBe("42501");
    expect((await cajera.from("compras").select("*")).data).toEqual([]);
    expect((await cajera.from("compra_lineas").select("*")).data).toEqual([]);
  });
});

describe("viaje de compras", () => {
  const viaje = randomUUID();
  const compraRapida = randomUUID();

  test("se inicia con la lista, se tacha, se compra (también solo el total) y se anota la gasolina", async () => {
    expect((await bodega.rpc("iniciar_viaje", { p_id: viaje, p_lista: [{ producto_id: coca.id, cantidad: 24 }] })).error).toBeNull();
    // Reintento sin señal: no se duplica.
    expect((await bodega.rpc("iniciar_viaje", { p_id: viaje, p_lista: [] })).error).toBeNull();
    await bodega.rpc("marcar_lista_viaje", { p_viaje: viaje, p_producto: coca.id, p_tachado: true });

    const antesStock = await stock(coca.id);
    await bodega.rpc("registrar_compra", {
      p: { id: randomUUID(), viaje_id: viaje, proveedor_id: mercado, pago: "contado", cuenta_id: cuentas.Caja,
        lineas: [{ producto_id: coca.id, presentacion_id: coca.jaba, cantidad: 2, costo_total: 20 }] },
    });
    // Apurada: solo el total, detalla después.
    await bodega.rpc("registrar_compra", {
      p: { id: compraRapida, viaje_id: viaje, proveedor_id: mayorista, pago: "contado", cuenta_id: cuentas["Dinero personal de la dueña"], total: 5 },
    });
    const { data: gasolina } = await bodega.from("categorias_gasto").select("id").eq("nombre", "Gasolina").single();
    expect((await bodega.rpc("registrar_gasto", { p: { id: randomUUID(), viaje_id: viaje, categoria_id: gasolina!.id, monto: 10, cuenta_id: cuentas.Caja } })).error).toBeNull();
    // Mientras tanto, el stock no cambió.
    expect(await stock(coca.id)).toBe(antesStock);
    const { data: lista } = await bodega.from("viaje_lista").select("tachado").eq("viaje_id", viaje).single();
    expect(lista?.tachado).toBe(true);
  });

  test("no se recibe si falta detallar una compra; el detalle debe sumar lo pagado", async () => {
    expect((await bodega.rpc("recibir_viaje", { p_viaje: viaje })).error?.message).toContain("Falta detallar qué compraste en: Bodega Don Lucho");
    const mal = await bodega.rpc("detallar_compra", {
      p_compra: compraRapida, p_lineas: [{ producto_id: leche.id, presentacion_id: leche.unidad, cantidad: 4, costo_total: 4 }],
    });
    expect(mal.error?.message).toContain("suman $4.00 pero pagaste $5.00");
    expect((await bodega.rpc("detallar_compra", {
      p_compra: compraRapida, p_lineas: [{ producto_id: leche.id, presentacion_id: leche.unidad, cantidad: 5, costo_total: 5 }],
    })).error).toBeNull();
  });

  test("al recibir en tienda, entra al stock lo que de verdad llegó (y los dañados)", async () => {
    const antesCoca = await stock(coca.id);
    const antesLeche = await stock(leche.id);
    const { data: lineas } = await bodega.from("compra_lineas").select("id, producto_id, compras!inner(viaje_id)").eq("compras.viaje_id", viaje);
    const lineaCoca = lineas!.find((l) => l.producto_id === coca.id)!;
    // Llegaron las 2 jabas, pero 1 botella rota.
    expect((await bodega.rpc("recibir_viaje", { p_viaje: viaje, p_lineas: [{ linea_id: lineaCoca.id, recibido: 2, danados: 1 }] })).error).toBeNull();
    expect(await stock(coca.id)).toBe(antesCoca + 24 - 1);
    expect(await stock(leche.id)).toBe(antesLeche + 5);
    const { data: v } = await duena.from("viajes").select("estado").eq("id", viaje).single();
    expect(v?.estado).toBe("recibido");
    expect((await bodega.rpc("recibir_viaje", { p_viaje: viaje })).error?.message).toContain("ya fue recibido");
    // El pago con dinero personal quedó como aporte de la dueña.
    expect((await saldos())["Dinero personal de la dueña"]).toBe(-15);
  });
});

describe("lista sugerida y alertas", () => {
  test("sugiere lo que está bajo el mínimo, agrupado por el último lugar donde se compró", async () => {
    // Coca tiene mínimo 12: se deja en 5.
    await duena.rpc("ajustar_stock", { p_producto: coca.id, p_tipo: "conteo", p_cantidad: 5 });
    const { data } = await duena.rpc("lista_sugerida");
    const fila = data?.find((f) => f.producto_id === coca.id);
    expect(fila).toMatchObject({ proveedor: "Mercado Mayorista" });
    expect(n(fila?.sugerido)).toBe(19); // hasta el doble del mínimo (24) − 5
  });

  test("productos sin movimiento en X días", async () => {
    const { data } = await duena.rpc("productos_sin_movimiento", { p_dias: 30 });
    expect(data).toEqual([]); // todo se movió hoy
  });
});

describe("pedido al preventista", () => {
  test("se arma, se envía y se marca recibido con la compra", async () => {
    const { data: id, error } = await duena.rpc("guardar_pedido", {
      p: { proveedor_id: distribuidor, lineas: [{ producto_id: coca.id, presentacion_id: coca.jaba, cantidad: 3 }] },
    });
    expect(error).toBeNull();
    await duena.rpc("marcar_pedido", { p_pedido: id!, p_estado: "enviado" });
    const compra = randomUUID();
    await duena.rpc("registrar_compra", {
      p: { id: compra, proveedor_id: distribuidor, pago: "credito",
        lineas: [{ producto_id: coca.id, presentacion_id: coca.jaba, cantidad: 2, costo_total: 18 }] },
    });
    expect((await duena.rpc("marcar_pedido", { p_pedido: id!, p_estado: "recibido", p_compra: compra })).error).toBeNull();
    const { data: p } = await duena.from("pedidos").select("estado, compra_id").eq("id", id!).single();
    expect(p).toEqual({ estado: "recibido", compra_id: compra });
    expect((await duena.rpc("marcar_pedido", { p_pedido: id!, p_estado: "anulado" })).error?.message).toContain("ya fue recibido");
  });
});

describe("envases retornables", () => {
  test("llegan llenos, se devuelven vacíos y se cobra/devuelve garantía", async () => {
    const { data: jaba } = await duena.rpc("guardar_envase", { p: { nombre: "Botella Coca-Cola 1 L", garantia: 0.25, proveedor_id: distribuidor } });
    const mov = (tipo: string, cantidad: number) =>
      duena.rpc("registrar_envases", { p: { envase_id: jaba, tipo, cantidad, cuenta_id: cuentas.Caja } });
    const caja = (await saldos()).Caja;
    await mov("llegaron_llenos", 24);
    await mov("cliente_trajo", 10);
    await mov("entregue_vacios", 10);
    await mov("garantia_cobrada", 4);
    await mov("garantia_devuelta", 1);
    const { data } = await duena.rpc("saldos_envases");
    expect(data?.map((e) => [e.nombre, n(e.vacios), n(e.debidos), n(e.garantias)])).toEqual([["Botella Coca-Cola 1 L", 1, 14, 3]]);
    expect((await saldos()).Caja).toBe(caja + 0.75); // 4 × 0.25 − 0.25
    await mov("conteo_vacios", 5);
    expect(n((await duena.rpc("saldos_envases")).data?.[0].vacios)).toBe(5);
  });
});

describe("conteo de inventario", () => {
  test("se cuenta, se envía y la administradora aprueba: cambia solo la diferencia", async () => {
    const { data: categoria } = await duena.from("categorias").select("id").eq("nombre", "Bebidas").single();
    await duena.rpc("guardar_producto", { p: { id: coca.id, nombre: "Coca-Cola 500 ml", categoria_id: categoria!.id,
      presentaciones: (await duena.from("presentaciones").select("id, nombre, factor, precio_venta, es_base").eq("producto_id", coca.id).eq("activa", true)).data!.map((p) => ({ ...p, codigos: [] })) } });

    const { data: conteo } = await bodega.rpc("iniciar_conteo", { p_nombre: "", p_categoria: categoria!.id });
    const { data: lineas } = await bodega.from("conteo_lineas").select("producto_id").eq("conteo_id", conteo!);
    expect(lineas?.map((l) => l.producto_id)).toEqual([coca.id]);
    const sistema = await stock(coca.id);
    await bodega.rpc("anotar_conteo", { p_conteo: conteo!, p_producto: coca.id, p_contado: sistema - 2 });
    // La leche no es de Bebidas, pero se escaneó: se agrega al conteo.
    await bodega.rpc("anotar_conteo", { p_conteo: conteo!, p_producto: leche.id, p_contado: await stock(leche.id) });
    // Mientras tanto se vende una Coca: no debe perderse.
    await admin().rpc("registrar_movimiento", { p_producto: coca.id, p_tipo: "venta", p_cantidad: -1, p_costo: null as unknown as number });
    expect((await bodega.rpc("enviar_conteo", { p_conteo: conteo! })).error).toBeNull();

    // La encargada de inventario no puede aprobar; la dueña sí.
    expect((await bodega.rpc("aprobar_conteo", { p_conteo: conteo! })).error?.code).toBe("42501");
    const { data: cambios } = await duena.rpc("aprobar_conteo", { p_conteo: conteo! });
    expect(cambios).toBe(1);
    expect(await stock(coca.id)).toBe(sistema - 2 - 1);
    const { data: c } = await duena.from("conteos").select("nombre, estado").eq("id", conteo!).single();
    expect(c).toEqual({ nombre: "Conteo Bebidas", estado: "aprobado" });
  });
});
