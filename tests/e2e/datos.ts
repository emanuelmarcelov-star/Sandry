import type { Page } from "@playwright/test";

/** Personas de las pruebas de flujos (se crean en usuarios.spec.ts). */
export const DUENA = { nombre: "Rosa Pérez", correo: "rosa@e2e.sandry.test", telefono: "0991234567" };
export const CAJERA = { nombre: "Ana Torres", correo: "ana@e2e.sandry.test", telefono: "0987654321", cedula: "1710034065" };
export const CONTRASENA = "Clave-Segura-1";

export async function entrar(page: Page, correo: string, recordar = true, esperar = true) {
  await page.goto("/entrar");
  await page.getByLabel("Correo").fill(correo);
  await page.getByLabel("Contraseña").fill(CONTRASENA);
  if (!recordar) await page.getByLabel("Recordarme en este dispositivo").uncheck();
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  if (esperar) await page.waitForURL((u) => !u.pathname.startsWith("/entrar"));
}
