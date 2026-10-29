import { describe, expect, test } from "vitest";
import {
  armarImportacion,
  DESPLAZAMIENTO_COMPRAS,
  DESPLAZAMIENTO_SALIDAS,
  filasDeSalidas,
  leerMotivo,
  nombreDeFila,
  filasDeCompras,
  filasParaExportar,
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
      [fila({ nombre: "Arroz Gustadina 1 lb", categoria: "VIVERES", unidadBase: "Unidad", precioCompra: "0,50", precioVenta: "$0.65", stockInicial: "20" })],
      contexto,
    );
    expect(filas[0].errores).toEqual([]);
    expect(filas[0].coincidencia.tipo).toBe("nuevo");
    expect(filas[0].datos).toMatchObject({ precioCompra: "0.5", precioVenta: "0.65", stock: "20", esBase: true, factor: "1" });
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
        fila({ nombre: "Z", stockInicial: "dos" }),
        fila({ nombre: "W", unidadBase: "metro" }),
        fila({ nombre: "V", plu: "12345" }),
      ],
      contexto,
    );
    expect(filas[0].errores).toContain("Falta el nombre del producto.");
    expect(filas[1].errores[0]).toContain("Falta el factor");
    expect(filas[2].errores).toContain("El factor debe ser un número mayor que 0.");
    expect(filas[3].errores).toContain("El precio de venta: «uno» no es un número.");
    expect(filas[4].errores).toContain("El stock inicial: «dos» no es un número.");
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
      [fila({ nombre: "Escoba", categoria: "Limpieza", precioCompra: "3", precioVenta: "2.5" })],
      contexto,
    );
    expect(categoriasNuevas).toEqual(["Limpieza"]);
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

  test("plantillas anteriores (otros títulos y columna IVA) siguen funcionando", () => {
    expect(mapearEncabezados(["Nombre", "Precio de compra", "Stock inicial", "IVA", "Código interno"])).toEqual({
      nombre: 0,
      precioCompra: 1,
      stockInicial: 2,
      plu: 4,
    });
  });

  test("la plantilla nueva empieza por lo sencillo", () => {
    expect(COLUMNAS_PRODUCTOS.slice(0, 5).map((c) => c.titulo)).toEqual([
      "Categoría",
      "Producto",
      "Costo",
      "Precio de venta",
      "Cuántos tengo",
    ]);
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
    expect(p).toMatchObject({ id: "p1", sinonimos: ["colita"], foto_ruta: "x.jpg", retornable: true, ubicacion: "Refri", stock_real: "6" });
    expect(p.stock_inicial).toBeUndefined();
    const pres = p.presentaciones as { id?: string; precio_venta: string | null; codigos: string[] }[];
    expect(pres.map((x) => [x.id, x.precio_venta, x.codigos])).toEqual([
      ["u", "1.05", ["7861001234565"]],
      ["j", "10.8", []],
    ]);
  });

  test("sin IVA: el costo de la caja se reparte tal cual entre sus unidades", () => {
    const { filas } = revisarFilas(
      [fila({ nombre: "Detergente 1 kg", presentacion: "Caja x12", factor: "12", precioCompra: "24", precioVenta: "3" })],
      contexto,
    );
    expect(armarImportacion(filas, opciones).productos[0].costo_unitario).toBe("2"); // 24 / 12
  });

  test("las filas con errores no se guardan", () => {
    const { filas } = revisarFilas([fila({ nombre: "Malo", precioVenta: "abc" })], contexto);
    expect(armarImportacion(filas, opciones).productos).toEqual([]);
  });
});

