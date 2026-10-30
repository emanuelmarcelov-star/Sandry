import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Las pruebas de flujos usan la base de PRUEBAS (claves en .env.test.local).
if (existsSync(".env.test.local")) process.loadEnvFile(".env.test.local");

// Corren contra la versión de producción (build + start), una a la vez porque
// comparten la misma base de datos. El orden importa: usuarios crea a la
// administradora que después usa catálogo.
export default defineConfig({
  testDir: "tests/e2e",
  workers: 1,
  fullyParallel: false,
  globalSetup: "./tests/e2e/preparar.ts",
  use: { baseURL: "http://localhost:3100", locale: "es-EC", timezoneId: "America/Guayaquil" },
  webServer: {
    command: "npm run build && npx next start -p 3100",
    url: "http://localhost:3100/entrar",
    timeout: 300_000,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: "inicio-pc", use: { ...devices["Desktop Chrome"] }, testMatch: /inicio\.spec\.ts/ },
    { name: "inicio-celular", use: { ...devices["Pixel 7"] }, testMatch: /inicio\.spec\.ts/ },
    { name: "usuarios", use: { ...devices["Desktop Chrome"] }, testMatch: /usuarios\.spec\.ts/ },
    { name: "catalogo", use: { ...devices["Desktop Chrome"] }, testMatch: /catalogo\.spec\.ts/, dependencies: ["usuarios"] },
    // El abastecimiento se prueba en un celular (así se usa en el viaje de compras).
    { name: "abastecimiento", use: { ...devices["Pixel 7"] }, testMatch: /abastecimiento\.spec\.ts/, dependencies: ["catalogo"] },
    { name: "ventas", use: { ...devices["Desktop Chrome"] }, testMatch: /ventas\.spec\.ts/, dependencies: ["abastecimiento"] },
  ],
});
