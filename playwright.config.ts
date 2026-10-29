import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Las pruebas de flujos usan la base de PRUEBAS (claves en .env.test.local).
if (existsSync(".env.test.local")) process.loadEnvFile(".env.test.local");

// Corren contra la versión de producción (build + start), una a la vez porque
// comparten la misma base de datos.
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
    { name: "pc", use: { ...devices["Desktop Chrome"] } },
    { name: "celular", use: { ...devices["Pixel 7"] }, testMatch: /inicio\.spec\.ts/ },
  ],
});
