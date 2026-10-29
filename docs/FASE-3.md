# Fase 3 — Catálogo: qué hay y cómo probarlo

Enlace de la app: **https://storied-raindrop-2de6ba.netlify.app** → menú → **Catálogo**

## Qué se hizo

- **Categorías en árbol** ya cargadas (Bebidas › Gaseosas, Víveres › Arroz, …), con
  color y **margen objetivo** (para el precio sugerido). Se pueden crear, renombrar, mover
  y desactivar. Si una subcategoría no tiene margen propio, **hereda** el de su categoría.
- **Productos** con: nombre, marca, categoría, foto, apodos para buscarlo (ej. "colita"),
  código corto (PLU) para lo que no tiene código de barras, unidad en que se cuenta
  (unidad, libra, kilo, litro), stock mínimo, ubicación, si caduca, si es retornable
  y si es solo para mayores de 18.
- **Presentaciones**: unidad, funda, paquete, jaba, libra… cada una con su factor
  (jaba x12 = 12), su **precio propio** y sus códigos de barras (el de la caja también).
  El stock siempre se guarda en la unidad base.
- **Sin IVA** (decisión del 29/10/2026): el costo y el precio de venta se escriben tal cual.
  Si algo lleva IVA, se hace la cuenta aparte y se escribe el costo final.
- **Precios**:
  - El **margen sobre el costo** se calcula solo. Si vendes a pérdida, se pone **en rojo**.
  - El **precio sugerido** sale del margen objetivo de la categoría y se redondea a $0.05.
  - Hay **historial** de cada cambio de precio y de costo.
- **Costos privados**: solo los ve la administradora (y la encargada de inventario).
  Una cajera **no puede verlos** aunque intente leer la base de datos directamente.
- **Autocompletar con Open Food Facts**: escribes o escaneas el código y tocas
  «Buscar datos por código». Si el producto está en esa base pública, trae el nombre,
  la marca y la foto.
- **Códigos internos** (EAN-13 que empiezan con 29) para lo que no trae código. Nunca
  se repiten.
- **Etiquetas**:
  - Formatos: A4 de 24 o de 65 por hoja, impresora térmica de 50×25 mm y **habladores**
    de percha.
  - Cuando cambias un precio, el producto entra solo a la lista **«por reimprimir»**.
- **Hoja de códigos**: los productos sin código (pan, papas, caramelos…), con foto y
  código de barras, para plastificar junto a la caja.
- **Excel**:
  - Plantilla con listas para elegir y una hoja de ejemplos.
  - Vista previa: lo correcto en verde y los errores en rojo, explicados.
  - Los errores se corrigen ahí mismo, sin volver a Excel.
  - Reconoce productos que ya existen por código, por código corto o por nombre.
- **Búsqueda tolerante**: «cocacola», «coca 3l», «pilsner» (mal escrito), «AZUCAR»,
  por apodo, por código o por código corto.

Pruebas automáticas: 83 de cálculos (margen, precio sugerido, códigos, Excel), 58 de
reglas de la base de datos y 25 de recorridos en el navegador. Todas pasan.

---

## Cómo probarlo tú mismo

Entra con la cuenta de tu mamá (administradora).

1. **Categorías**: Catálogo → **Categorías**. Revisa el árbol. Toca **Editar** en
   «Golosinas y snacks» y fíjate en el margen objetivo (35%).
2. **Crear un producto con presentaciones**: Catálogo → **Nuevo producto**.
   - Nombre: `Coca-Cola 500 ml`, Categoría: `Bebidas › Gaseosas`.
   - Apodos: `colita, coca`.
   - Costo de compra por unidad: `0.75`. Stock inicial: `24`.
   - En la presentación **Unidad**: precio `1.00`. Debajo verás «Margen: 33.3%».
   - Si tiene código de barras, escríbelo o escanéalo y prueba **Buscar datos por código**.
   - **Agregar presentación** → `Jaba x12`, factor `12`, precio `8`. Saldrá **en rojo
     «¡A pérdida!»** porque la jaba te cuesta $9.00. Toca **Usar** junto al sugerido.
   - **Guardar producto**.
3. **Buscar**: en Productos escribe `colita`. Debe aparecer la Coca-Cola.
   **Ajustar el stock**: toca la Coca-Cola. Arriba está el recuadro **Stock** con tres botones:
   - **Sumar (llegó mercadería)**: elige `Jaba x12`, cantidad `2` (verás «= 24 unidades»).
     No se vuelve a pedir el costo: se usa el que ya tiene el producto.
   - **Corregir conteo**: escribe cuántas hay realmente; la app registra la diferencia.
   - **Sacar (daño, consumo…)**: elige el motivo (se dañó, se caducó, consumo de la casa…).
   Debajo verás los últimos movimientos, con fecha, hora y lo que queda.
4. **Producto por libra**: crea `Papa chola`, «Se cuenta por» **Libra**, precio por
   libra `0.45`, y agrega la presentación `Unidad` con factor `0.4` (una papa ≈ 0.4 lb).
5. **Excel**: Catálogo → **Importar Excel** → **Descargar plantilla**. Ábrela, mira la
   hoja «Ejemplos» y llena 3 o 4 productos en la hoja «Productos». Basta con las 5 primeras
   columnas (verdes): Categoría, Producto, Costo, Precio de venta y Cuántos tengo. Las
   grises (marca, presentación, códigos, subcategoría…) son opcionales. Escribe a propósito
   una letra en un precio. Súbela: verás la fila en rojo con el error. Corrígelo en la
   tabla y toca **Guardar en el catálogo**.
6. **Etiquetas**: Catálogo → **Etiquetas**. Verás los productos «por reimprimir». Elige
   el formato y toca **Imprimir**. Puedes elegir **Guardar como PDF** para verlas sin
   impresora. Luego toca **Ya las imprimí**.
7. **Hoja de códigos**: Catálogo → **Hoja de códigos** → **Generar códigos que faltan** →
   **Imprimir hoja** (o guardar como PDF).
8. **Costos privados**: entra como una trabajadora (cajera). Verá productos, precios y
   stock, pero **no** los costos ni las pestañas de editar.

Cuando todo te funcione, dime **«fase 3 aprobada»** y seguimos con la fase 4
(abastecimiento e inventario: proveedores, cuentas de dinero, compras, viaje de
compras desde el celular, kardex y alertas).

## Notas

- **IVA**: no se usa en ninguna pantalla. Internamente queda un valor oculto por si algún
  día la tienda se registra para facturar (fase 7).
- **Excel**: las plantillas que ya hayas descargado siguen funcionando (si tenían una
  columna de IVA, simplemente se ignora).
- **Fotos**: se achican solas antes de subirlas (≈100 KB cada una) para que el plan
  gratuito de Supabase alcance por años.
- **Sin impresora todavía**: las etiquetas se pueden guardar como PDF. En la fase 5 te
  recomiendo qué impresora comprar.
