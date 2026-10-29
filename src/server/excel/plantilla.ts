import "server-only";
import ExcelJS from "exceljs";
import { COLUMNAS_PRODUCTOS, letraDeColumna } from "@/lib/excel/productos";

type Categoria = { id: string; nombre: string; padreId: string | null };

const VERDE = "FF15803D";
const FILAS_CON_LISTAS = 2000;

const CUENTAS_POR_DEFECTO = ["Caja", "Caja fuerte", "Banco", "Deuna", "Dinero personal de la dueña"];
const GASTOS_POR_DEFECTO = [
  "Gasolina", "Parqueadero", "Peajes", "Mantenimiento del vehículo", "Luz", "Agua", "Internet", "Teléfono",
  "Arriendo", "Sueldos", "Impuestos y permisos", "Mantenimiento del local", "Suministros", "Otros",
];

function encabezado(hoja: ExcelJS.Worksheet, titulos: { titulo: string; ancho: number }[]) {
  hoja.columns = titulos.map((t) => ({ header: t.titulo, width: t.ancho }));
  const fila = hoja.getRow(1);
  fila.font = { bold: true, color: { argb: "FFFFFFFF" } };
  fila.fill = { type: "pattern", pattern: "solid", fgColor: { argb: VERDE } };
  fila.alignment = { vertical: "middle", wrapText: true };
  fila.height = 30;
  hoja.views = [{ state: "frozen", ySplit: 1 }];
}

/** Lista desplegable en toda una columna (sin crear filas vacías). */
function lista(hoja: ExcelJS.Worksheet, columna: string, rango: string, mensaje: string) {
  (hoja as unknown as { dataValidations: { add: (rango: string, v: ExcelJS.DataValidation) => void } }).dataValidations.add(
    `${columna}2:${columna}${FILAS_CON_LISTAS}`,
    {
      type: "list",
      allowBlank: true,
      formulae: [rango],
      showErrorMessage: true,
      errorStyle: "warning",
      errorTitle: "Valor no está en la lista",
      error: mensaje,
    },
  );
}

