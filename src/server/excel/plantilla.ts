import "server-only";
import ExcelJS from "exceljs";
import { COLUMNAS_PRODUCTOS } from "@/lib/excel/productos";

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
    ["1. Llena la hoja «Productos»: una fila por cada presentación (unidad, paquete, jaba, libra...). Mira la hoja «Ejemplos» para guiarte.", false],
    ["2. Si un producto se vende de varias formas, repite el nombre en varias filas (una por presentación).", false],
    ["3. Las columnas con flechita tienen una lista para elegir (categoría, unidad, IVA, cuentas...).", false],
    ["4. Guarda el archivo y súbelo en Sandry → Catálogo → Importar. Antes de guardar verás una vista previa.", false],
    ["", false],
    ["Columnas de «Productos»", true],
    ["Código de barras: el número debajo de las barras del producto o de la caja. Si no tiene, déjalo vacío.", false],
    ["Código interno: un número corto de 1 a 4 cifras para productos sin código (ej. 10 = pan). Opcional.", false],
    ["Nombre, Marca: como quieras que aparezca en la tienda.", false],
    ["Categoría y Subcategoría: elige de la lista. Si escribes una nueva, Sandry te preguntará si la crea.", false],
    ["Unidad base: cómo se cuenta el stock: unidad, libra, kilo o litro.", false],
    ["Presentación: Unidad, Funda x100, Paquete x6, Jaba x12, Libra... (vacío = la unidad base).", false],
    ["Factor: cuántas unidades base trae la presentación. Jaba x12 = 12. Unidad = 1. Papas: 1 unidad ≈ 0.4 libras.", false],
    ["Precio de compra: lo que pagas por ESA presentación (ej. la jaba completa).", false],
    ["Precio de venta: lo que cobras por ESA presentación, con IVA incluido.", false],
    ["IVA: 15%, 0% o exento. Vacío = el de la categoría.", false],
    ["Stock inicial: cuántas tienes de ESA presentación (ej. 2 jabas). Se convierte solo a unidades.", false],
    ["Stock mínimo: desde cuántas unidades base quieres un aviso de stock bajo.", false],
    ["Puedes escribir los números con coma o con punto (1,50 o 1.50) y con o sin $.", false],
    ["", false],
    ["Hojas «Compras» y «Gastos»", true],
    ["Se podrán importar cuando estén listas las fases de compras (fase 4) y gastos (fase 6).", false],
    ["La hoja «Categorías» es solo de referencia: muestra las categorías que existen hoy en Sandry.", false],
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
    ["15%", "0%", "exento"],
    ["sí", "no"],
    CUENTAS_POR_DEFECTO,
    GASTOS_POR_DEFECTO,
  ];
  columnasListas.forEach((valores, c) => valores.forEach((v, f) => (listas.getCell(f + 1, c + 1).value = v)));
  const rango = (col: string, n: number) => `Listas!$${col}$1:$${col}$${Math.max(n, 1)}`;

  // ---------------------------------------------------------------- Productos
  // La hoja «Productos» va vacía (lista para llenar). Los ejemplos van en su
  // propia hoja para que nunca se importen por error.
  const prod = libro.addWorksheet("Productos");
  encabezado(prod, COLUMNAS_PRODUCTOS.map((c) => ({ titulo: c.titulo, ancho: c.ancho })));
  const ejemplosHoja = libro.addWorksheet("Ejemplos", { properties: { tabColor: { argb: "FFB45309" } } });
  encabezado(ejemplosHoja, COLUMNAS_PRODUCTOS.map((c) => ({ titulo: c.titulo, ancho: c.ancho })));
  const ejemplos = [
    ["7861001234565", "", "Coca-Cola 500 ml", "Coca-Cola", "Bebidas", "Gaseosas", "unidad", "Unidad", 1, 0.75, 1, "15%", 24, 12, "", "Coca-Cola"],
    ["17861001234562", "", "Coca-Cola 500 ml", "Coca-Cola", "Bebidas", "Gaseosas", "unidad", "Jaba x12", 12, 9, 10.8, "15%", 0, "", "", "Coca-Cola"],
    ["", "25", "Papa chola", "", "Frutas y verduras", "Tubérculos (papas)", "libra", "Libra", 1, 0.3, 0.45, "0%", 50, 10, "", "Mercado"],
    ["", "25", "Papa chola", "", "Frutas y verduras", "Tubérculos (papas)", "libra", "Unidad", 0.4, "", 0.2, "0%", "", "", "", ""],
    ["", "10", "Pan de sal", "", "Panadería", "", "unidad", "Unidad", 1, 0.1, 0.15, "0%", 40, 20, "", "Panadería"],
    ["", "30", "Caramelo de leche", "", "Golosinas y snacks", "Caramelos", "unidad", "Unidad", 1, "", 0.05, "15%", "", "", "", ""],
    ["", "30", "Caramelo de leche", "", "Golosinas y snacks", "Caramelos", "unidad", "Funda x100", 100, 2, 4, "15%", 3, 50, "", "Mayorista"],
  ];
  ejemplos.forEach((e) => ejemplosHoja.addRow(e));
  ejemplosHoja.getCell("Q1").value = "← Solo ejemplos para guiarte: esta hoja NO se importa. Llena la hoja «Productos».";
  ejemplosHoja.getCell("Q1").font = { bold: true, color: { argb: "FFB45309" } };
  ejemplosHoja.getColumn(17).width = 60;
  lista(prod, "E", rango("A", raices.length), "Elige una categoría de la lista o escribe una nueva.");
  lista(prod, "F", rango("B", hijas.length), "Elige una subcategoría de la lista o escribe una nueva.");
  lista(prod, "G", rango("C", 4), "Usa unidad, libra, kilo o litro.");
  lista(prod, "L", rango("D", 3), "Usa 15%, 0% o exento.");
  for (const col of ["I", "J", "K", "M", "N"]) prod.getColumn(col).numFmt = "0.00##";
  prod.getColumn("A").numFmt = "@";
  prod.getColumn("B").numFmt = "@";

  // ---------------------------------------------------------------- Compras
  const compras = libro.addWorksheet("Compras");
  encabezado(compras, [
    { titulo: "Fecha", ancho: 12 }, { titulo: "Lugar o proveedor", ancho: 24 }, { titulo: "Número de factura", ancho: 18 },
    { titulo: "Con factura", ancho: 11 }, { titulo: "Cuenta de dinero", ancho: 22 }, { titulo: "Código o nombre del producto", ancho: 30 },
    { titulo: "Presentación", ancho: 16 }, { titulo: "Cantidad", ancho: 10 }, { titulo: "Costo", ancho: 10 },
  ]);
  lista(compras, "D", rango("E", 2), "Escribe sí o no.");
  lista(compras, "E", rango("F", CUENTAS_POR_DEFECTO.length), "Elige una cuenta de la lista.");
  compras.getColumn("A").numFmt = "dd/mm/yyyy";

  // ---------------------------------------------------------------- Gastos
  const gastos = libro.addWorksheet("Gastos");
  encabezado(gastos, [
    { titulo: "Fecha", ancho: 12 }, { titulo: "Categoría", ancho: 24 }, { titulo: "Descripción", ancho: 34 },
    { titulo: "Monto", ancho: 10 }, { titulo: "Cuenta de dinero", ancho: 22 },
  ]);
  lista(gastos, "B", rango("G", GASTOS_POR_DEFECTO.length), "Elige una categoría de gasto.");
  lista(gastos, "E", rango("F", CUENTAS_POR_DEFECTO.length), "Elige una cuenta de la lista.");
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
