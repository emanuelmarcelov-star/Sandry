import { expect, test } from "@playwright/test";
import { DUENA, entrar } from "./datos";

/*
 * Gastos y reportes (corre después de ventas: hoy ya hay ventas).
 */
test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  await entrar(page, DUENA.correo);
});

test("gastos: uno de la tienda y gasolina personal del carro", async ({ page }) => {
  await page.goto("/gastos");
  await expect(page.getByText("Arriendo del local")).toBeVisible(); // gastos fijos por pagar

  await page.getByLabel("¿Qué fue?").selectOption({ label: "Luz" });
  await page.getByLabel("Monto").first().fill("12");
  await page.getByLabel("¿De qué cuenta salió el dinero?").selectOption({ label: "Banco" });
  await page.getByRole("button", { name: "Guardar gasto" }).click();
  await expect(page.getByText("Gasto anotado.")).toBeVisible();

  await page.getByLabel("¿Qué fue?").selectOption({ label: "Gasolina" });
  await page.getByRole("button", { name: "Personal / de la casa" }).click();
  await page.getByRole("button", { name: "+ Agregar carro" }).click();
  await page.getByLabel("Nombre del carro (ej. Chevrolet Aveo)").fill("Chevrolet Aveo");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await page.getByLabel("Monto").first().fill("20");
  await page.getByLabel("¿De qué cuenta salió el dinero?").selectOption({ label: "Banco" });
  await page.getByLabel("Galones").fill("7.5");
  await page.getByRole("button", { name: "Guardar gasto" }).click();
  await expect(page.getByText("Anotado como gasto personal (retiro de la dueña).")).toBeVisible();
  await expect(page.getByText("Personal", { exact: true }).first()).toBeVisible();
});

test("reportes del día: ventas, ganancia, gastos y descarga en Excel", async ({ page }) => {
  await page.goto("/reportes");
  const tile = (titulo: string) => page.locator("div").filter({ has: page.getByText(titulo, { exact: true }) }).last();
  await expect(tile("Ganancia neta")).toBeVisible();
  // Luz $12 + gasolina del viaje de compras $5 (de la tienda). La gasolina personal ($20) no cuenta.
  await expect(tile("Gastos del negocio")).toContainText("$17.00");
  await expect(page.getByRole("heading", { name: "Lo más vendido" })).toBeVisible();

  const descarga = page.waitForEvent("download");
  await page.getByRole("link", { name: "Descargar Excel" }).click();
  expect((await descarga).suggestedFilename()).toMatch(/^reporte-sandry-\d{4}-\d{2}-\d{2}-a-\d{4}-\d{2}-\d{2}\.xlsx$/);
});

test("panel de inicio con las ventas de hoy y las alertas", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Ventas de hoy")).toBeVisible();
  await expect(page.getByTestId("ventas-hoy")).not.toHaveText("$0.00");
  await expect(page.getByText(/gasto\(s\) fijo\(s\) por pagar/)).toBeVisible();
});
