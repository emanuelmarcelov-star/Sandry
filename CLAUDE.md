# Sandry (app web) — reglas del proyecto

Sistema para una tienda de barrio en Ecuador: punto de venta, inventario, compras,
gastos, reportes de ganancia y comprobantes. La especificación completa (fuente de
verdad) está en `docs/ESPECIFICACION.md`; el plan y el modelo de datos en `docs/PLAN.md`.

## Cómo trabajar con el usuario

- Hablar siempre en español sencillo. El usuario tiene poca experiencia programando:
  explicar en pocas líneas qué se hace y por qué. Pasos externos (cuentas, claves,
  comandos) siempre numerados y exactos.
- Trabajar por fases (sección 13 de la especificación). Al terminar cada fase: la app
  funciona, tiene pruebas de lo importante, se explica cómo probarla a mano, y se
  ESPERA el visto bueno antes de seguir.
- Si algo es ambiguo, preguntar antes de asumir.
- Commits pequeños, mensajes en español.
- Preguntar antes de agregar cualquier servicio de pago o cambiar la tecnología.
- Reglas legales/tributarias: verificarlas en sri.gob.ec y avisar si cambiaron. No inventar.

## Tecnología (decidida — no cambiar sin consultar)

Next.js (App Router) + TypeScript + Tailwind + shadcn/ui · Supabase (Postgres, Auth,
Storage, RLS en TODAS las tablas) · Netlify · PWA · Resend (SMTP) · Recharts · Zod ·
React Hook Form · ExcelJS · bwip-js · BarcodeDetector + `barcode-detector` (respaldo) ·
Open Food Facts · decimal.js · Vitest + Playwright.

## Comandos

- `npm run dev` — app en http://localhost:3000
- `npm test` — pruebas de lógica (Vitest, `tests/unit`)
- `npm run test:e2e` — pruebas de flujos (Playwright, `tests/e2e`; hace build y levanta en :3100)
- `npm run typecheck` · `npm run lint` · `npm run build`
- En esta PC, si la terminal no encuentra `node`/`git`, recargar el PATH:
  `$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')`

## Notas de la versión de Next.js

Next 16.4 con `cacheComponents` y `partialPrefetching`: los datos que cambian en cada
visita van dentro de `<Suspense>` y llaman a `await connection()`. Antes de usar una API
de Next, revisar `node_modules/next/dist/docs/` (ver `AGENTS.md`). El aviso sin conexión
usa `useOffline` de `next/offline` (`experimental.useOffline`).

## Reglas técnicas no negociables

- **Dinero**: nunca `number`/float para montos. BD: montos `numeric(12,4)`, cantidades
  `numeric(12,3)`. Código: `decimal.js`. Redondeo final a 2 decimales.
- **Stock** siempre en la unidad base del producto; ventas y compras se convierten con el
  factor de la presentación.
- **Costos y ganancias** solo los ve quien tenga permiso. Viven en tablas separadas
  (p. ej. `producto_costos`, `venta_linea_costos`) protegidas por RLS, porque RLS filtra
  filas, no columnas. Nunca exponer costos en vistas o funciones accesibles a cajeras.
- Permisos validados en el servidor y en RLS, no solo ocultando botones.
- Lo sensible (firma electrónica, SRI, cálculos de ganancia) solo en el servidor.
- Cada venta guarda el costo unitario del momento.
- Todo movimiento de dinero pasa por el libro `movimientos_dinero` (saldo de una cuenta =
  suma de sus movimientos). Todo movimiento de stock pasa por `movimientos_stock` (kardex).
- Secretos solo en `.env.local` (nunca en git). En producción: variables de entorno de Netlify.
- Interfaz en español de Ecuador: `$1.50`, fechas `dd/mm/aaaa`, zona `America/Guayaquil`.
- Textos de la interfaz centralizados en `src/lib/textos.ts`.
- Catálogo 100 % configurable: nada de productos o categorías fijos en el código (solo el
  seed inicial de categorías).

## Decisiones tomadas

- 28/10/2026 — Proyecto nuevo en `C:\Users\Emanuel\Desktop\tienda-web`. La app de
  escritorio anterior (Python, `C:\Users\Emanuel\Desktop\Tienda`) queda intacta.
- 28/10/2026 — Sandry tenía solo datos de prueba: no se migra nada.
- 28/10/2026 — Nombre de la app: **Sandry**.
- 28/10/2026 — Régimen actual de la tienda: **Sin RUC** (ticket interno "Documento sin
  valor tributario"). El régimen queda configurable para cambiarlo después.
- 28/10/2026 — Hosting: **Netlify** (plan gratis permite uso comercial) en lugar de Vercel,
  cuyo plan Hobby es solo no comercial. El código sigue siendo Next.js estándar.
- 28/10/2026 — Dominio propio (para enviar correos a clientes con Resend): se decide en la fase 7.
- 28/10/2026 — Fase 7 (comprobantes/factura electrónica) se hace AL FINAL, después de la
  fase 8. El ticket interno sin valor tributario se entrega en la fase 5.

## Dónde vive cada cosa

- Código: GitHub `emanuelmarcelov-star/Sandry` (privado), rama `main`. Cada push a
  `main` se publica solo en Netlify.
- App publicada: https://storied-raindrop-2de6ba.netlify.app (Netlify, equipo "Tienda").
  Visibilidad: producción pública, deploy previews privados.
- Base de datos: Supabase, proyecto `sandry` (`csupvenhzqgyybyvznpc`), región East US.
- Variables en Netlify: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

## Pendientes de verificar (SRI / servicios)

Ver la sección "Cosas a confirmar" en `docs/PLAN.md`.
