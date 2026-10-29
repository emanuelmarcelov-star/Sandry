import { expect, test } from "@playwright/test";
import ExcelJS from "exceljs";
import { DUENA, entrar } from "./datos";

/*
 * Catálogo de punta a punta (corre después de usuarios.spec.ts, que crea a la
 * administradora). Las pruebas van en orden y comparten datos.
 */
test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  await entrar(page, DUENA.correo);
});

test("crear un producto con presentaciones: margen, pérdida y precio sugerido", async ({ page }) => {
  await page.goto("/catalogo/nuevo");
  await page.getByLabel("Nombre").fill("Coca-Cola 500 ml");
  await page.getByLabel("Marca").fill("Coca-Cola");
  await page.getByLabel("Categoría").selectOption({ label: "Bebidas › Gaseosas" });
  await page.getByLabel("Apodos para buscarlo").fill("colita, coca");
  await page.getByLabel("Costo de compra por unidad").fill("0.75");
  // Sin IVA en ninguna parte: ni de venta ni de compra.
  await expect(page.getByText(/IVA/)).toHaveCount(0);
  await page.getByLabel("Stock inicial (unidad)").fill("24");

  await page.locator("#pres-0-precio").fill("1.00");
  await page.locator("#pres-0-codigos").fill("7861001234565");
  await expect(page.getByText("Margen: 33.3% · Ganancia: $0.25")).toBeVisible();

  await page.getByRole("button", { name: "Agregar presentación" }).click();
  await page.locator("#pres-1-nombre").fill("Jaba x12");
  await page.locator("#pres-1-factor").fill("12");
  await page.locator("#pres-1-precio").fill("8");
  await expect(page.getByText(/¡A pérdida!/)).toBeVisible(); // costo de la jaba: $9.00
  await expect(page.getByText("Sugerido (20%): $10.80")).toBeVisible();
  await page.getByRole("button", { name: "Usar" }).nth(1).click();
  await expect(page.locator("#pres-1-precio")).toHaveValue("10.80");

  await page.getByRole("button", { name: "Guardar producto" }).click();
  await expect(page).toHaveURL(/\/catalogo$/);
  const fila = page.getByRole("listitem").filter({ hasText: "Coca-Cola 500 ml" });
  await expect(fila).toContainText("$1.00");
  await expect(fila).toContainText("24 unidades");

  // Al volver a abrirlo, el costo es el mismo que se escribió.
  await fila.click();
  await expect(page.getByLabel("Costo de compra por unidad")).toHaveValue("0.75");
});

test("ajustar stock desde la ficha: sumar jabas, corregir conteo y sacar", async ({ page }) => {
  await page.goto("/catalogo?q=colita");
  await page.getByRole("listitem").filter({ hasText: "Coca-Cola 500 ml" }).click();

  // Llegaron 2 jabas: se convierten a 24 unidades.
  await page.getByRole("button", { name: "Sumar (llegó mercadería)" }).click();
  await page.getByLabel("¿En qué presentación?").selectOption({ label: "Jaba x12 (12 unidades)" });
  await page.getByLabel("Cantidad").fill("2");
  await expect(page.getByText("= 24 unidades")).toBeVisible();
  // No se vuelve a pedir el costo: se usa el que ya tiene el producto.
  await expect(page.getByRole("dialog").getByLabel(/Costo/)).toHaveCount(0);
  await page.getByLabel("Nota").fill("distribuidor");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Stock actualizado. Ahora hay 48 unidades.")).toBeVisible();

  // El conteo real da 45.
  await page.getByRole("button", { name: "Corregir conteo" }).click();
  await expect(page.getByText("Según la app hay 48 unidades.")).toBeVisible();
  await page.getByLabel(/¿Cuántas hay realmente\?/).fill("45");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Stock actualizado. Ahora hay 45 unidades.")).toBeVisible();

  // Se rompió una.
  await page.getByRole("button", { name: "Sacar (daño, consumo…)" }).click();
  await page.getByLabel("Motivo").selectOption({ label: "Se dañó o se rompió" });
  await page.getByLabel("Cantidad").fill("1");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Stock actualizado. Ahora hay 44 unidades.")).toBeVisible();

  // Todo queda en los últimos movimientos.
  await expect(page.getByText("Llegó mercadería: +24 unidades · distribuidor")).toBeVisible();
  await expect(page.getByText("Corrección de conteo: −3 unidades")).toBeVisible();
  await expect(page.getByText("Se dañó: −1 unidad")).toBeVisible();
});

test("la búsqueda encuentra por apodo y por código", async ({ page }) => {
  await page.goto("/catalogo?q=colita");
  await expect(page.getByRole("listitem").filter({ hasText: "Coca-Cola 500 ml" })).toBeVisible();
  await page.goto("/catalogo?q=7861001234565");
  await expect(page.getByRole("listitem").filter({ hasText: "Coca-Cola 500 ml" })).toBeVisible();
  await page.goto("/catalogo?q=xyzxyz");
  await expect(page.getByText("No hay productos que coincidan.")).toBeVisible();
});

