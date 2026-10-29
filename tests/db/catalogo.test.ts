import { beforeAll, describe, expect, test } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/tipos";
import { admin, crearCuenta, sesionDe, vaciarProyecto } from "./ayuda";

/*
 * Reglas del catálogo probadas directo contra la base de pruebas:
 * presentaciones y stock en unidad base, costos privados, costo promedio,
 * códigos sin duplicados, búsqueda tolerante y permisos.
 */

const DUENA = "duena@catalogo.sandry.test";
const CAJERA = "cajera@catalogo.sandry.test";
const BODEGA = "bodega@catalogo.sandry.test";

let duena: SupabaseClient<Database>;
let cajera: SupabaseClient<Database>;
let bodega: SupabaseClient<Database>;
let idCola: string;
let gaseosas: string;

const n = (v: unknown) => Number(v);

async function categoria(nombre: string) {
  const { data } = await admin().from("categorias").select("id").eq("nombre", nombre).single();
  return data!.id;
}

function cocaCola(extra: Record<string, unknown> = {}) {
  return {
    nombre: "Coca-Cola 500 ml",
    marca: "Coca-Cola",
    categoria_id: gaseosas,
    plu: "",
    sinonimos: ["colita", "coca"],
    unidad_base: "unidad",
    tarifa_iva: "15",
    stock_minimo: 12,
    retornable: false,
    presentaciones: [
      { nombre: "Unidad", factor: 1, precio_venta: 1, es_base: true, codigos: ["7861001234565"] },
      { nombre: "Paquete x6", factor: 6, precio_venta: 5.5, codigos: [] },
      { nombre: "Jaba x12", factor: 12, precio_venta: 10.8, para_venta: true, codigos: ["17861001234562"] },
    ],
    costo_unitario: 0.75,
    stock_inicial: 24,
    ...extra,
  };
}

beforeAll(async () => {
  await vaciarProyecto();
  const idDuena = await crearCuenta(DUENA, { nombre_completo: "Rosa Dueña" });
  const idCajera = await crearCuenta(CAJERA, { nombre_completo: "Ana Cajera" });
  const idBodega = await crearCuenta(BODEGA, { nombre_completo: "Luz Bodega" });
  duena = await sesionDe(DUENA);
  await duena.rpc("aprobar_usuario", { p_usuario: idCajera, p_rol: "cajera" });
  await duena.rpc("aprobar_usuario", { p_usuario: idBodega, p_rol: "inventario" });
  void idDuena;
  cajera = await sesionDe(CAJERA);
  bodega = await sesionDe(BODEGA);
  gaseosas = await categoria("Gaseosas");
});

describe("categorías", () => {
  test("vienen cargadas en árbol, con IVA y margen que se heredan", async () => {
    const { data: g } = await duena.rpc("valores_categoria", { p_categoria: gaseosas });
    expect(g?.[0]).toMatchObject({ tarifa_iva: "15" });
    expect(n(g?.[0].margen_objetivo)).toBe(20);
    const { data: cond } = await duena.rpc("valores_categoria", { p_categoria: await categoria("Condimentos") });
    expect(cond?.[0].tarifa_iva).toBe("15"); // excepción dentro de Víveres (0%)
    expect(n(cond?.[0].margen_objetivo)).toBe(15);
    const { data: arroz } = await duena.rpc("valores_categoria", { p_categoria: await categoria("Arroz") });
    expect(arroz?.[0].tarifa_iva).toBe("0");
  });

  test("se crean y no se permiten nombres repetidos en el mismo lugar ni ciclos", async () => {
    const bebidas = await categoria("Bebidas");
    const { data: id, error } = await duena.rpc("guardar_categoria", { p: { nombre: "Tés fríos", padre_id: bebidas } });
    expect(error).toBeNull();
    const repetida = await duena.rpc("guardar_categoria", { p: { nombre: "tes FRIOS", padre_id: bebidas } });
    expect(repetida.error?.message).toContain("Ya existe");
    const ciclo = await duena.rpc("guardar_categoria", { p: { id: bebidas, nombre: "Bebidas", padre_id: id } });
    expect(ciclo.error?.message).toContain("dentro de sí misma");
  });

  test("la cajera ve las categorías pero no las cambia", async () => {
    const { data } = await cajera.from("categorias").select("id");
    expect(data!.length).toBeGreaterThan(20);
    const { error } = await cajera.rpc("guardar_categoria", { p: { nombre: "Hackeo" } });
    expect(error?.code).toBe("42501");
  });
});

