import { describe, expect, test } from "vitest";
import {
  agregar,
  agregarVarios,
  armarVenta,
  cantidadPorMonto,
  carritoVacio,
  DetectorLector,
  desgloseCambio,
  faltaPorPagar,
  leerCodigoBalanza,
  montosRapidos,
  porcentajeDescuento,
  totalArqueo,
  totales,
  type ProductoVenta,
} from "@/lib/ventas";
import { dec } from "@/lib/dinero";

const coca: ProductoVenta = {
  id: "coca", nombre: "Coca-Cola 500 ml", marca: "", sinonimos: [], plu: null, unidadBase: "unidad", stock: "24",
  categoriaId: null, soloMayores: false, fotoRuta: null,
  presentaciones: [
    { id: "u", nombre: "Unidad", factor: "1", precio: "1", esBase: true, paraVenta: true, codigos: ["7861001234565"] },
    { id: "j", nombre: "Jaba x12", factor: "12", precio: "10.8", esBase: false, paraVenta: true, codigos: [] },
  ],
};
const papa: ProductoVenta = {
  ...coca, id: "papa", nombre: "Papa chola", unidadBase: "libra",
  presentaciones: [{ id: "lb", nombre: "Libra", factor: "1", precio: "0.45", esBase: true, paraVenta: true, codigos: [] }],
};

describe("carrito", () => {
  test("escanear dos veces sube la cantidad; la jaba va en su propia línea", () => {
    let c = agregar(carritoVacio(), coca);
    c = agregar(c, coca);
    c = agregar(c, coca, "j");
    expect(c.lineas.map((l) => [l.descripcion, l.cantidad])).toEqual([["Coca-Cola 500 ml", "2"], ["Coca-Cola 500 ml (Jaba x12)", "1"]]);
    expect(totales(c).total.toString()).toBe("12.8");
  });

  test("«6» y escanear agrega 6; productos por libra y por monto", () => {
    expect(agregar(carritoVacio(), coca, undefined, "6").lineas[0].cantidad).toBe("6");
    expect(cantidadPorMonto("1", "0.45")).toBe("2.222");
    const c = agregar(carritoVacio(), papa, undefined, cantidadPorMonto("1", "0.45")!);
    expect(totales(c).total.toString()).toBe("1");
  });

  test("Varios, descuentos y porcentaje para pedir autorización", () => {
    let c = agregarVarios(agregar(carritoVacio(), coca, undefined, "10"), "0.50", "Fundita");
    c = { ...c, descuento: "0.50" };
    expect(totales(c).total.toString()).toBe("10");
    expect(porcentajeDescuento(c).toString()).toBe("4.76");
  });

  test("lo que se manda al servidor no lleva el precio de los productos (lo pone el servidor)", () => {
    const c = agregarVarios(agregar(carritoVacio(), coca), "2", "Hielo");
    const v = armarVenta("v1", c, [{ forma: "efectivo", monto: "3", recibido: "5" }]);
    expect(v.lineas).toEqual([
      { producto_id: "coca", presentacion_id: "u", cantidad: "1", descuento: "0" },
      { descripcion: "Hielo", precio: "2", cantidad: "1" },
    ]);
    expect(v.pagos).toEqual([{ forma: "efectivo", monto: "3", referencia: "", recibido: "5" }]);
  });
});

describe("cobrar", () => {
  test("lo que falta con pago mixto", () => {
    expect(faltaPorPagar(dec("12.80"), [{ forma: "efectivo", monto: "10" }]).toString()).toBe("2.8");
  });

  test("cambio en billetes y monedas", () => {
    expect(desgloseCambio(dec("7.20"))).toEqual([["5", 1], ["1", 2], ["0.1", 2]]);
    expect(desgloseCambio(dec("0"))).toEqual([]);
  });

  test("botones rápidos de efectivo", () => {
    expect(montosRapidos(dec("3.75"))).toEqual(["3.75", "5.00", "10.00", "20.00", "50.00"]);
    expect(montosRapidos(dec("12.80"))).toEqual(["12.80", "15.00", "20.00", "50.00"]);
  });

  test("arqueo de caja", () => {
    expect(totalArqueo({ "20": "2", "1": "3", "0.25": "4", "0.01": "" }).toString()).toBe("44");
  });
});

describe("lector de códigos", () => {
  const escribir = (d: DetectorLector, texto: string, cada: number, desde = 1000) => {
    let t = desde;
    for (const ch of texto) d.tecla(ch, (t += cada));
    return d.tecla("Enter", t + cada);
  };

  test("el lector escribe rápido y termina en Enter: se reconoce", () => {
    expect(escribir(new DetectorLector(), "7861001234565", 8)).toBe("7861001234565");
  });

  test("una persona escribiendo despacio no se confunde con el lector", () => {
    expect(escribir(new DetectorLector(), "coca", 180)).toBeNull();
  });

  test("teclas sueltas antes del código no lo arruinan", () => {
    const d = new DetectorLector();
    d.tecla("x", 0);
    expect(escribir(d, "12345678", 10, 5000)).toBe("12345678");
  });
});

describe("balanza", () => {
  test("código de peso variable: producto y precio", () => {
    expect(leerCodigoBalanza("2000025001255")).toEqual({ plu: "25", precio: "1.25" });
    expect(leerCodigoBalanza("2900000000017")).toBeNull(); // 29 = códigos internos de la tienda
    expect(leerCodigoBalanza("7861001234565")).toBeNull();
  });
});