test("importar desde la plantilla de Excel, corrigiendo un error en pantalla", async ({ page, request }) => {
  // Descarga la plantilla y la llena como lo haría la tienda.
  const respuesta = await page.request.get("/catalogo/importar/plantilla");
  expect(respuesta.ok()).toBe(true);
  const libro = new ExcelJS.Workbook();
  const cuerpo = await respuesta.body();
  await libro.xlsx.load(cuerpo.buffer.slice(cuerpo.byteOffset, cuerpo.byteOffset + cuerpo.byteLength) as ArrayBuffer);
  expect(libro.worksheets.map((h) => h.name)).toEqual(["Instrucciones", "Listas", "Productos", "Ejemplos", "Compras", "Gastos", "Categorias"]);
  const hoja = libro.getWorksheet("Productos")!;
  [
    // Categoría, Producto, Costo, Precio de venta, Cuántos tengo, Avisar si quedan menos de,
    // Marca, Presentación, Factor, Se cuenta por, Código corto
    ["Panadería", "Pan de sal", 0.1, 0.15, 40, 20, "", "", "", "", "10"],
    ["Golosinas y snacks", "Caramelo de leche", "", 0.05, "", "", "", "Unidad", 1, "", "30"],
    ["Golosinas y snacks", "Caramelo de leche", "2,00", 4, 3, 50, "", "Funda x100", 100, "", "30"],
    ["Frutas y verduras", "Papa chola", 0.3, "abc", 50, 10, "", "", "", "libra"],
  ].forEach((valores, i) => (hoja.getRow(i + 2).values = valores));
  const archivo = Buffer.from(await libro.xlsx.writeBuffer());
  void request;

  await page.goto("/catalogo/importar");
  await page.locator('input[type="file"]').setInputFiles({
    name: "productos.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: archivo,
  });
  await expect(page.getByText("3 fila(s) listas")).toBeVisible();
  await expect(page.getByText("1 con errores")).toBeVisible();
  await expect(page.getByText("El precio de venta: «abc» no es un número.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Guardar en el catálogo/ })).toBeDisabled();

  // Se corrige en la vista previa, sin volver a Excel.
  await page.getByLabel("Precio de venta fila 5").fill("0.45");
  await expect(page.getByText("4 fila(s) listas")).toBeVisible();
  await page.getByRole("button", { name: "Guardar en el catálogo (4)" }).click();
  await expect(page.getByText("Listo: 3 producto(s) nuevo(s) y 0 actualizado(s).")).toBeVisible();

  await page.goto("/catalogo?q=caramelo");
  const caramelo = page.getByRole("listitem").filter({ hasText: "Caramelo de leche" });
  await expect(caramelo).toContainText("300 unidades"); // 3 fundas × 100
  await expect(caramelo).toContainText("#30");
  await page.goto("/catalogo?q=papa");
  await expect(page.getByRole("listitem").filter({ hasText: "Papa chola" })).toContainText("50 libras");
});

test("etiquetas: el producto nuevo está en «por reimprimir» y se dibuja su código", async ({ page }) => {
  await page.goto("/catalogo/etiquetas");
  await expect(page.getByText(/Por reimprimir/)).toBeVisible();
  const zona = page.locator(".zona-impresion");
  await expect(zona.getByText("Coca-Cola 500 ml").first()).toBeVisible();
  await expect(zona.locator("svg").first()).toBeVisible();
  await page.getByRole("button", { name: "Ya las imprimí" }).click();
  await expect(page.getByText("Listo, quitadas de «por reimprimir».")).toBeVisible();
});

test("hoja de códigos: genera códigos internos para lo que no tiene", async ({ page }) => {
  await page.goto("/catalogo/hoja-codigos");
  const zona = page.locator(".zona-impresion");
  await expect(zona.getByText("Pan de sal")).toBeVisible();
  await expect(zona.getByText("Coca-Cola 500 ml")).toHaveCount(0); // tiene código del fabricante
  await page.getByRole("button", { name: /Generar códigos que faltan/ }).click();
  await expect(page.getByText(/código\(s\) generados/)).toBeVisible();
  // Ya ningún producto dice «Sin código» y cada uno tiene su código dibujado.
  await expect(zona.getByText("Sin código")).toHaveCount(0, { timeout: 10_000 });
  const codigos = zona.locator("[data-codigo]");
  await expect(codigos).toHaveCount(3); // pan, caramelo y papa
  for (const c of await codigos.all()) expect(await c.getAttribute("data-codigo")).toMatch(/^29\d{11}$/);
});

test("categorías: crear una subcategoría", async ({ page }) => {
  await page.goto("/catalogo/categorias");
  await page.getByRole("listitem").filter({ hasText: /^Bebidas/ }).getByRole("button", { name: "Agregar subcategoría" }).click();
  await page.getByLabel("Nombre").fill("Tés fríos");
  await page.getByLabel("Margen objetivo %").fill("30");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Categoría guardada.")).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Tés fríos" })).toContainText("Margen objetivo 30%");
});
