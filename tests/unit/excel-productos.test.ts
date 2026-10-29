import { describe, expect, test } from "vitest";
import {
  armarImportacion,
  COLUMNAS_PRODUCTOS,
  mapearEncabezados,
  normalizarTexto,
  parecido,
  revisarFilas,
  textoDeCelda,
  type ContextoImportacion,
  type FilaProducto,
} from "@/lib/excel/productos";

const contexto: ContextoImportacion = {
  puedeVerCostos: true,
  categorias: [
    { id: "beb", nombre: "Bebidas", padreId: null },
    { id: "gas", nombre: "Gaseosas", padreId: "beb" },
    { id: "viv", nombre: "Víveres", padreId: null },
  ],
  productos: [
    { id: "p1", nombre: "Coca-Cola 500 ml", marca: "Coca-Cola", plu: null, codigos: ["7861001234565"] },
    { id: "p2", nombre: "Pan de sal", marca: "", plu: "10", codigos: [] },
  ],
};

let n = 1;
function fila(datos: Partial<FilaProducto>): FilaProducto {
  const vacia = Object.fromEntries(COLUMNAS_PRODUCTOS.map((c) => [c.clave, ""])) as Record<string, string>;
  return { ...vacia, fila: ++n, ...datos } as FilaProducto;
}

describe("revisar filas del Excel", () => {
  test("producto nuevo correcto, tolerante con coma decimal, tildes y mayúsculas", () => {
    const { filas, categoriasNuevas } = revisarFilas(
      [fila({ nombre: "Arroz Gustadina 1 lb", categoria: "VIVERES", unidadBase: "Unidad", precioCompra: "0,50", precioVenta: "$0.65", compraConIva: "no", stockInicial: "20" })],
      contexto,
    );
    expect(filas[0].errores).toEqual([]);
    expect(filas[0].coincidencia.tipo).toBe("nuevo");
    expect(filas[0].datos).toMatchObject({ precioCompra: "0.5", precioVenta: "0.65", compraConIva: false, stock: "20", esBase: true, factor: "1" });
    expect(categoriasNuevas).toEqual([]);
  });

  test("las filas vacías se ignoran", () => {
    const { filas } = revisarFilas([fila({})], contexto);
    expect(filas[0].vacia).toBe(true);
    expect(filas[0].errores).toEqual([]);
  });

  test("encuentra el producto existente por código, por código interno y por nombre", () => {
    const { filas } = revisarFilas(
      [
        fila({ codigoBarras: "7861001234565", precioVenta: "1.10" }),
        fila({ plu: "010", precioVenta: "0.20" }),
        fila({ nombre: "pan  DE sal", precioVenta: "0.20" }),
        fila({ nombre: "Coca Cola 500ml", precioVenta: "1" }),
      ],
      contexto,
    );
    expect(filas.map((f) => f.coincidencia.tipo)).toEqual(["codigo", "plu", "nombre", "parecido"]);
    expect(filas[0].datos?.nombre).toBe("Coca-Cola 500 ml");
  });

  test("explica cada problema en español", () => {
    const { filas } = revisarFilas(
      [
        fila({ precioVenta: "1" }),
        fila({ nombre: "Jaba Pilsener", presentacion: "Jaba x12" }),
        fila({ nombre: "X", factor: "-2", presentacion: "Caja" }),
        fila({ nombre: "Y", precioVenta: "uno" }),
        fila({ nombre: "Z", compraConIva: "quizás" }),
        fila({ nombre: "W", unidadBase: "metro" }),
        fila({ nombre: "V", plu: "12345" }),
      ],
      contexto,
    );
    expect(filas[0].errores).toContain("Falta el nombre del producto.");
    expect(filas[1].errores[0]).toContain("Falta el factor");
    expect(filas[2].errores).toContain("El factor debe ser un número mayor que 0.");
    expect(filas[3].errores).toContain("El precio de venta: «uno» no es un número.");
    expect(filas[4].errores).toContain("«Compra con IVA»: escribe sí o no.");
    expect(filas[5].errores[0]).toContain("Unidad base no válida");
    expect(filas[6].errores).toContain("El código interno debe ser un número de 1 a 4 cifras.");
  });

  test("detecta códigos repetidos entre productos distintos del archivo", () => {
    const { filas } = revisarFilas(
      [fila({ nombre: "Uno", codigoBarras: "123456" }), fila({ nombre: "Dos", codigoBarras: "123456" })],
      contexto,
    );
    expect(filas[1].errores[0]).toContain("repetido en otra fila");
  });

  test("varias presentaciones del mismo producto pueden compartir filas sin conflicto", () => {
    const { filas } = revisarFilas(
      [
        fila({ nombre: "Caramelo de leche", presentacion: "Unidad", precioVenta: "0.05", plu: "25" }),
        fila({ nombre: "Caramelo de leche", presentacion: "Funda x100", factor: "100", precioCompra: "2.00", precioVenta: "4.00", plu: "25" }),
      ],
      contexto,
    );
    expect(filas.every((f) => f.errores.length === 0)).toBe(true);
    expect(filas[1].datos).toMatchObject({ esBase: false, factor: "100" });
  });

  test("papas por libra, con «unidad» de 0.4 lb", () => {
    const { filas } = revisarFilas(
      [fila({ nombre: "Papa chola", unidadBase: "lb", presentacion: "Unidad", factor: "0,4", precioVenta: "0.25" })],
      contexto,
    );
    expect(filas[0].errores).toEqual([]);
    expect(filas[0].datos).toMatchObject({ unidadBase: "libra", factor: "0.4", esBase: false });
  });

  test("avisa categorías nuevas y venta a pérdida", () => {
    const { filas, categoriasNuevas } = revisarFilas(
      [fila({ nombre: "Escoba", categoria: "Limpieza", subcategoria: "Escobas", precioCompra: "3", precioVenta: "2.5" })],
      contexto,
    );
    expect(categoriasNuevas).toEqual(["Limpieza", "Limpieza → Escobas"]);
    expect(filas[0].avisos.join(" ")).toContain("pérdida");
  });

  test("sin permiso de costos, el precio de compra se ignora con aviso", () => {
    const { filas } = revisarFilas([fila({ nombre: "Algo", precioCompra: "1" })], { ...contexto, puedeVerCostos: false });
    expect(filas[0].datos?.precioCompra).toBeNull();
    expect(filas[0].avisos[0]).toContain("permiso de costos");
  });
});

