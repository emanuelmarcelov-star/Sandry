import { defineConfig, devices } from "@playwright/test";

// Las pruebas de flujos corren contra la versión de producción (build + start).
export default defineConfig({
  testDir: "tests/e2e",
  use: { baseURL: "http://localhost:3100" },
  webServer: {
    command: "npm run build && npx next start -p 3100",
    url: "http://localhost:3100",
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: "pc", use: { ...devices["Desktop Chrome"] } },
    { name: "celular", use: { ...devices["Pixel 7"] } },
  ],
});
