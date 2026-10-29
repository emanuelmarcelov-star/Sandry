import { expect, test } from "@playwright/test";
import { DUENA, entrar } from "./datos";

/*
 * Abastecimiento de punta a punta en un CELULAR (corre después de catálogo, que
 * deja la Coca-Cola con 68 unidades y el pan con 34). Incluye el viaje de
 * compras en modo avión.
 */
test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  await entrar(page, DUENA.correo);
});

async function stockEnCatalogo(page: import("@playwright/test").Page, buscar: string, nombre: string) {
  await page.goto(`/catalogo?q=${encodeURIComponent(buscar)}`);
  return page.getByRole("listitem").filter({ hasText: nombre });
}

test("dinero: la caja empieza con lo que se contó", async ({ page }) => {
  await page.goto("/dinero");
  await expect(page.getByText("Dinero personal de la dueña")).toBeVisible();
  await page.getByRole("button", { name: "Conté y hay…" }).click();
  await page.getByLabel("Cuenta").selectOption({ label: "Caja" });
  await page.getByLabel("¿Cuánto hay de verdad?").fill("200");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByRole("link", { name: /Caja\s*\$200\.00/ })).toBeVisible();
});

test("proveedores: el distribuidor con su día de visita", async ({ page }) => {
  await page.goto("/compras/proveedores");
  await page.getByRole("button", { name: "Nuevo proveedor o lugar" }).click();
  await page.getByLabel("Nombre").fill("Arca Coca-Cola");
  await page.getByLabel("Teléfono o WhatsApp").fill("0991112233");
  await page.getByRole("button", { name: "Mar", exact: true }).click();
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Proveedor guardado.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Arca Coca-Cola/ })).toContainText("Visita: Mar");
});

test("compra del distribuidor: 2 jabas suman 24 unidades y sale el dinero de la caja", async ({ page }) => {
  await page.goto("/compras/nueva");
  await page.getByLabel("¿Dónde compraste? / Proveedor").selectOption({ label: "Arca Coca-Cola" });
  await page.getByLabel("Buscar producto o escanear código").fill("coca");
  await page.getByRole("button", { name: /Coca-Cola 500 ml/ }).click();
  const linea = page.getByRole("article", { name: "Coca-Cola 500 ml" });
  await linea.getByLabel("Presentación").selectOption({ label: "Jaba x12 (12 unidades)" });
  await linea.getByLabel("Cantidad").fill("2");
  await linea.getByLabel("Costo de cada jaba x12").fill("9");
  await expect(linea).toContainText("= $0.75 por unidad");
  await expect(page.getByTestId("total-compra")).toHaveText("$18.00");
  await page.getByLabel("¿De qué cuenta salió el dinero?").selectOption({ label: "Caja" });
  await page.getByRole("button", { name: "Guardar compra" }).click();
  await expect(page.getByText("Compra guardada.")).toBeVisible();

  await expect(await stockEnCatalogo(page, "colita", "Coca-Cola 500 ml")).toContainText("92 unidades");
});

