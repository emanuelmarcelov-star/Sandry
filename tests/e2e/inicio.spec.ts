import { expect, test } from "@playwright/test";

test("sin sesión, la app manda a «Entrar», en español", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/entrar$/);
  await expect(page.getByRole("heading", { name: "Entrar a Sandry" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "es-EC");
});

test("la app es instalable: manifest e íconos", async ({ page, request }) => {
  await page.goto("/entrar");
  const enlace = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(enlace).toBeTruthy();

  const manifest = await (await request.get(enlace!)).json();
  expect(manifest.name).toBe("Sandry");
  expect(manifest.display).toBe("standalone");

  for (const icono of manifest.icons) {
    const respuesta = await request.get(icono.src);
    expect(respuesta.ok(), icono.src).toBe(true);
    expect(respuesta.headers()["content-type"]).toContain("image/png");
  }
  expect((await request.get("/sw.js")).ok()).toBe(true);
});

test("muestra el aviso cuando se va el internet", async ({ page, context }) => {
  await page.goto("/entrar");
  await context.setOffline(true);
  await expect(page.getByRole("status").filter({ hasText: "Sin conexión" })).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByRole("status").filter({ hasText: "Sin conexión" })).toBeHidden({ timeout: 15_000 });
});
