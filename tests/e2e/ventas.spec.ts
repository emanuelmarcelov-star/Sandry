import { expect, test, type Page } from "@playwright/test";
import { DUENA, entrar } from "./datos";

/*
 * Punto de venta de punta a punta en la PC (corre después de abastecimiento:
 * hay Coca-Cola con código 7861001234565 a $1.00 y Pan de sal a $0.20).
 */
test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  await entrar(page, DUENA.correo);
});

/** El lector USB escribe muy rápido y termina con Enter, sin que el cursor esté en un campo. */
async function escanear(page: Page, codigo: string) {
  await page.locator("body").click({ position: { x: 5, y: 300 } });
  await page.keyboard.type(codigo, { delay: 5 });
  await page.keyboard.press("Enter");
}

const carrito = (page: Page) => page.getByRole("region", { name: "Carrito" });

test("abrir la caja con el fondo de cambio", async ({ page }) => {
  await page.goto("/vender");
  await expect(page.getByText("La caja está cerrada.")).toBeVisible();
  await page.getByLabel("¿Cuánto dinero hay en la caja para empezar?").fill("20");
  await page.getByRole("button", { name: "Abrir caja" }).click();
  await expect(page.getByLabel("Buscar, código corto o escanear (F2)")).toBeVisible();
});

test("vender con el lector de códigos, buscando y «Varios»; cobrar en efectivo con cambio", async ({ page }) => {
  await page.goto("/vender");
  await expect(page.getByLabel("Buscar, código corto o escanear (F2)")).toBeVisible();
  await escanear(page, "7861001234565");
  await escanear(page, "7861001234565"); // otra vez: sube la cantidad
  await expect(carrito(page).getByLabel("Cantidad de Coca-Cola 500 ml")).toHaveValue("2");

  await page.getByLabel("Buscar, código corto o escanear (F2)").fill("pan de sal");
  await page.getByLabel("Buscar, código corto o escanear (F2)").press("Enter");
  await expect(carrito(page).getByText("Pan de sal")).toBeVisible();

  await page.getByRole("button", { name: "Venta libre" }).click();
  await page.getByLabel("Monto").fill("0.50");
  await page.getByLabel("Detalle").fill("Fundita");
  await page.getByRole("button", { name: "Agregar" }).click();
  // 2 × $1.00 + $0.20 + $0.50
  await expect(page.getByTestId("total-venta")).toHaveText("$2.70");

  await page.keyboard.press("F4");
  await expect(page.getByTestId("total-cobro")).toHaveText("$2.70");
  await page.getByRole("button", { name: "$5.00" }).click();
  await expect(page.getByTestId("cambio")).toHaveText("$2.30");
  await page.getByRole("button", { name: "Confirmar venta" }).click();
  await expect(page.getByText(/Venta #\d+ lista/)).toBeVisible();
  await page.getByRole("button", { name: "Nueva venta" }).click();
  await expect(page.getByTestId("total-venta")).toHaveText("$0.00");
});

test("fiado a un cliente y después su abono", async ({ page }) => {
  await page.goto("/clientes");
  await page.getByRole("button", { name: "Nuevo cliente" }).click();
  await page.getByLabel("Nombre").fill("Doña Carmen");
  await page.getByLabel("Teléfono o WhatsApp").fill("0998887766");
  await page.getByLabel("Límite de fiado").fill("10");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Cliente guardado.")).toBeVisible();

  await page.goto("/vender");
  await escanear(page, "7861001234565");
  await page.keyboard.press("F4");
  await page.getByRole("button", { name: "Fiado" }).click();
  await page.getByLabel("¿A quién se le fía?").selectOption({ label: "Doña Carmen" });
  await page.getByRole("button", { name: "Confirmar venta" }).click();
  await expect(page.getByText(/Venta #\d+ lista/)).toBeVisible();

  await page.goto("/clientes");
  await page.getByRole("link", { name: /Doña Carmen/ }).click();
  await expect(page.getByTestId("saldo-cliente")).toHaveText("$1.00");
  await page.getByLabel("Monto").fill("1");
  await page.getByRole("button", { name: "Registrar abono" }).click();
  await expect(page.getByText("Abono registrado.")).toBeVisible();
  await expect(page.getByTestId("saldo-cliente")).toHaveText("$0.00");
});

test("anular una venta con motivo devuelve el stock", async ({ page }) => {
  await page.goto("/vender/ventas");
  await page.getByRole("link", { name: /#\d+/ }).first().click();
  await page.getByRole("button", { name: "Anular venta" }).click();
  await page.getByLabel("Motivo").fill("Prueba de anulación");
  await page.getByRole("dialog").getByRole("button", { name: "Anular venta" }).click();
  await expect(page.getByText("Venta anulada.")).toBeVisible();
  await expect(page.getByText("Anulada").first()).toBeVisible();
});

test("cerrar la caja con el arqueo", async ({ page }) => {
  await page.goto("/vender/caja");
  await expect(page.getByText("Efectivo que debería haber")).toBeVisible();
  await page.getByLabel("Cuántos de $20.00").fill("1");
  await expect(page.getByTestId("contado")).toHaveText("$20.00");
  await page.getByRole("button", { name: "Cerrar caja" }).click();
  await expect(page.getByText("Caja cerrada.").first()).toBeVisible();
  await expect(page.getByText("La caja está cerrada.")).toBeVisible();
});