describe("descargar mis productos (y volver a importar)", () => {
  const categorias = [
    { id: "beb", nombre: "Bebidas", padreId: null },
    { id: "gas", nombre: "Gaseosas", padreId: "beb" },
  ];
  const coca = {
    nombre: "Coca-Cola 500 ml",
    marca: "Coca-Cola",
    categoriaId: "gas",
    plu: null,
    unidadBase: "unidad" as const,
    stockMinimo: "12",
    stock: "30",
    costo: "0.75",
    presentaciones: [
      { nombre: "Unidad", factor: "1", precioVenta: "1", esBase: true, paraCompra: true, codigos: ["7861001234565"] },
      { nombre: "Jaba x12", factor: "12", precioVenta: "10.8", esBase: false, paraCompra: true, codigos: [] },
    ],
  };

  test("una fila por presentación; el stock solo en la unidad", () => {
    const filas = filasParaExportar([coca], categorias);
    expect(filas).toEqual([
      expect.objectContaining({ categoria: "Bebidas", nombre: "Coca-Cola 500 ml", presentacion: "", precioCompra: 0.75, precioVenta: 1, stockInicial: 30, stockMinimo: 12, codigoBarras: "7861001234565" }),
      expect.objectContaining({ presentacion: "Jaba x12", factor: 12, precioCompra: 9, precioVenta: 10.8, stockInicial: "" }),
    ]);
  });

  test("sin permiso de costos, la columna Costo sale vacía", () => {
    const [fila] = filasParaExportar([{ ...coca, costo: null }], categorias);
    expect(fila.precioCompra).toBe("");
  });

  test("ida y vuelta sin cambios: actualiza el mismo producto y el stock queda igual", () => {
    const exportadas = filasParaExportar([coca], categorias);
    const comoTexto = exportadas.map((e, i) => {
      const f = fila({});
      for (const c of COLUMNAS_PRODUCTOS) (f as Record<string, unknown>)[c.clave] = String(e[c.clave] ?? "");
      return { ...f, fila: i + 2 };
    });
    const actual = {
      id: "p1", nombre: coca.nombre, marca: coca.marca, categoriaId: "gas", plu: null, sinonimos: [], fotoRuta: null,
      unidadBase: "unidad" as const, tarifaIva: "15" as const, stockMinimo: "12", manejaCaducidad: false, retornable: false,
      soloMayores: false, ubicacion: "", activo: true,
      presentaciones: [
        { id: "u", nombre: "Unidad", factor: "1", precioVenta: "1", paraVenta: true, paraCompra: true, esBase: true, codigos: ["7861001234565"] },
        { id: "j", nombre: "Jaba x12", factor: "12", precioVenta: "10.8", paraVenta: true, paraCompra: true, esBase: false, codigos: [] },
      ],
    };
    const ctx = { ...contexto, categorias, productos: [{ id: "p1", nombre: coca.nombre, marca: coca.marca, plu: null, codigos: ["7861001234565"] }] };
    const { filas } = revisarFilas(comoTexto, ctx);
    expect(filas.every((f) => f.errores.length === 0)).toBe(true);
    const { productos, nuevos, actualizados } = armarImportacion(filas, {
      unirParecidos: new Set(),
      actuales: new Map([["p1", actual]]),
      categoriaId: () => "gas",
      ivaDeCategoria: () => "15",
    });
    expect([nuevos, actualizados]).toEqual([0, 1]);
    expect(productos[0]).toMatchObject({ id: "p1", stock_real: "30", costo_unitario: "0.75", stock_minimo: "12" });
    expect((productos[0].presentaciones as { id: string }[]).map((p) => p.id)).toEqual(["u", "j"]);
  });
});