describe("crear un producto con presentaciones", () => {
  test("guarda todo y el stock queda en unidad base", async () => {
    const { data, error } = await duena.rpc("guardar_producto", { p: cocaCola() });
    expect(error).toBeNull();
    idCola = data!;

    const { data: pres } = await duena.from("presentaciones").select("nombre, factor, precio_venta, es_base").eq("producto_id", idCola).order("factor");
    expect(pres?.map((p) => [p.nombre, n(p.factor), n(p.precio_venta), p.es_base])).toEqual([
      ["Unidad", 1, 1, true],
      ["Paquete x6", 6, 5.5, false],
      ["Jaba x12", 12, 10.8, false],
    ]);
    const { data: stock } = await duena.from("existencias").select("cantidad").eq("producto_id", idCola).single();
    expect(n(stock?.cantidad)).toBe(24);
    const { data: costo } = await duena.from("producto_costos").select("costo_promedio, ultimo_costo").eq("producto_id", idCola).single();
    expect([n(costo?.costo_promedio), n(costo?.ultimo_costo)]).toEqual([0.75, 0.75]);
    const { data: kardex } = await duena.from("movimientos_stock").select("tipo, cantidad, saldo").eq("producto_id", idCola);
    expect(kardex?.map((k) => [k.tipo, n(k.cantidad), n(k.saldo)])).toEqual([["inventario_inicial", 24, 24]]);
    const { count } = await duena.from("etiquetas_pendientes").select("presentacion_id", { count: "exact", head: true }).eq("producto_id", idCola);
    expect(count).toBe(3);
  });

  test("el código de la jaba apunta a la jaba", async () => {
    const { data } = await duena.from("codigos_barras").select("codigo, presentaciones(nombre)").eq("codigo", "17861001234562").single();
    expect((data?.presentaciones as unknown as { nombre: string }).nombre).toBe("Jaba x12");
  });

  test("un código de barras no puede pertenecer a dos productos", async () => {
    const { error } = await duena.rpc("guardar_producto", {
      p: { nombre: "Otro", presentaciones: [{ nombre: "Unidad", factor: 1, es_base: true, codigos: ["7861001234565"] }] },
    });
    expect(error?.message).toContain("ya pertenece a «Coca-Cola 500 ml»");
  });

  test("el PLU no se repite y se sugiere el siguiente libre", async () => {
    const r1 = await duena.rpc("guardar_producto", {
      p: { nombre: "Pan de sal", plu: "10", unidad_base: "unidad", presentaciones: [{ nombre: "Unidad", factor: 1, precio_venta: 0.15, es_base: true }] },
    });
    expect(r1.error).toBeNull();
    const r2 = await duena.rpc("guardar_producto", {
      p: { nombre: "Pan dulce", plu: "10", presentaciones: [{ nombre: "Unidad", factor: 1, es_base: true }] },
    });
    expect(r2.error?.message).toContain("ya lo usa «Pan de sal»");
    const { data } = await duena.rpc("siguiente_plu");
    expect(data).toBe("1");
  });

  test("exige exactamente una presentación base con factor 1", async () => {
    const sinBase = await duena.rpc("guardar_producto", { p: { nombre: "X", presentaciones: [{ nombre: "Caja", factor: 10 }] } });
    expect(sinBase.error?.message).toContain("exactamente una presentación base");
    const malFactor = await duena.rpc("guardar_producto", { p: { nombre: "X", presentaciones: [{ nombre: "Libra", factor: 2, es_base: true }] } });
    expect(malFactor.error?.message).toContain("factor 1");
  });
});