/** Plantilla para cargar productos, compras y gastos desde Excel. */
export async function crearPlantilla(categorias: Categoria[]): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  libro.creator = "Sandry";
  libro.created = new Date();

  // ---------------------------------------------------------------- Instrucciones
  const inst = libro.addWorksheet("Instrucciones", { properties: { tabColor: { argb: VERDE } } });
  inst.getColumn(1).width = 110;
  const textos = [
    ["Plantilla de Sandry", true],
    ["", false],
    ["Cómo usarla", true],
    ["1. Llena la hoja «Productos». Basta con las 5 primeras columnas: Categoría, Producto, Costo, Precio de venta y Cuántos tengo.", false],
    ["2. Las columnas grises son opcionales: déjalas vacías si no las necesitas.", false],
    ["3. Mira la hoja «Ejemplos» para guiarte (esa hoja NO se importa).", false],
    ["4. Guarda el archivo y súbelo en Sandry → Catálogo → Importar Excel. Antes de guardar verás una vista previa.", false],
    ["", false],
    ["Lo principal", true],
    ["Categoría: elige de la lista (o escribe una nueva y Sandry te preguntará si la crea).", false],
    ["Producto: el nombre como quieras verlo en la tienda (ej. Coca-Cola 3 litros).", false],
    ["Costo: lo que te cuesta. Precio de venta: a cuánto lo vendes.", false],
    ["Cuántos tengo: el stock de hoy. Avisar si quedan menos de: para el aviso de stock bajo.", false],
    ["Puedes escribir los números con coma o con punto (1,50 o 1.50) y con o sin $.", false],
    ["", false],
    ["Opcional (columnas grises)", true],
    ["Marca. Presentación y Factor: si lo vendes por jaba, funda o paquete, pon una fila más con el mismo producto,", false],
    ["   la presentación (ej. Jaba x12) y el factor (cuántas unidades trae: 12). El costo y el precio son de esa presentación.", false],
    ["Se cuenta por: unidad (si no pones nada), libra, kilo o litro.", false],
    ["Código corto: un número de 1 a 4 cifras para lo que no tiene código de barras (ej. 10 = pan).", false],
    ["Código de barras: el número debajo de las barras. Subcategoría: casi nunca hace falta.", false],
    ["", false],
    ["Hojas «Compras» y «Gastos»", true],
    ["Se podrán importar cuando estén listas las fases de compras (fase 4) y gastos (fase 6).", false],
  ] as const;
  textos.forEach(([texto, negrita], i) => {
    const celda = inst.getCell(`A${i + 1}`);
    celda.value = texto;
    celda.font = negrita ? { bold: true, size: i === 0 ? 16 : 12, color: { argb: VERDE } } : { size: 11 };
    celda.alignment = { wrapText: true };
  });

  // ---------------------------------------------------------------- Listas (oculta)
  const raices = categorias.filter((c) => !c.padreId);
  const hijas = categorias.filter((c) => c.padreId);
  const listas = libro.addWorksheet("Listas", { state: "veryHidden" });
  const columnasListas: string[][] = [
    raices.map((c) => c.nombre),
    hijas.map((c) => c.nombre),
    ["unidad", "libra", "kilo", "litro"],
    ["sí", "no"],
    CUENTAS_POR_DEFECTO,
    GASTOS_POR_DEFECTO,
  ];
  columnasListas.forEach((valores, c) => valores.forEach((v, fila) => (listas.getCell(fila + 1, c + 1).value = v)));
  const rango = (col: string, n: number) => `Listas!$${col}$1:$${col}$${Math.max(n, 1)}`;

  // ---------------------------------------------------------------- Productos
  // La hoja «Productos» va vacía (lista para llenar). Los ejemplos van en su
  // propia hoja para que nunca se importen por error. Lo principal va primero
  // (verde) y lo opcional después (gris).
  const columnas = COLUMNAS_PRODUCTOS.map((c) => ({ titulo: c.titulo, ancho: c.ancho }));
  const PRINCIPALES = 5;
  const pintarOpcionales = (hoja: ExcelJS.Worksheet) => {
    for (let c = PRINCIPALES + 1; c <= columnas.length; c++) {
      const celda = hoja.getRow(1).getCell(c);
      celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF94A3B8" } };
    }
  };
  const prod = libro.addWorksheet("Productos");
  encabezado(prod, columnas);
  pintarOpcionales(prod);
  const ejemplosHoja = libro.addWorksheet("Ejemplos", { properties: { tabColor: { argb: "FFB45309" } } });
  encabezado(ejemplosHoja, columnas);
  pintarOpcionales(ejemplosHoja);

  type Ejemplo = Partial<Record<(typeof COLUMNAS_PRODUCTOS)[number]["clave"], string | number>>;
  const ejemplos: Ejemplo[] = [
    { categoria: "Bebidas", nombre: "Coca-Cola 3 litros", precioCompra: 2.6, precioVenta: 3.5, stockInicial: 12, stockMinimo: 4 },
    { categoria: "Bebidas", nombre: "Coca-Cola 500 ml", precioCompra: 0.75, precioVenta: 1, stockInicial: 24, stockMinimo: 12, marca: "Coca-Cola" },
    { categoria: "Bebidas", nombre: "Coca-Cola 500 ml", precioCompra: 9, precioVenta: 10.8, marca: "Coca-Cola", presentacion: "Jaba x12", factor: 12 },
    { categoria: "Panadería", nombre: "Pan de sal", precioCompra: 0.1, precioVenta: 0.15, stockInicial: 40, plu: "10" },
    { categoria: "Frutas y verduras", nombre: "Papa chola", precioCompra: 0.3, precioVenta: 0.45, stockInicial: 50, unidadBase: "libra", plu: "25" },
    { categoria: "Golosinas y snacks", nombre: "Caramelo de leche", precioVenta: 0.05, plu: "30" },
    { categoria: "Golosinas y snacks", nombre: "Caramelo de leche", precioCompra: 2, precioVenta: 4, stockInicial: 3, presentacion: "Funda x100", factor: 100, plu: "30" },
  ];
  for (const e of ejemplos) ejemplosHoja.addRow(COLUMNAS_PRODUCTOS.map((c) => e[c.clave] ?? ""));
  const notaCol = columnas.length + 2;
  ejemplosHoja.getRow(1).getCell(notaCol).value = "← Solo ejemplos para guiarte: esta hoja NO se importa. Llena la hoja «Productos».";
  ejemplosHoja.getRow(1).getCell(notaCol).font = { bold: true, color: { argb: "FFB45309" } };
  ejemplosHoja.getColumn(notaCol).width = 60;

  lista(prod, letraDeColumna("categoria"), rango("A", raices.length), "Elige una categoría de la lista o escribe una nueva.");
  lista(prod, letraDeColumna("subcategoria"), rango("B", hijas.length), "Elige una subcategoría de la lista o escribe una nueva.");
  lista(prod, letraDeColumna("unidadBase"), rango("C", 4), "Usa unidad, libra, kilo o litro.");
  for (const clave of ["precioCompra", "precioVenta", "stockInicial", "stockMinimo", "factor"] as const) {
    prod.getColumn(letraDeColumna(clave)).numFmt = "0.00##";
  }
  prod.getColumn(letraDeColumna("codigoBarras")).numFmt = "@";
  prod.getColumn(letraDeColumna("plu")).numFmt = "@";

  // ---------------------------------------------------------------- Compras
  const compras = libro.addWorksheet("Compras");
  encabezado(compras, [
    { titulo: "Fecha", ancho: 12 }, { titulo: "Lugar o proveedor", ancho: 24 }, { titulo: "Número de factura", ancho: 18 },
    { titulo: "Con factura", ancho: 11 }, { titulo: "Cuenta de dinero", ancho: 22 }, { titulo: "Código o nombre del producto", ancho: 30 },
    { titulo: "Presentación", ancho: 16 }, { titulo: "Cantidad", ancho: 10 }, { titulo: "Costo", ancho: 10 },
  ]);
  lista(compras, "D", rango("D", 2), "Escribe sí o no.");
  lista(compras, "E", rango("E", CUENTAS_POR_DEFECTO.length), "Elige una cuenta de la lista.");
  compras.getColumn("A").numFmt = "dd/mm/yyyy";

  // ---------------------------------------------------------------- Gastos
  const gastos = libro.addWorksheet("Gastos");
  encabezado(gastos, [
    { titulo: "Fecha", ancho: 12 }, { titulo: "Categoría", ancho: 24 }, { titulo: "Descripción", ancho: 34 },
    { titulo: "Monto", ancho: 10 }, { titulo: "Cuenta de dinero", ancho: 22 },
  ]);
  lista(gastos, "B", rango("F", GASTOS_POR_DEFECTO.length), "Elige una categoría de gasto.");
  lista(gastos, "E", rango("E", CUENTAS_POR_DEFECTO.length), "Elige una cuenta de la lista.");
  gastos.getColumn("A").numFmt = "dd/mm/yyyy";

  // ---------------------------------------------------------------- Categorías (referencia)
  const cats = libro.addWorksheet("Categorias");
  encabezado(cats, [{ titulo: "Categoría", ancho: 32 }, { titulo: "Subcategoría", ancho: 32 }]);
  for (const r of raices) {
    const propias = hijas.filter((h) => h.padreId === r.id);
    if (!propias.length) cats.addRow([r.nombre, ""]);
    for (const h of propias) cats.addRow([r.nombre, h.nombre]);
  }

  // El orden de las pestañas: Instrucciones primero, luego Productos.
  libro.views = [{ x: 0, y: 0, width: 20000, height: 12000, firstSheet: 0, activeTab: 1, visibility: "visible" }];
  return Buffer.from(await libro.xlsx.writeBuffer());
}