test("viaje de compras en modo avión: no se pierde nada y al llegar se recibe", async ({ page, context }) => {
  await page.goto("/compras/viaje");
  await page.getByRole("button", { name: "Iniciar viaje de compras" }).click();
  await expect(page.getByRole("button", { name: /Registrar compra en un lugar/ })).toBeVisible();

  // Se va la señal en el mercado.
  await context.setOffline(true);
  await page.getByRole("button", { name: /Registrar compra en un lugar/ }).click();
  await page.getByLabel("Buscar producto o escanear código").fill("pan de sal");
  await page.getByRole("button", { name: /Pan de sal/ }).click();
  const linea = page.getByRole("article", { name: "Pan de sal" });
  await linea.getByLabel("Cantidad").fill("20");
  await linea.getByLabel("Costo de cada unidad").fill("0.10");
  await page.getByLabel("¿De qué cuenta salió el dinero?").selectOption({ label: "Caja" });
  await page.getByRole("button", { name: "Guardar compra" }).click();
  await expect(page.getByText("Compra guardada en el celular. Se envía sola cuando haya señal.")).toBeVisible();

  await page.getByRole("button", { name: /Anotar gasto/ }).click();
  await page.getByRole("button", { name: "Gasolina", exact: true }).click();
  await page.getByLabel("Monto").fill("5");
  await page.getByLabel("¿De qué cuenta salió el dinero?").selectOption({ label: "Caja" });
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText(/sin enviar: se envían solas cuando hay señal/)).toBeVisible();
  await expect(page.getByText("Para recibir en la tienda hace falta señal")).toBeVisible();

  // Vuelve la señal: se envía todo.
  await context.setOffline(false);
  await page.getByRole("button", { name: "Enviar ahora" }).click();
  await expect(page.getByText(/sin enviar/)).toHaveCount(0, { timeout: 45_000 });

  // Llegó a la tienda: 2 panes vinieron aplastados.
  await page.getByRole("link", { name: "Llegué a la tienda: recibir" }).click();
  await expect(page.getByRole("heading", { name: "Recibir en tienda" })).toBeVisible();
  await expect(page.getByText("Los gastos fueron el 250% de lo comprado.")).toBeVisible();
  await page.getByLabel("Dañados (en unidades)").fill("2");
  await page.getByRole("button", { name: "Confirmar: todo entra al stock" }).click();
  await expect(page.getByText("Listo: todo entró al stock.").first()).toBeVisible();

  await expect(await stockEnCatalogo(page, "pan de sal", "Pan de sal")).toContainText("52 unidades"); // 34 + 20 − 2
});

test("dinero: la caja refleja las compras y la gasolina", async ({ page }) => {
  await page.goto("/dinero");
  // 200 − 18 (jabas) − 2 (pan) − 5 (gasolina)
  await expect(page.getByRole("link", { name: /Caja\s*\$175\.00/ })).toBeVisible();
  await expect(page.getByText("Gasolina").first()).toBeVisible();
});

test("conteo de inventario: se cuenta, se envía y se aprueba la diferencia", async ({ page }) => {
  await page.goto("/inventario/conteos");
  await page.getByLabel("¿Qué vas a contar?").selectOption({ label: "Panadería" });
  await page.getByRole("button", { name: "Empezar conteo" }).click();
  await expect(page.getByRole("heading", { name: "Conteo Panadería" })).toBeVisible();
  await page.getByLabel("Pan de sal").fill("50");
  await page.getByLabel("Pan de sal").press("Enter");
  await page.getByRole("button", { name: "Terminé: enviar para aprobar" }).click();
  await expect(page.getByText("Conteo enviado.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Diferencias" })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Pan de sal" })).toContainText("−2");
  await page.getByRole("button", { name: "Aprobar y corregir el stock" }).click();
  await expect(page.getByText("Listo: se corrigió el stock de 1 producto(s).")).toBeVisible();
  await expect(await stockEnCatalogo(page, "pan de sal", "Pan de sal")).toContainText("50 unidades");
});

test("alertas y envases", async ({ page }) => {
  await page.goto("/inventario");
  await expect(page.getByRole("heading", { name: "Lista de compras sugerida" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Por caducar/ })).toBeVisible();

  await page.goto("/inventario/envases");
  await page.getByRole("button", { name: "Nuevo tipo de envase" }).click();
  await page.getByLabel("Nombre").fill("Jaba Coca-Cola");
  await page.getByRole("button", { name: "Guardar" }).click();
  await page.getByRole("button", { name: "Registrar" }).click();
  await page.getByLabel("Llegaron llenos del proveedor").check();
  await page.getByLabel("Cantidad").fill("2");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Envases actualizados.")).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Jaba Coca-Cola" }).getByText("Se deben al proveedor")).toBeVisible();
});