describe("costos privados", () => {
  test("la cajera ve productos, precios y stock, pero nunca costos ni kardex", async () => {
    const { data: prod } = await cajera.from("productos").select("nombre").eq("id", idCola);
    expect(prod).toHaveLength(1);
    const { data: pres } = await cajera.from("presentaciones").select("precio_venta").eq("producto_id", idCola);
    expect(pres).toHaveLength(3);
    const { data: stock } = await cajera.from("existencias").select("cantidad").eq("producto_id", idCola);
    expect(stock).toHaveLength(1);
    expect((await cajera.from("producto_costos").select("*")).data).toEqual([]);
    expect((await cajera.from("movimientos_stock").select("*")).data).toEqual([]);
    expect((await cajera.from("historial_precios").select("*")).data).toEqual([]);
  });

  test("la cajera no puede crear ni editar productos", async () => {
    const { error } = await cajera.rpc("guardar_producto", { p: cocaCola({ id: idCola }) });
    expect(error?.code).toBe("42501");
  });
});

describe("cambios de precio", () => {
  test("quedan en el historial, la bitácora y la lista de etiquetas por reimprimir", async () => {
    await duena.rpc("marcar_etiquetas_impresas", {
      p_presentaciones: ((await duena.from("presentaciones").select("id").eq("producto_id", idCola)).data ?? []).map((p) => p.id),
    });
    const { data: pres } = await duena.from("presentaciones").select("id, nombre, factor, precio_venta, es_base, para_venta, para_compra").eq("producto_id", idCola).order("factor");
    const conIds = pres!.map((p) => ({ ...p, codigos: p.nombre === "Unidad" ? ["7861001234565"] : p.nombre === "Jaba x12" ? ["17861001234562"] : [] }));
    conIds[0].precio_venta = 1.05;
    const { error } = await duena.rpc("guardar_producto", { p: { ...cocaCola({ id: idCola }), presentaciones: conIds, stock_inicial: null } });
    expect(error).toBeNull();

    const { data: hist } = await duena.from("historial_precios").select("antes, despues").eq("producto_id", idCola).eq("tipo", "venta").not("antes", "is", null);
    expect(hist?.map((h) => [n(h.antes), n(h.despues)])).toEqual([[1, 1.05]]);
    const { data: pend } = await duena.from("etiquetas_pendientes").select("presentacion_id").eq("producto_id", idCola);
    expect(pend?.map((p) => p.presentacion_id)).toEqual([conIds[0].id]);
    const { count } = await duena.from("bitacora").select("id", { count: "exact", head: true }).eq("accion", "cambiar_precio");
    expect(count).toBe(1);
  });

  test("quien edita productos sin permiso de precios no puede cambiarlos", async () => {
    const actuales = (await duena.from("rol_permisos").select("permiso").eq("rol_id", "inventario")).data!.map((r) => r.permiso);
    await duena.rpc("actualizar_permisos_rol", { p_rol: "inventario", p_permisos: [...actuales, "productos.editar"] });

    const { data: pres } = await bodega.from("presentaciones").select("id, nombre, factor, precio_venta, es_base").eq("producto_id", idCola).eq("activa", true).order("factor");
    const base = { ...cocaCola({ id: idCola, stock_inicial: null, costo_unitario: null }), presentaciones: pres!.map((p) => ({ ...p, codigos: [] as string[] })) };
    // Cambiar la ubicación sí puede...
    expect((await bodega.rpc("guardar_producto", { p: { ...base, ubicacion: "Refrigeradora 1" } })).error).toBeNull();
    // ...pero no el precio.
    base.presentaciones[0].precio_venta = 0.5;
    const { error } = await bodega.rpc("guardar_producto", { p: base });
    expect(error?.message).toContain("No tienes permiso para cambiar precios");
  });

  test("quitar una presentación la desactiva (no se borra el historial)", async () => {
    const { data: pres } = await duena.from("presentaciones").select("id, nombre, factor, precio_venta, es_base").eq("producto_id", idCola).eq("activa", true).neq("nombre", "Paquete x6");
    const { error } = await duena.rpc("guardar_producto", {
      p: { ...cocaCola({ id: idCola, stock_inicial: null, costo_unitario: null }), presentaciones: pres!.map((p) => ({ ...p, codigos: [] })) },
    });
    expect(error).toBeNull();
    const { data } = await duena.from("presentaciones").select("nombre, activa").eq("producto_id", idCola).eq("nombre", "Paquete x6").single();
    expect(data?.activa).toBe(false);
    // Los códigos que ya no se mandan se quitan.
    const { count } = await duena.from("codigos_barras").select("codigo", { count: "exact", head: true }).eq("producto_id", idCola);
    expect(count).toBe(0);
  });
});