describe("utilidades", () => {
  test("normalizar y parecido", () => {
    expect(normalizarTexto("  Víveres  y ABARROTES ")).toBe("viveres y abarrotes");
    expect(parecido("Coca-Cola 500 ml", "coca cola 500ml")).toBeGreaterThan(0.6);
    expect(parecido("Coca-Cola", "Arroz")).toBeLessThan(0.2);
  });

  test("encabezados tolerantes", () => {
    const mapa = mapearEncabezados(["NOMBRE", "codigo de barras", "Precio de Venta", "Otra cosa"]);
    expect(mapa).toEqual({ nombre: 0, codigoBarras: 1, precioVenta: 2 });
  });

  test("plantillas viejas con la columna «IVA» siguen funcionando", () => {
    expect(mapearEncabezados(["Nombre", "IVA"])).toEqual({ nombre: 0, compraConIva: 1 });
    expect(mapearEncabezados(["Nombre", "Compra con IVA"])).toEqual({ nombre: 0, compraConIva: 1 });
  });

  test("celdas de Excel a texto", () => {
    expect(textoDeCelda(1.5)).toBe("1.5");
    expect(textoDeCelda({ richText: [{ text: "Coca" }, { text: "-Cola" }] })).toBe("Coca-Cola");
    expect(textoDeCelda({ formula: "A1*2", result: 4 })).toBe("4");
    expect(textoDeCelda(new Date(Date.UTC(2026, 11, 31)))).toBe("31/12/2026");
    expect(textoDeCelda(null)).toBe("");
  });
});

