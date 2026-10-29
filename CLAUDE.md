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
- `npm run test:db` — reglas RLS y funciones contra **sandry-pruebas** (`tests/db`; BORRA sus datos)
- `npm run typecheck` · `npm run lint` · `npm run build`
- `npm run db:tipos` — regenera `src/lib/supabase/tipos.ts` desde el proyecto enlazado

## Base de datos (Supabase CLI)

- Cambios de esquema SOLO con migraciones en `supabase/migrations/` (nunca a mano en el panel).
- El CLI ya tiene sesión (`supabase login`); no pide contraseña de la BD. Por defecto el
  repo está enlazado a **sandry-pruebas** (`fhehdhpkxqtmeotaxmgm`).
- Para producción: `npx supabase link --project-ref csupvenhzqgyybyvznpc`, luego
  `npx supabase db push --linked` y `npx supabase config push` (revisar el diff antes de
  aceptar), y **volver a enlazar pruebas** al terminar.
- Ajustes de Auth en `supabase/config.toml`; lo propio de la tienda va en `[remotes.produccion]`.
- `.env.local` y `.env.test.local` apuntan a **sandry-pruebas** (la PC nunca toca datos reales).
  La clave secreta se obtiene con `npx supabase projects api-keys --project-ref <ref> --reveal`.

## Acceso y permisos (fase 2)

- Sesión y permisos: `src/server/sesion.ts` (`requerirUsuarioActivo`, `requerirPermiso`).
  Cada pantalla protegida los llama dentro de `<Suspense>`; cada acción del servidor los
  vuelve a llamar, y las funciones SQL revisan con `exigir_permiso`.
- Escrituras sensibles: por funciones SQL `security definer` que dejan bitácora; las tablas
  no aceptan insert/update directos desde el navegador.
- Códigos de permiso en la tabla `permisos` (p. ej. `costos.ver`, `reportes.ver`); las
  fases siguientes usan esos mismos códigos.

## Catálogo (fase 3)

- Escritura SOLO por `guardar_producto(jsonb)` / `guardar_categoria(jsonb)` /
  `importar_productos(jsonb)`: validan permisos (`productos.editar`, `precios.cambiar`,
  `costos.ver`), guardan historial de precios/costos, bitácora y etiquetas por reimprimir.
- Stock: tabla `existencias` (unidad base) + kardex `movimientos_stock`. Todo movimiento
  pasa por `registrar_movimiento()` (interna; recalcula el costo promedio ponderado).
  Las fases 4 y 5 (compras, ventas, ajustes) deben usar esa misma función.
- Costos en `producto_costos` (RLS `costos.ver`). Lecturas del servidor en `src/server/catalogo.ts`.
- Búsqueda: `buscar_productos()` (pg_trgm + unaccent, texto en `productos.texto_busqueda`).
- Cálculos (margen sobre costo, sugerido, GTIN): `src/lib/catalogo.ts`.
- Excel: revisión/armado puro y compartido en `src/lib/excel/productos.ts`; plantilla en
  `src/server/excel/plantilla.ts` (hoja «Productos» vacía + «Ejemplos» que NO se importa).
- Impresión: todo lo imprimible va dentro de `.zona-impresion` (CSS en `globals.css`) y
  cada pantalla define su `@page`. Códigos dibujados con `bwip-js` (`components/codigo-barras.tsx`).
- Pruebas e2e: proyectos de Playwright en orden (usuarios → catálogo) sobre la base de pruebas.
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
- 28/10/2026 — Correos (recuperar contraseña, invitaciones): **Gmail de la tienda con
  contraseña de aplicación** como SMTP propio de Supabase (gratis). Resend + dominio queda
  para cuando se envíen facturas.
- 28/10/2026 — Pruebas automáticas contra un **segundo proyecto Supabase `sandry-pruebas`**,
  nunca contra el de la tienda.
- 28/10/2026 — **Margen = sobre el costo**: margen % = (precio − costo) / costo. Precio
  sugerido = costo × (1 + margen objetivo), redondeado hacia arriba a $0.05 (configurable).
- 28/10/2026 — Sin impresora todavía: etiquetas en A4 (hojas adhesivas) y térmica 50×25 mm.
- 28/10/2026 — Catálogo desde cero (sin lista previa). Códigos de barras internos: EAN-13
  con prefijo **29** (2 + 9 + 10 dígitos de secuencia + verificador); los prefijos 20–28
  quedan libres para las balanzas de peso variable (fase 5).