describe("costo promedio ponderado", () => {
  test("compras y bonificaciones recalculan el promedio", async () => {
    const a = admin();
    // Hay 24 unidades a $0.75. Llegan 12 a $0.90 → (24×0.75 + 12×0.90) / 36 = 0.80
    await a.rpc("registrar_movimiento", { p_producto: idCola, p_tipo: "compra", p_cantidad: 12, p_costo: 0.9 });
    let c = (await duena.from("producto_costos").select("costo_promedio, ultimo_costo").eq("producto_id", idCola).single()).data!;
    expect([n(c.costo_promedio), n(c.ultimo_costo)]).toEqual([0.8, 0.9]);
    // Bonificación: 12 gratis → (36×0.80 + 12×0) / 48 = 0.60; el último costo pagado sigue en 0.90
    await a.rpc("registrar_movimiento", { p_producto: idCola, p_tipo: "bonificacion", p_cantidad: 12, p_costo: 0 });
    c = (await duena.from("producto_costos").select("costo_promedio, ultimo_costo").eq("producto_id", idCola).single()).data!;
    expect([n(c.costo_promedio), n(c.ultimo_costo)]).toEqual([0.6, 0.9]);
    // Una venta no cambia el costo; el saldo baja.
    const { data: saldo } = await a.rpc("registrar_movimiento", { p_producto: idCola, p_tipo: "venta", p_cantidad: -6, p_costo: null as unknown as number });
    expect(n(saldo)).toBe(42);
  });

  test("importar stock de un producto que ya existe lo suma como compra", async () => {
    const { data: pres } = await duena.from("presentaciones").select("id, nombre, factor, precio_venta, es_base").eq("producto_id", idCola).eq("activa", true);
    // 42 a $0.60 + 18 a $0.70 = (25.2 + 12.6) / 60 = 0.63
    const { error } = await duena.rpc("importar_productos", {
      p_productos: [{ ...cocaCola({ id: idCola, stock_inicial: 18, costo_unitario: 0.7 }), presentaciones: pres!.map((p) => ({ ...p, codigos: [] })) }],
    });
    expect(error).toBeNull();
    const c = (await duena.from("producto_costos").select("costo_promedio").eq("producto_id", idCola).single()).data!;
    expect(n(c.costo_promedio)).toBe(0.63);
    const { data: stock } = await duena.from("existencias").select("cantidad").eq("producto_id", idCola).single();
    expect(n(stock?.cantidad)).toBe(60);
  });
});

describe("códigos internos", () => {
  test("EAN-13 con prefijo 29, dígito verificador correcto y sin repetirse", async () => {
    const codigos = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const { data } = await duena.rpc("generar_codigo_interno");
      expect(data).toMatch(/^29\d{11}$/);
      const d = data!.split("").map(Number);
      const suma = d.slice(0, 12).reduce((t, x, j) => t + x * (j % 2 ? 3 : 1), 0);
      expect((10 - (suma % 10)) % 10).toBe(d[12]);
      codigos.add(data!);
    }
    expect(codigos.size).toBe(30);
  });

  test("solo quien edita productos puede generarlos", async () => {
    expect((await cajera.rpc("generar_codigo_interno")).error?.code).toBe("42501");
  });
});