describe("hoja «Compras»: lo que entró se suma", () => {
  const opciones = {
    unirParecidos: new Set<number>(),
    categoriaId: (c: string | null) => (c ? `cat:${c}` : null),
    ivaDeCategoria: () => "15" as const,
  };
  const actual = {
    id: "p1", nombre: "Coca-Cola 500 ml", marca: "Coca-Cola", categoriaId: "beb", plu: null, sinonimos: [], fotoRuta: null,
    unidadBase: "unidad" as const, tarifaIva: "15" as const, stockMinimo: "12", manejaCaducidad: false, retornable: false,
    soloMayores: false, ubicacion: "", activo: true,
    presentaciones: [
      { id: "u", nombre: "Unidad", factor: "1", precioVenta: "1", paraVenta: true, paraCompra: true, esBase: true, codigos: ["7861001234565"] },
      { id: "j", nombre: "Jaba x12", factor: "12", precioVenta: "10.8", paraVenta: true, paraCompra: true, esBase: false, codigos: [] },
    ],
  };
  const compra = (datos: Partial<FilaProducto>, n: number) => ({ ...fila(datos), fila: DESPLAZAMIENTO_COMPRAS + n, deCompras: true });

  test("2 jabas que entraron se suman como 24 unidades, con su costo; no tocan el stock real", () => {
    const { filas } = revisarFilas(
      [compra({ categoria: "Bebidas", nombre: "Coca-Cola 500 ml", presentacion: "Jaba x12", precioCompra: "9", precioVenta: "10.8", stockInicial: "2" }, 2)],
      contexto,
    );
    expect(filas[0].errores).toEqual([]); // no hace falta el factor: la jaba ya existe
    const p = armarImportacion(filas, { ...opciones, actuales: new Map([["p1", actual]]) }).productos[0];
    expect(p).toMatchObject({ id: "p1", stock_sumar: "24", costo_sumar: "0.75", stock_real: null });
  });

  test("algo nuevo comprado se crea con lo que entró como stock", () => {
    const { filas } = revisarFilas(
      [compra({ categoria: "Ferretería", nombre: "Foco LED 9W", precioCompra: "1.20", precioVenta: "2", stockInicial: "6" }, 9)],
      contexto,
    );
    const { productos, nuevos } = armarImportacion(filas, { ...opciones, actuales: new Map() });
    expect(nuevos).toBe(1);
    expect(productos[0]).toMatchObject({ nombre: "Foco LED 9W", stock_inicial: "6", costo_unitario: "1.2", categoria_id: "cat:Ferretería" });
  });

  test("la misma cosa en «Productos» (stock real) y en «Compras» (lo que entró)", () => {
    const { filas } = revisarFilas(
      [
        fila({ nombre: "Coca-Cola 500 ml", stockInicial: "30" }),
        compra({ nombre: "Coca-Cola 500 ml", presentacion: "Unidad", stockInicial: "6" }, 2),
      ],
      contexto,
    );
    const p = armarImportacion(filas, { ...opciones, actuales: new Map([["p1", actual]]) }).productos[0];
    expect(p).toMatchObject({ stock_real: "30", stock_sumar: "6" });
  });

  test("al descargar, «Compras» trae cada producto en cada forma de compra, sin cantidad", () => {
    const filasCompras = filasDeCompras(
      [{
        nombre: "Coca-Cola 500 ml", marca: "", categoriaId: "gas", plu: null, unidadBase: "unidad", stockMinimo: "0", stock: "5", costo: "0.75",
        presentaciones: [
          { nombre: "Unidad", factor: "1", precioVenta: "1", esBase: true, paraCompra: true, codigos: [] },
          { nombre: "Paquete x6", factor: "6", precioVenta: "5.5", esBase: false, paraCompra: false, codigos: [] },
          { nombre: "Jaba x12", factor: "12", precioVenta: "10.8", esBase: false, paraCompra: true, codigos: [] },
        ],
      }],
      [
        { id: "beb", nombre: "Bebidas", padreId: null },
        { id: "gas", nombre: "Gaseosas", padreId: "beb" },
      ],
    );
    expect(filasCompras).toEqual([
      { categoria: "Bebidas", nombre: "Coca-Cola 500 ml", presentacion: "Unidad", precioCompra: 0.75, precioVenta: 1, stockInicial: "", factor: "" },
      { categoria: "Bebidas", nombre: "Coca-Cola 500 ml", presentacion: "Jaba x12", precioCompra: 9, precioVenta: 10.8, stockInicial: "", factor: 12 },
    ]);
  });
});