describe("armar lo que se guarda", () => {
  const opciones = {
    unirParecidos: new Set<number>(),
    actuales: new Map(),
    categoriaId: (c: string | null) => (c ? `cat:${c}` : null),
    ivaDeCategoria: () => "15" as const,
  };

  test("dos filas del mismo producto = un producto con dos presentaciones; stock en unidad base", () => {
    const { filas } = revisarFilas(
      [
        fila({ nombre: "Caramelo de leche", presentacion: "Unidad", precioVenta: "0.05", stockInicial: "30", categoria: "Golosinas" }),
        fila({ nombre: "Caramelo de leche", presentacion: "Funda x100", factor: "100", precioCompra: "2", precioVenta: "4", stockInicial: "3" }),
      ],
      contexto,
    );
    const { productos, nuevos } = armarImportacion(filas, opciones);
    expect(nuevos).toBe(1);
    expect(productos).toHaveLength(1);
    const p = productos[0];
    expect(p.stock_inicial).toBe("330"); // 30 + 3×100
    expect(p.costo_unitario).toBe("0.02"); // $2 / 100
    expect(p.categoria_id).toBe("cat:Golosinas");
    expect((p.presentaciones as { nombre: string; es_base: boolean }[]).map((x) => [x.nombre, x.es_base])).toEqual([
      ["Unidad", true],
      ["Funda x100", false],
    ]);
  });

  test("si solo viene la jaba, se agrega la unidad base sin precio", () => {
    const { filas } = revisarFilas(
      [fila({ nombre: "Pilsener 600", presentacion: "Jaba x12", factor: "12", precioCompra: "13.20", stockInicial: "2" })],
      contexto,
    );
    const p = armarImportacion(filas, opciones).productos[0];
    expect((p.presentaciones as { nombre: string; es_base: boolean; factor: string }[])[0]).toMatchObject({
      nombre: "Unidad",
      es_base: true,
      factor: "1",
    });
    expect(p.stock_inicial).toBe("24");
    expect(p.costo_unitario).toBe("1.1");
  });

  test("un producto existente se actualiza sin perder sus presentaciones ni códigos", () => {
    const actual = {
      id: "p1", nombre: "Coca-Cola 500 ml", marca: "Coca-Cola", categoriaId: "gas", plu: null, sinonimos: ["colita"], fotoRuta: "x.jpg",
      unidadBase: "unidad" as const, tarifaIva: "15" as const, stockMinimo: "12", manejaCaducidad: false, retornable: true,
      soloMayores: false, ubicacion: "Refri", activo: true,
      presentaciones: [
        { id: "u", nombre: "Unidad", factor: "1", precioVenta: "1", paraVenta: true, paraCompra: true, esBase: true, codigos: ["7861001234565"] },
        { id: "j", nombre: "Jaba x12", factor: "12", precioVenta: "10.8", paraVenta: true, paraCompra: true, esBase: false, codigos: [] },
      ],
    };
    const { filas } = revisarFilas([fila({ codigoBarras: "7861001234565", precioVenta: "1.05", stockInicial: "6" })], contexto);
    const { productos, actualizados } = armarImportacion(filas, { ...opciones, actuales: new Map([["p1", actual]]) });
    expect(actualizados).toBe(1);
    const p = productos[0];
    expect(p).toMatchObject({ id: "p1", sinonimos: ["colita"], foto_ruta: "x.jpg", retornable: true, ubicacion: "Refri", stock_inicial: "6" });
    const pres = p.presentaciones as { id?: string; precio_venta: string | null; codigos: string[] }[];
    expect(pres.map((x) => [x.id, x.precio_venta, x.codigos])).toEqual([
      ["u", "1.05", ["7861001234565"]],
      ["j", "10.8", []],
    ]);
  });

  test("«Compra con IVA = sí» guarda el costo REAL (factura + 15%)", () => {
    const { filas } = revisarFilas(
      [fila({ nombre: "Detergente 1 kg", presentacion: "Caja x12", factor: "12", precioCompra: "24", compraConIva: "sí", precioVenta: "3" })],
      contexto,
    );
    const p = armarImportacion(filas, { ...opciones, ivaCompras: "15" }).productos[0];
    expect(p.costo_unitario).toBe("2.3"); // (24 × 1.15) / 12
    expect(p.compra_con_iva).toBe(true);
  });

  test("«Compra con IVA = no» deja el costo como está", () => {
    const { filas } = revisarFilas([fila({ nombre: "Huevos", precioCompra: "0.12", compraConIva: "no", precioVenta: "0.20" })], contexto);
    const p = armarImportacion(filas, { ...opciones, ivaCompras: "15" }).productos[0];
    expect(p.costo_unitario).toBe("0.12");
    expect(p.compra_con_iva).toBe(false);
  });

  test("avisa pérdida comparando con el costo real (con IVA)", () => {
    const { filas } = revisarFilas(
      [fila({ nombre: "Aceite", precioCompra: "2.00", compraConIva: "sí", precioVenta: "2.25" })],
      { ...contexto, ivaCompras: "15" },
    );
    expect(filas[0].avisos.join(" ")).toContain("costo real (2.30)");
  });

  test("las filas con errores no se guardan", () => {
    const { filas } = revisarFilas([fila({ nombre: "Malo", precioVenta: "abc" })], contexto);
    expect(armarImportacion(filas, opciones).productos).toEqual([]);
  });
});