describe("búsqueda", () => {
  beforeAll(async () => {
    const productos = [
      { nombre: "Cerveza Pilsener 600 ml", marca: "Pilsener", sinonimos: ["pilsen"] },
      { nombre: "Azúcar blanca 1 kg", marca: "Valdez", sinonimos: [] },
      { nombre: "Chupete Bon Bon Bum", marca: "Colombina", sinonimos: ["chupete", "bombom"] },
      { nombre: "Coca-Cola 3 litros", marca: "Coca-Cola", sinonimos: [] },
    ];
    for (const p of productos) {
      const { error } = await duena.rpc("guardar_producto", {
        p: { ...p, presentaciones: [{ nombre: "Unidad", factor: 1, precio_venta: 1, es_base: true }] },
      });
      expect(error).toBeNull();
    }
  });

  async function buscar(texto: string) {
    const { data } = await cajera.rpc("buscar_productos", { p_texto: texto });
    return (data ?? []).map((p) => p.nombre);
  }

  test.each([
    ["cocacola", "Coca-Cola 500 ml"],
    ["coca 3l", "Coca-Cola 3 litros"],
    ["pilsner", "Cerveza Pilsener 600 ml"],
    ["AZUCAR", "Azúcar blanca 1 kg"],
    ["colita", "Coca-Cola 500 ml"],
    ["chupete", "Chupete Bon Bon Bum"],
    ["10", "Pan de sal"],
  ])("«%s» encuentra «%s»", async (texto, esperado) => {
    expect(await buscar(texto)).toContain(esperado);
  });

  test("el PLU exacto sale primero", async () => {
    expect((await buscar("10"))[0]).toBe("Pan de sal");
  });
});

describe("ajustar stock desde la ficha", () => {
  async function stockDe(id: string) {
    return n((await duena.from("existencias").select("cantidad").eq("producto_id", id).single()).data?.cantidad);
  }

  test("sumar mercadería con costo actualiza stock y costo promedio", async () => {
    const antes = await stockDe(idCola); // 60 a $0.63
    const { data, error } = await duena.rpc("ajustar_stock", { p_producto: idCola, p_tipo: "compra", p_cantidad: 24, p_costo: 0.84 });
    expect(error).toBeNull();
    expect(n(data)).toBe(antes + 24);
    // (60 × 0.63 + 24 × 0.84) / 84 = 0.69
    const c = (await duena.from("producto_costos").select("costo_promedio").eq("producto_id", idCola).single()).data!;
    expect(n(c.costo_promedio)).toBe(0.69);
  });

  test("corregir conteo registra solo la diferencia", async () => {
    const { data } = await duena.rpc("ajustar_stock", { p_producto: idCola, p_tipo: "conteo", p_cantidad: 80 });
    expect(n(data)).toBe(80);
    const { data: ultimo } = await duena.from("movimientos_stock").select("tipo, cantidad").eq("producto_id", idCola).order("id", { ascending: false }).limit(1).single();
    expect([ultimo?.tipo, n(ultimo?.cantidad)]).toEqual(["conteo", -4]);
  });

  test("sacar por consumo de la casa resta y queda en la bitácora", async () => {
    const { data } = await duena.rpc("ajustar_stock", { p_producto: idCola, p_tipo: "autoconsumo", p_cantidad: 2, p_nota: "para la casa" });
    expect(n(data)).toBe(78);
    const { data: ev } = await duena.from("bitacora").select("detalle").eq("accion", "ajustar_stock").order("id", { ascending: false }).limit(1).single();
    expect(ev?.detalle).toMatchObject({ tipo: "autoconsumo", nota: "para la casa" });
  });

  test("valida la cantidad y el permiso", async () => {
    expect((await duena.rpc("ajustar_stock", { p_producto: idCola, p_tipo: "merma", p_cantidad: 0 })).error?.message).toContain("mayor que 0");
    expect((await duena.rpc("ajustar_stock", { p_producto: idCola, p_tipo: "venta", p_cantidad: 1 })).error?.message).toContain("no válido");
    expect((await cajera.rpc("ajustar_stock", { p_producto: idCola, p_tipo: "compra", p_cantidad: 5 })).error?.code).toBe("42501");
    expect((await cajera.rpc("ajustar_stock", { p_producto: idCola, p_tipo: "conteo", p_cantidad: 5 })).error?.code).toBe("42501");
  });
});