describe("hoja «Salidas»: lo que salió se resta", () => {
  const opciones = {
    unirParecidos: new Set<number>(),
    categoriaId: (c: string | null) => (c ? `cat:${c}` : null),
    ivaDeCategoria: () => "15" as const,
  };
  const actual = {
    id: "p1", nombre: "Coca-Cola 500 ml", marca: "Coca-Cola", categoriaId: "beb", plu: null, sinonimos: [], fotoRuta: null,
    unidadBase: "unidad" as const, tarifaIva: "15" as const, stockMinimo: "12", manejaCaducidad: false, retornable: false,
    soloMayores: false, ubicacion: "", activo: true,
    presentaciones: [
      { id: "u", nombre: "Unidad", factor: "1", precioVenta: "1", paraVenta: true, paraCompra: true, esBase: true, codigos: [] },
      { id: "j", nombre: "Jaba x12", factor: "12", precioVenta: "10.8", paraVenta: true, paraCompra: true, esBase: false, codigos: [] },
    ],
  };
  const salida = (datos: Partial<FilaProducto>, n: number) => ({ ...fila(datos), fila: DESPLAZAMIENTO_SALIDAS + n, deSalidas: true });

  test("se entiende el motivo de la lista, escrito a mano o vacío (= se dañó)", () => {
    expect(leerMotivo("Se caducó")).toBe("caducado");
    expect(leerMotivo("consumo de la casa")).toBe("autoconsumo");
    expect(leerMotivo("vencido")).toBe("caducado");
    expect(leerMotivo("")).toBe("merma");
    expect(leerMotivo("vendido")).toBeNull();
    expect(nombreDeFila(DESPLAZAMIENTO_SALIDAS + 3)).toBe("Salidas 3");
  });

  test("2 que se dañaron y 1 jaba que caducó se restan en unidades, sin tocar nada más", () => {
    const { filas } = revisarFilas(
      [
        salida({ nombre: "Coca-Cola 500 ml", stockInicial: "2", motivo: "Se dañó", nota: "se rompieron" }, 2),
        salida({ nombre: "Coca-Cola 500 ml", presentacion: "Jaba x12", stockInicial: "1", motivo: "Se caducó" }, 3),
      ],
      contexto,
    );
    expect(filas.flatMap((f) => f.errores)).toEqual([]);
    expect(filas[0].avisos).toContain("Se restarán 2 (Se dañó).");
    const p = armarImportacion(filas, { ...opciones, actuales: new Map([["p1", actual]]) }).productos[0];
    expect(p).toMatchObject({
      id: "p1",
      stock_real: null,
      stock_sumar: null,
      categoria_id: "beb",
      salidas: [
        { tipo: "merma", cantidad: "2", nota: "se rompieron" },
        { tipo: "caducado", cantidad: "12", nota: "" },
      ],
    });
    expect((p.presentaciones as unknown[]).length).toBe(2);
  });

  test("un producto que no existe o un motivo raro dan error", () => {
    const { filas } = revisarFilas(
      [
        salida({ nombre: "Producto inventado XYZ", stockInicial: "1" }, 4),
        salida({ nombre: "Pan de sal", stockInicial: "3", motivo: "vendido" }, 5),
      ],
      contexto,
    );
    expect(filas[0].errores.join(" ")).toMatch(/no está en Sandry/);
    expect(filas[1].errores.join(" ")).toMatch(/Motivo no válido/);
  });

  test("al descargar, «Salidas» trae cada producto en su unidad, sin cantidad", () => {
    const filasSalidas = filasDeSalidas(
      [{
        nombre: "Papa chola", marca: "", categoriaId: "viv", plu: null, unidadBase: "libra", stockMinimo: "0", stock: "50", costo: "0.3",
        presentaciones: [{ nombre: "Libra", factor: "1", precioVenta: "0.45", esBase: true, paraCompra: true, codigos: [] }],
      }],
      contexto.categorias,
    );
    expect(filasSalidas).toEqual([{ categoria: "Víveres", nombre: "Papa chola", presentacion: "Libra", stockInicial: "", motivo: "", nota: "" }]);
  });
});