- 29/10/2026 — **Sin IVA en ninguna pantalla** (ni venta ni compra). La tienda está en un
  lugar muy remoto y pone el precio de venta libremente. Si algo lleva IVA, la dueña hace la
  cuenta y escribe el costo final. Quedan en la BD, sin usar, `tarifa_iva`,
  `productos.compra_con_iva` y `ajustes.iva_compras` (por si algún día se factura, fase 7).
- 29/10/2026 — **Sumar stock no pide costo**: usa el costo que ya tiene el producto
  (`ajustar_stock` toma `costo_promedio` si no llega costo). Aplicar lo mismo en compras rápidas.
- 29/10/2026 — **Descargar mis productos** (`/catalogo/exportar`): mismo formato que la
  plantilla, para editar y volver a importar. Al importar, para productos EXISTENTES
  «Cuántos tengo» es el stock REAL (`stock_real` → conteo si cambió); para nuevos es el
  stock inicial. Así la ida y vuelta no duplica stock.
- 29/10/2026 — **Excel sencillo**: columnas en orden Categoría, Producto, Costo, Precio de
  venta, Cuántos tengo (verdes) y luego lo opcional (gris). Se aceptan títulos de plantillas
  anteriores (`otros` en `COLUMNAS_PRODUCTOS`).
- 29/10/2026 — **Sin subcategorías**: solo categorías principales (Bebidas, Botiquín,
  Ferretería…). La migración 000008 movió los productos a su categoría principal y borró
  las subcategorías. La pantalla ya no ofrece «Agregar subcategoría».
- 29/10/2026 — **Excel = foto completa de la tienda** («Descargar Excel», `sandry-dd-mm-aaaa.xlsx`):
  «Productos» (stock real), «Compras» (cada producto en cada forma de compra: solo se escribe
  «Cuántos entraron», se SUMA con su costo; filas nuevas = productos nuevos), «Salidas»
  («Cuántos salieron» + motivo merma/caducado/autoconsumo/regalo/robo, se RESTA; solo
  productos existentes), y solo para ver «Resumen» y «Movimientos» (kardex 90 días; solo con
  `costos.ver`). Las ventas NO van en «Salidas» (las registra la caja). Cuando existan
  ventas, gastos e ingresos (fases 4–6), agregarlos a «Resumen» y como hojas de solo lectura.
- 29/10/2026 — **Fase 3 aprobada.** Fase 4 completa: proveedores, cuentas de dinero,
  compras (suelta, distribuidor con contado/crédito), viaje de compras en el celular (sin
  señal no se pierde nada), kardex, alertas, lista sugerida, **pedido al preventista**,
  **caducidades (lotes)**, **envases retornables** y **conteo de inventario**.
- 29/10/2026 — **Transporte del viaje = gasto de la tienda** (categoría Transporte). No se
  prorratea en el costo.
- 29/10/2026 — Cuentas de dinero iniciales: **Caja, Banco, Deuna y Dinero personal de la
  dueña**. Pagar algo desde «Dinero personal» = aporte de la dueña (esa cuenta acumula en
  negativo lo que ella puso; un retiro de la dueña la sube).
- 29/10/2026 — **Netlify gratis se quedó sin créditos** (cada publicación gasta ~15 de 300 al
  mes; el ciclo va del 28 al 27). Desde ahora se publica en la web **solo cuando una fase está
  lista para probar**. Mientras no haya créditos se prueba en la PC: `.env.production.local`
  (ignorado por git) apunta a la tienda real sin clave secreta → `next build` y
  `next start -H 0.0.0.0 -p 3200`.
- 29/10/2026 — **Fase 4 aprobada** (probada en la PC).
- 28/10/2026 — Fase 7 (comprobantes/factura electrónica) se hace AL FINAL, después de la
  fase 8. El ticket interno sin valor tributario se entrega en la fase 5.

## Dónde vive cada cosa

- Código: GitHub `emanuelmarcelov-star/Sandry` (privado), rama `main`. Cada push a
  `main` se publica solo en Netlify.
- App publicada: https://storied-raindrop-2de6ba.netlify.app (Netlify, equipo "Tienda").
  Visibilidad: producción pública, deploy previews privados.
- Base de datos de la tienda: Supabase `csupvenhzqgyybyvznpc` (región us-west-2).
- Base de pruebas: Supabase `Sandry-pruebas` (`fhehdhpkxqtmeotaxmgm`, us-west-2).
- Variables en Netlify: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
  `SUPABASE_SECRET_KEY` (secreta, solo contexto Production; clave "netlify" en Supabase).
- Correo de la tienda (SMTP de Supabase vía Gmail con contraseña de aplicación):
  `tiendasandry.ec@gmail.com`.

## Pendientes de verificar (SRI / servicios)

Ver la sección "Cosas a confirmar" en `docs/PLAN.md`.
