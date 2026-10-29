import { expect, test, type Page } from "@playwright/test";
import { CAJERA, CONTRASENA, DUENA, entrar } from "./datos";

/*
 * Flujo completo de usuarios, como lo haría la tienda:
 * la dueña se registra, una trabajadora se registra, la dueña la aprueba,
 * la trabajadora crea su PIN y cambia de usuario con él.
 * Las pruebas van en orden y comparten la base de pruebas.
 */
test.describe.configure({ mode: "serial" });

async function registrar(page: Page, p: { nombre: string; correo: string; telefono: string; cedula?: string }) {
  await page.goto("/registro");
  await page.getByLabel("Nombre completo").fill(p.nombre);
  await page.getByLabel("Correo").fill(p.correo);
  await page.getByLabel("Teléfono").fill(p.telefono);
  if (p.cedula) await page.getByLabel("Cédula").fill(p.cedula);
  await page.getByLabel("Contraseña", { exact: true }).fill(CONTRASENA);
  await page.getByLabel("Repite la contraseña").fill(CONTRASENA);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
}

async function abrirMenu(page: Page) {
  await page.getByRole("button", { expanded: false }).filter({ hasText: /\w/ }).last().click();
}

test("el formulario de registro avisa los errores en español", async ({ page }) => {
  await page.goto("/registro");
  await page.getByLabel("Cédula").fill("1234567890");
  await page.getByLabel("Contraseña", { exact: true }).fill("corta");
  await page.getByLabel("Repite la contraseña").fill("otra");
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page.getByText("Escribe tu nombre completo.")).toBeVisible();
  await expect(page.getByText("La cédula no es válida. Revisa los 10 números.")).toBeVisible();
  await expect(page.getByText("La contraseña debe tener al menos 8 caracteres.")).toBeVisible();
  await expect(page.getByText("Las dos contraseñas no son iguales.")).toBeVisible();
});

test("la primera persona en registrarse queda como administradora", async ({ page }) => {
  await registrar(page, DUENA);
  await expect(page.getByRole("heading", { name: /Hola, Rosa/ })).toBeVisible();
  await abrirMenu(page);
  await expect(page.getByText("Administradora", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Usuarios" })).toBeVisible();
});

test("la siguiente queda esperando aprobación", async ({ page }) => {
  await registrar(page, CAJERA);
  await expect(page).toHaveURL(/\/pendiente$/);
  await expect(page.getByRole("heading", { name: "Tu cuenta espera aprobación" })).toBeVisible();
  // Aunque intente entrar al inicio, vuelve a "pendiente".
  await page.goto("/");
  await expect(page).toHaveURL(/\/pendiente$/);
});

test("contraseña incorrecta: mensaje claro", async ({ page }) => {
  await page.goto("/entrar");
  await page.getByLabel("Correo").fill(DUENA.correo);
  await page.getByLabel("Contraseña").fill("no-es-esta");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByText("Correo o contraseña incorrectos.")).toBeVisible();
});

test("la administradora aprueba a la trabajadora como cajera", async ({ page }) => {
  await entrar(page, DUENA.correo);
  await expect(page.getByText("Hay 1 persona esperando tu aprobación.")).toBeVisible();
  await page.getByRole("link", { name: "Revisar" }).click();
  const tarjeta = page.locator("article").filter({ hasText: CAJERA.nombre });
  await tarjeta.getByLabel("Rol").selectOption("cajera");
  await tarjeta.getByRole("button", { name: "Aprobar" }).click();
  await expect(page.getByText("Listo, ya puede usar la app.")).toBeVisible();
  await expect(page.locator("section").filter({ hasText: "Activas" }).getByText(CAJERA.nombre)).toBeVisible();
});

test("la cajera no ve ni puede abrir las pantallas de la administradora", async ({ page }) => {
  await entrar(page, CAJERA.correo);
  await expect(page.getByRole("heading", { name: /Hola, Ana/ })).toBeVisible();
  await abrirMenu(page);
  await expect(page.getByRole("link", { name: "Mi cuenta", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Usuarios" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Bitácora" })).toHaveCount(0);
  for (const ruta of ["/usuarios", "/usuarios/roles", "/bitacora", "/ajustes"]) {
    await page.goto(ruta);
    await expect(page.getByText("No tienes permiso para entrar a esa pantalla.")).toBeVisible();
  }
});

test("la cajera crea su PIN y luego cambia de usuario con él", async ({ page }) => {
  await entrar(page, CAJERA.correo);
  await page.goto("/mi-cuenta");
  await page.getByLabel("PIN nuevo").fill("2468");
  await page.getByLabel("Repite el PIN").fill("2468");
  await page.locator("section").filter({ hasText: "Mi PIN" }).getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText(/PIN guardado/)).toBeVisible();

  // La dueña usa el mismo dispositivo...
  await entrar(page, DUENA.correo);
  await expect(page.getByRole("heading", { name: /Hola, Rosa/ })).toBeVisible();

  // ...y la cajera vuelve con su PIN, sin contraseña.
  await page.goto("/cambiar-usuario");
  await page.getByRole("button", { name: CAJERA.nombre }).click();
  for (const n of ["1", "1", "1", "1"]) await page.getByRole("button", { name: n, exact: true }).click();
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText("PIN incorrecto.")).toBeVisible();

  await page.getByLabel("Escribe tu PIN").fill("2468");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: /Hola, Ana/ })).toBeVisible();
});

test("la bitácora muestra lo que pasó", async ({ page }) => {
  await entrar(page, DUENA.correo);
  await page.goto("/bitacora");
  await expect(page.getByText("Aprobó una cuenta")).toBeVisible();
  await expect(page.getByText("Entró con PIN")).toBeVisible();
  await expect(page.getByText("Creó o cambió su PIN")).toBeVisible();
});

test("olvidé mi correo: lo muestra enmascarado", async ({ page }) => {
  await page.goto("/olvide-correo");
  await page.getByLabel("Teléfono o cédula").fill(CAJERA.cedula);
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect(page.getByText("an****@e2e.sandry.test")).toBeVisible();
});

test("sin «Recordarme», la sesión se borra al cerrar el navegador", async ({ page, context }) => {
  await entrar(page, CAJERA.correo, false);
  await expect(page.getByRole("heading", { name: /Hola, Ana/ })).toBeVisible();
  const sesion = (await context.cookies()).filter((c) => c.name.startsWith("sb-"));
  expect(sesion.length).toBeGreaterThan(0);
  for (const c of sesion) expect(c.expires, c.name).toBe(-1); // -1 = cookie de sesión del navegador
});

test("se cierra la sesión por inactividad", async ({ page }) => {
  await page.clock.install();
  await entrar(page, CAJERA.correo);
  await expect(page.getByRole("heading", { name: /Hola, Ana/ })).toBeVisible();
  await page.clock.runFor("31:00");
  await expect(page).toHaveURL(/\/entrar\?motivo=inactividad/);
  await expect(page.getByText("Se cerró la sesión por inactividad. Vuelve a entrar.")).toBeVisible();
});

test("la administradora desactiva una cuenta y ya no puede entrar", async ({ page }) => {
  await entrar(page, DUENA.correo);
  await page.goto("/usuarios");
  page.once("dialog", (d) => d.accept());
  await page.locator("article").filter({ hasText: CAJERA.nombre }).getByRole("button", { name: "Desactivar" }).click();
  await expect(page.getByText(/Cuenta desactivada/)).toBeVisible();

  await page.goto("/salir");
  await entrar(page, CAJERA.correo, true, false);
  await expect(page.getByText("Tu cuenta está desactivada. Habla con la administradora.")).toBeVisible();
});
