import "server-only";
import ExcelJS from "exceljs";
import { COLUMNAS_COMPRAS, COLUMNAS_PRODUCTOS, COLUMNAS_SALIDAS, MOTIVOS_SALIDA, letraDeColumna } from "@/lib/excel/productos";

type Categoria = { id: string; nombre: string; padreId: string | null };

const VERDE = "FF15803D";
const GRIS = "FF94A3B8";
const NARANJA = "FFB45309";
const FILAS_CON_LISTAS = 2000;

function encabezado(hoja: ExcelJS.Worksheet, titulos: { titulo: string; ancho: number }[], principales = titulos.length) {
  hoja.columns = titulos.map((t) => ({ header: t.titulo, width: t.ancho }));
  const fila = hoja.getRow(1);
  fila.font = { bold: true, color: { argb: "FFFFFFFF" } };
  fila.fill = { type: "pattern", pattern: "solid", fgColor: { argb: VERDE } };
  fila.alignment = { vertical: "middle", wrapText: true };
  fila.height = 30;
  // Las columnas opcionales van en gris.
  for (let c = principales + 1; c <= titulos.length; c++) {
    fila.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: GRIS } };
  }
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

export type FilaExcel = Partial<Record<string, string | number>>;

/** Un movimiento del kardex para la hoja «Movimientos» (solo para ver). */
export type MovimientoExcel = { fecha: Date; producto: string; tipo: string; cantidad: number; saldo: number; nota: string };

/** Datos de la hoja «Resumen»: pares título → valor, en grupos. */
export type ResumenExcel = { titulo: string; filas: [texto: string, valor: string | number, dinero?: boolean][] }[];

/**
 * Plantilla de Excel de Sandry (hojas «Productos», «Compras» y «Salidas»).
 * Con datos, las hojas salen llenas («Descargar mis productos»): se editan y
 * se vuelven a importar con el mismo formato. «Resumen» y «Movimientos» son
 * solo para ver (no se importan).
 */
