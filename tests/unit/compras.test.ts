import { describe, expect, test } from "vitest";
import {
  armarCompra,
  buscarLocal,
  costoTotalLinea,
  costoUnitarioLinea,
  enlaceWhatsApp,
  lineaVacia,
  porcentajeGastos,
  revisarCompra,
  textoPedido,
  totalCompra,
  type DatosCompra,
  type LineaCompra,
  type ProductoLigero,
} from "@/lib/compras";
import { dec } from "@/lib/dinero";

const coca: ProductoLigero = {
  id: "coca", nombre: "Coca-Cola 500 ml", marca: "Coca-Cola", sinonimos: ["colita"], plu: null, unidadBase: "unidad",
  stock: "10", costo: "0.75", manejaCaducidad: false,
  presentaciones: [
    { id: "u", nombre: "Unidad", factor: "1", esBase: true, paraCompra: true, codigos: ["7861001234565"] },
    { id: "j", nombre: "Jaba x12", factor: "12", esBase: false, paraCompra: true, codigos: ["17861001234562"] },
  ],
};
const pan: ProductoLigero = {
  id: "pan", nombre: "Pan de sal", marca: "", sinonimos: [], plu: "10", unidadBase: "unidad", stock: "0", costo: null,
  manejaCaducidad: false, presentaciones: [{ id: "pu", nombre: "Unidad", factor: "1", esBase: true, paraCompra: true, codigos: [] }],
};
const productos = new Map([[coca.id, coca], [pan.id, pan]]);

const linea = (datos: Partial<LineaCompra>): LineaCompra => ({
  clave: "x", productoId: "coca", presentacionId: "j", cantidad: "2", costo: "9", costoEs: "unidad",
  bonificacion: "", danados: "", vence: "", ...datos,
});
const compra = (datos: Partial<DatosCompra>): DatosCompra => ({
  id: "c1", proveedorId: "arca", pago: "contado", cuentaId: "caja", vence: "", conFactura: false, numeroFactura: "",
  nota: "", soloTotal: false, total: "", lineas: [linea({})], ...datos,
});

describe("costos de una compra", () => {
  test("costo por presentación o total de la línea, y por unidad base", () => {
    expect(costoTotalLinea(linea({})).toString()).toBe("18");
    expect(costoTotalLinea(linea({ costo: "17,50", costoEs: "total" })).toString()).toBe("17.5");
    expect(costoUnitarioLinea(linea({}), "12")?.toString()).toBe("0.75");
    expect(costoUnitarioLinea(linea({ cantidad: "0" }), "12")).toBeNull();
  });

  test("total de la compra: suma de líneas o solo el total (en el viaje, con apuro)", () => {
    expect(totalCompra(compra({ lineas: [linea({}), linea({ productoId: "pan", presentacionId: "pu", cantidad: "40", costo: "0.10" })] })).toString()).toBe("22");
    expect(totalCompra(compra({ soloTotal: true, total: "$15,30" })).toString()).toBe("15.3");
  });

  test("una línea nueva propone el último costo, en la presentación de compra", () => {
    const l = lineaVacia(coca);
    expect([l.presentacionId, l.costo, l.cantidad]).toEqual(["j", "9", "1"]);
    expect(lineaVacia(pan).costo).toBe("");
  });
});

describe("revisar antes de guardar", () => {
  test("todo bien", () => {
    expect(revisarCompra(compra({}), productos)).toEqual([]);
  });

  test("errores claros en español", () => {
    expect(revisarCompra(compra({ cuentaId: "" }), productos)).toContain("Elige de qué cuenta salió el dinero.");
    expect(revisarCompra(compra({ pago: "credito", proveedorId: "" }), productos)).toContain("Para comprar a crédito elige el proveedor.");
    expect(revisarCompra(compra({ lineas: [] }), productos)).toContain("Agrega al menos un producto.");
    expect(revisarCompra(compra({ lineas: [linea({ costo: "" })] }), productos)).toEqual([
      "Coca-Cola 500 ml: falta el costo (si fue regalo, ponlo en «bonificación»).",
    ]);
    expect(revisarCompra(compra({ lineas: [linea({ cantidad: "1", danados: "13" })] }), productos)).toEqual([
      "Coca-Cola 500 ml: hay más dañados que lo que llegó.",
    ]);
    expect(revisarCompra(compra({ soloTotal: true, total: "" }), productos)).toEqual(["Escribe el total que pagaste."]);
  });

  test("una bonificación sola (regalo) no necesita costo", () => {
    expect(revisarCompra(compra({ lineas: [linea({ cantidad: "0", costo: "", bonificacion: "1" })] }), productos)).toEqual([]);
  });
});

describe("lo que se manda a la base de datos", () => {
  test("líneas con costo total y cantidades en la presentación", () => {
    const p = armarCompra(compra({ lineas: [linea({ bonificacion: "1", danados: "2", vence: "2026-11-05" })] }));
    expect(p).toMatchObject({ proveedor_id: "arca", cuenta_id: "caja", total: null });
    expect(p.lineas).toEqual([
      { producto_id: "coca", presentacion_id: "j", cantidad: "2", costo_total: "18", bonificacion: "1", danados: "2", vence: "2026-11-05" },
    ]);
  });

  test("a crédito no lleva cuenta; solo total no lleva líneas", () => {
    expect(armarCompra(compra({ pago: "credito", vence: "2026-11-15" }))).toMatchObject({ cuenta_id: null, vence: "2026-11-15" });
    expect(armarCompra(compra({ soloTotal: true, total: "5" }))).toMatchObject({ total: "5", lineas: [] });
  });
});

describe("buscar sin internet", () => {
  const lista = [coca, pan];
  test("por código de barras exacto (la jaba trae la jaba)", () => {
    expect(buscarLocal(lista, "17861001234562")).toEqual([{ producto: coca, presentacionId: "j" }]);
  });
  test("por código corto, nombre sin tildes o apodo", () => {
    expect(buscarLocal(lista, "010")[0].producto.id).toBe("pan");
    expect(buscarLocal(lista, "COCA 500")[0].producto.id).toBe("coca");
    expect(buscarLocal(lista, "colita")[0].producto.id).toBe("coca");
    expect(buscarLocal(lista, "xyz")).toEqual([]);
  });
});

describe("viaje y pedidos", () => {
  test("gastos del viaje sobre lo comprado", () => {
    expect(porcentajeGastos(dec(200), dec(15))?.toString()).toBe("7.5");
    expect(porcentajeGastos(dec(0), dec(5))).toBeNull();
  });

  test("pedido por WhatsApp con número ecuatoriano", () => {
    const texto = textoPedido("Sandry", [{ producto: "Coca-Cola 500 ml", presentacion: "Jaba x12", cantidad: "3" }]);
    expect(texto).toBe("Hola, pedido de Sandry:\n• 3 Jaba x12 — Coca-Cola 500 ml\nGracias.");
    expect(enlaceWhatsApp("099 123 4567", "hola")).toBe("https://wa.me/593991234567?text=hola");
  });
});
