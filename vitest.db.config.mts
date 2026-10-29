import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";

// Pruebas contra la base de PRUEBAS de Supabase (sandry-pruebas). Lee .env.test.local.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ["tests/db/**/*.test.ts"],
    environment: "node",
    env: loadEnv("test", process.cwd(), ""),
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