export async function crearPlantilla(
  categorias: Categoria[],
  datos: {
    productos?: FilaExcel[];
    compras?: FilaExcel[];
    salidas?: FilaExcel[];
    resumen?: ResumenExcel;
    movimientos?: MovimientoExcel[];
  } = {},
): Promise<Buffer> {
  const { productos = [], compras = [], salidas = [], resumen, movimientos } = datos;
  const libro = new ExcelJS.Workbook();
  libro.creator = "Sandry";
  libro.created = new Date();

  // ---------------------------------------------------------------- Instrucciones
  const inst = libro.addWorksheet("Instrucciones", { properties: { tabColor: { argb: VERDE } } });
  inst.getColumn(1).width = 110;
  const textos = [
    ["Excel de Sandry", true],
    ["", false],
    ["Hoja «Productos»: tu catálogo", true],
    ["Basta con las 5 primeras columnas (verdes): Categoría, Producto, Costo, Precio de venta y Cuántos tengo.", false],
    ["Las columnas grises son opcionales: déjalas vacías si no las necesitas.", false],
    ["Cuántos tengo: lo que hay de verdad. Si el producto ya existe y cambias el número, se corrige el stock.", false],
    ["Mira la hoja «Ejemplos» para guiarte (esa hoja NO se importa).", false],
    ["", false],
    ["Hoja «Compras»: lo que entró", true],
    ["Escribe solo «Cuántos entraron» en cada cosa que llegó. Eso se SUMA a lo que ya tienes.", false],
    ["Las filas donde no escribas nada se ignoran.", false],
    ["¿Compraste algo nuevo? Agrega una fila al final: Categoría, Producto, Costo, Precio de venta y Cuántos entraron.", false],
    ["Si llegó por jaba o paquete nuevo, pon la presentación (ej. Jaba x12) y el factor (cuántas unidades trae).", false],
    ["", false],
    ["Hoja «Salidas»: lo que salió sin venderse", true],
    ["Escribe «Cuántos salieron» y el motivo (se dañó, se caducó, consumo de la casa, regalo, robo). Eso se RESTA.", false],
    ["Si no pones motivo, se toma como «Se dañó». Las filas donde no escribas nada se ignoran.", false],
    ["Las ventas NO van aquí: se registrarán solas en la caja (fase 5).", false],
    ["", false],
    ["Hojas «Resumen» y «Movimientos»: solo para ver", true],
    ["Muestran cómo está la tienda el día que descargaste el archivo. No se importan: si las cambias no pasa nada.", false],
    ["", false],
    ["Para terminar", true],
    ["Guarda el archivo y súbelo en Sandry → Catálogo → Importar Excel. Antes de guardar verás una vista previa.", false],
    ["Puedes escribir los números con coma o con punto (1,50 o 1.50) y con o sin $.", false],
    ["", false],
    ["Columnas grises de «Productos»", true],
    ["Marca. Presentación y Factor: si lo vendes por jaba, funda o paquete, pon otra fila con el mismo producto,", false],
    ["   la presentación (ej. Jaba x12) y el factor (12). El costo y el precio son de esa presentación.", false],
    ["Se cuenta por: unidad (si no pones nada), libra, kilo o litro.", false],
    ["Código corto: un número de 1 a 4 cifras para lo que no tiene código de barras (ej. 10 = pan).", false],
  ] as const;
  textos.forEach(([texto, negrita], i) => {
    const celda = inst.getCell(`A${i + 1}`);
    celda.value = texto;
    celda.font = negrita ? { bold: true, size: i === 0 ? 16 : 12, color: { argb: VERDE } } : { size: 11 };
    celda.alignment = { wrapText: true };
  });

  // ---------------------------------------------------------------- Listas (oculta)
  const principales = categorias.filter((c) => !c.padreId);
  const listas = libro.addWorksheet("Listas", { state: "veryHidden" });
  [principales.map((c) => c.nombre), ["unidad", "libra", "kilo", "litro"], Object.values(MOTIVOS_SALIDA)].forEach((valores, c) =>
    valores.forEach((v, fila) => (listas.getCell(fila + 1, c + 1).value = v)),
  );
  const rango = (col: string, n: number) => `Listas!$${col}$1:$${col}$${Math.max(n, 1)}`;
  const listaCategorias = (hoja: ExcelJS.Worksheet, columna: string) =>
    lista(hoja, columna, rango("A", principales.length), "Elige una categoría de la lista o escribe una nueva.");

  // ---------------------------------------------------------------- Productos
  // Va vacía en la plantilla y llena en «Descargar mis productos». Los ejemplos
  // van en su propia hoja para que nunca se importen por error.
  const columnas = COLUMNAS_PRODUCTOS.map((c) => ({ titulo: c.titulo, ancho: c.ancho }));
  const prod = libro.addWorksheet("Productos");
  encabezado(prod, columnas, 5);
  for (const fila of productos) prod.addRow(COLUMNAS_PRODUCTOS.map((c) => fila[c.clave] ?? ""));
  listaCategorias(prod, letraDeColumna("categoria"));
  lista(prod, letraDeColumna("unidadBase"), rango("B", 4), "Usa unidad, libra, kilo o litro.");
  for (const clave of ["precioCompra", "precioVenta", "stockInicial", "stockMinimo", "factor"] as const) {
    prod.getColumn(letraDeColumna(clave)).numFmt = "0.00##";
  }
  prod.getColumn(letraDeColumna("codigoBarras")).numFmt = "@";
  prod.getColumn(letraDeColumna("plu")).numFmt = "@";

  // ---------------------------------------------------------------- Compras
  const comp = libro.addWorksheet("Compras", { properties: { tabColor: { argb: "FF2563EB" } } });
  encabezado(comp, COLUMNAS_COMPRAS.map((c) => ({ titulo: c.titulo, ancho: c.ancho })), 6);
  for (const fila of compras) comp.addRow(COLUMNAS_COMPRAS.map((c) => fila[c.clave] ?? ""));
  listaCategorias(comp, letraDeColumna("categoria", COLUMNAS_COMPRAS));
  for (const clave of ["precioCompra", "precioVenta", "stockInicial", "factor"] as const) {
    comp.getColumn(letraDeColumna(clave, COLUMNAS_COMPRAS)).numFmt = "0.00##";
  }
  // Resalta la columna que hay que llenar.
  const resaltar = (hoja: ExcelJS.Worksheet, columnas: readonly { clave: string }[]) =>
    (hoja.getRow(1).getCell(columnas.findIndex((c) => c.clave === "stockInicial") + 1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: NARANJA },
    });
  resaltar(comp, COLUMNAS_COMPRAS);

  // ---------------------------------------------------------------- Salidas
  const sal = libro.addWorksheet("Salidas", { properties: { tabColor: { argb: "FFDC2626" } } });
  encabezado(sal, COLUMNAS_SALIDAS.map((c) => ({ titulo: c.titulo, ancho: c.ancho })), 5);
  for (const fila of salidas) sal.addRow(COLUMNAS_SALIDAS.map((c) => fila[c.clave] ?? ""));
  sal.getColumn(letraDeColumna("stockInicial", COLUMNAS_SALIDAS)).numFmt = "0.00##";
  lista(sal, letraDeColumna("motivo", COLUMNAS_SALIDAS), rango("C", Object.keys(MOTIVOS_SALIDA).length),
    `Usa: ${Object.values(MOTIVOS_SALIDA).join(", ")}.`);
  resaltar(sal, COLUMNAS_SALIDAS);

  // ---------------------------------------------------------------- Resumen (solo para ver)
  if (resumen) {
    const res = libro.addWorksheet("Resumen", { properties: { tabColor: { argb: GRIS } } });
    res.getColumn(1).width = 46;
    res.getColumn(2).width = 18;
    res.getCell("A1").value = "Resumen de la tienda (solo para ver; esta hoja no se importa)";
    res.getCell("A1").font = { bold: true, size: 14, color: { argb: VERDE } };
    for (const grupo of resumen) {
      res.addRow([]);
      const titulo = res.addRow([grupo.titulo]);
      titulo.font = { bold: true, color: { argb: "FFFFFFFF" } };
      titulo.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: VERDE } };
      titulo.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: VERDE } };
      for (const [texto, valor, dinero] of grupo.filas) {
        const fila = res.addRow([texto, valor]);
        if (typeof valor === "number") fila.getCell(2).numFmt = dinero ? '"$"#,##0.00' : "#,##0.##";
      }
    }
  }

  // ---------------------------------------------------------------- Movimientos (solo para ver)
  if (movimientos) {
    const mov = libro.addWorksheet("Movimientos", { properties: { tabColor: { argb: GRIS } } });
    encabezado(mov, [
      { titulo: "Fecha", ancho: 18 },
      { titulo: "Producto", ancho: 32 },
      { titulo: "Qué pasó", ancho: 22 },
      { titulo: "Entró (+) / Salió (−)", ancho: 16 },
      { titulo: "Quedaron", ancho: 11 },
      { titulo: "Nota", ancho: 34 },
    ]);
    for (const m of movimientos) mov.addRow([m.fecha, m.producto, m.tipo, m.cantidad, m.saldo, m.nota]);
    mov.getColumn(1).numFmt = "dd/mm/yyyy hh:mm";
    mov.getColumn(4).numFmt = "+0.##;−0.##;0";
    mov.getColumn(5).numFmt = "0.##";
    mov.getRow(1).getCell(8).value = "← Solo para ver: esta hoja no se importa.";
    mov.getRow(1).getCell(8).font = { bold: true, color: { argb: NARANJA } };
    mov.getColumn(8).width = 40;
  }

  // ---------------------------------------------------------------- Ejemplos
  const ejemplosHoja = libro.addWorksheet("Ejemplos", { properties: { tabColor: { argb: NARANJA } } });
  encabezado(ejemplosHoja, columnas, 5);
  const ejemplos: FilaExcel[] = [
    { categoria: "Bebidas", nombre: "Coca-Cola 3 litros", precioCompra: 2.6, precioVenta: 3.5, stockInicial: 12, stockMinimo: 4 },
    { categoria: "Bebidas", nombre: "Coca-Cola 500 ml", precioCompra: 0.75, precioVenta: 1, stockInicial: 24, stockMinimo: 12, marca: "Coca-Cola" },
    { categoria: "Bebidas", nombre: "Coca-Cola 500 ml", precioCompra: 9, precioVenta: 10.8, marca: "Coca-Cola", presentacion: "Jaba x12", factor: 12 },
    { categoria: "Panadería", nombre: "Pan de sal", precioCompra: 0.1, precioVenta: 0.15, stockInicial: 40, plu: "10" },
    { categoria: "Frutas y verduras", nombre: "Papa chola", precioCompra: 0.3, precioVenta: 0.45, stockInicial: 50, unidadBase: "libra", plu: "25" },
    { categoria: "Botiquín", nombre: "Paracetamol 500 mg (sobre)", precioCompra: 0.15, precioVenta: 0.25, stockInicial: 30 },
    { categoria: "Ferretería", nombre: "Foco LED 9W", precioCompra: 1.2, precioVenta: 2, stockInicial: 6 },
  ];
  for (const e of ejemplos) ejemplosHoja.addRow(COLUMNAS_PRODUCTOS.map((c) => e[c.clave] ?? ""));
  const notaCol = columnas.length + 2;
  ejemplosHoja.getRow(1).getCell(notaCol).value = "← Solo ejemplos para guiarte: esta hoja NO se importa. Llena la hoja «Productos».";
  ejemplosHoja.getRow(1).getCell(notaCol).font = { bold: true, color: { argb: NARANJA } };
  ejemplosHoja.getColumn(notaCol).width = 60;

  // ---------------------------------------------------------------- Categorías (referencia)
  const cats = libro.addWorksheet("Categorias");
  encabezado(cats, [{ titulo: "Categorías que hay en Sandry", ancho: 36 }]);
  for (const c of principales) cats.addRow([c.nombre]);

  // Se abre en la hoja «Productos».
  libro.views = [{ x: 0, y: 0, width: 20000, height: 12000, firstSheet: 0, activeTab: 2, visibility: "visible" }];
  return Buffer.from(await libro.xlsx.writeBuffer());
}
