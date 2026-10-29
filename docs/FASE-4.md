# Fase 4 — Abastecimiento e inventario: qué hay y cómo probarlo

Enlace de la app: **https://storied-raindrop-2de6ba.netlify.app** → menú → **Compras**, **Inventario** y **Dinero**

## Qué se hizo

- **Dinero** (menú → Dinero): las cuentas Caja, Banco, Deuna y Dinero personal de la dueña,
  con su saldo y sus últimos movimientos.
  - Botones para:
    - pasar dinero de una cuenta a otra;
    - «La dueña puso dinero» y «La dueña sacó dinero»;
    - «Conté y hay…», para corregir el saldo.
  - Si algo de la tienda se paga con el **dinero personal**, queda como aporte de la dueña.
  - Se pueden crear más cuentas, por ejemplo «Banco Pichincha».
- **Proveedores y lugares** (Compras → Proveedores):
  - Tipos: distribuidor, mayorista, mercado, supermercado u otro.
  - Datos: teléfono o WhatsApp, días de visita del preventista y condiciones de pago.
- **Nueva compra** (Compras → Nueva compra): sirve para la compra suelta y para el distribuidor que llega.
  - Para cada producto se escanea o busca, y se elige la presentación (jaba, paquete o unidad), la cantidad y el costo.
  - El costo se escribe de dos formas: el de cada jaba, o el total de la línea.
  - Opcional: bonificación (regalo), dañados (en unidades) y fecha de caducidad.
  - Se paga **de contado** (eliges de qué cuenta) o **a crédito** (queda en «Por pagar»).
  - Otros datos: si tiene factura, el número y una foto del recibo.
  - Al guardar:
    - el stock sube;
    - se recalcula el costo promedio;
    - el dinero sale de la cuenta elegida;
    - avisa si el costo **subió** o si **en otro lugar estaba más barato**.
  - Si cierras la pantalla a medias, la compra se recupera al volver.
- **Viaje de compras en el celular** (Compras → Viaje de compras):
  - Empieza con la **lista sugerida** y vas tachando lo que compras.
  - En cada lugar registras la compra, o **solo el total** si tienes apuro, y la detallas después.
  - Anotas la gasolina, el parqueadero, los peajes, etc. (cuentan como gasto de la tienda).
  - **Funciona sin señal**: todo queda guardado en el celular y se envía solo cuando vuelve la señal.
  - Al llegar: **«Llegué a la tienda: recibir»** muestra qué llegó y qué vino dañado, y todo entra al stock.
  - Resumen del viaje: lo comprado por lugar, los gastos y qué porcentaje fueron sobre lo comprado.
- **Por pagar**: lo que se debe a cada proveedor, con la fecha en que vence y el botón **Pagar**. Se puede pagar por partes.
- **Pedidos al preventista** (Compras → Pedidos):
  - Lo armas con lo sugerido para ese proveedor y lo mandas por **WhatsApp**.
  - Cuando llega, en **«Llegó: registrar compra»** la app compara qué faltó o sobró.
- **Inventario → Alertas**:
  - Lo que está **por caducar**, para vender primero eso.
  - La **lista de compras sugerida**, agrupada por proveedor.
  - Los productos **sin movimiento** en 30 días.
- **Fechas de caducidad**: se anotan al comprar o desde la ficha del producto (botón «Anotar fecha de caducidad»). Lo que sale del stock se descuenta primero de lo que vence antes.
- **Inventario → Conteos**:
  - Se cuenta desde el celular (escaneando o buscando).
  - La persona que cuenta **no ve** lo que dice la app, así cuenta sin influencia.
  - Al final, la administradora ve las diferencias y las **aprueba**.
- **Inventario → Envases**: jabas y botellas.
  - Muestra los vacíos que hay en la tienda, los que se deben al proveedor y los que tienen los clientes con garantía.
  - Si cobras o devuelves una garantía, ese dinero entra o sale de la cuenta.
- **Ficha del producto**: ahora muestra **cuánto pagaste en cada lugar** (el más barato marcado) y las fechas de caducidad.

Pruebas automáticas, todas pasan:
- 110 de cálculos;
- 81 de reglas de la base de datos;
- 33 de recorridos en el navegador. Las de esta fase se hacen en tamaño de celular e incluyen un viaje en **modo avión**.

---

## Cómo probarlo tú mismo

1. **Saldo inicial**: menú → **Dinero** → **«Conté y hay…»** → Caja → escribe lo que hay en la caja (ej. `100`) → Guardar.
2. **Proveedor**: Compras → **Proveedores** → Nuevo.
   - Datos: `Coca-Cola`, tipo Distribuidor, tu número de WhatsApp y el día martes.
3. **Compra del distribuidor**: Compras → **Nueva compra**.
   1. Elige el lugar: Coca-Cola.
   2. Busca un producto y elige **Jaba x12**.
   3. Escribe la cantidad `2` y el costo de cada jaba `9`. Verás «= $0.75 por unidad».
   4. Paga de contado desde Caja y toca **Guardar compra**.
   5. Revisa: en Catálogo el stock subió 24, y en Dinero la caja bajó $18.
4. **Viaje en modo avión** (en el celular):
   1. Compras → **Viaje de compras** → **Iniciar viaje**.
   2. Pon el celular en **modo avión**.
   3. Toca **Registrar compra en un lugar**, agrega algo y guarda.
   4. Toca **Anotar gasto**, elige Gasolina y guarda.
   5. Verás «sin enviar».
   6. Quita el modo avión: en unos segundos se envía solo.
   7. Toca **«Llegué a la tienda: recibir»**, corrige lo que vino dañado y confirma.
5. **A crédito**: haz otra compra eligiendo **A crédito**.
   - Ve a **Por pagar**, toca **Pagar**, escribe una parte del monto y elige la cuenta.
6. **Pedido por WhatsApp**: Compras → **Pedidos** → Nuevo pedido.
   1. Elige el proveedor y agrega productos.
   2. Toca **Enviar por WhatsApp**: se abre WhatsApp con el pedido escrito.
7. **Conteo**: Inventario → **Conteos**.
   1. Elige una categoría y toca **Empezar conteo**.
   2. Escribe lo que cuentas y toca **Terminé**.
   3. Como administradora verás las diferencias: toca **Aprobar**.
8. **Caducidad**: en la ficha de la leche (o cualquier producto) toca **Anotar fecha de caducidad**.
   - Pon una fecha de dentro de 3 días: aparecerá en Inventario → **Alertas**.
9. **Envases**: Inventario → **Envases** → crea `Jaba Coca-Cola`.
   - Toca **Registrar** → «Llegaron llenos» → `5`.

Cuando todo te funcione, dime **«fase 4 aprobada»** y seguimos con la fase 5 (punto de venta). En esa fase también te recomiendo qué lector de códigos e impresora comprar.

## Notas

- **Sin señal**: lo que se registra en el viaje queda guardado en el celular.
  - No borres los datos del navegador hasta que diga que todo se envió.
  - Para crear un producto nuevo o subir una foto sí hace falta señal.
- **Compras de más de $500**: la app avisa que deben pagarse por banco (transferencia, cheque o tarjeta) para que sirvan como gasto deducible. Confírmalo con tu contador.
- **Sin factura**: la compra cuenta igual para el stock y para tu ganancia, pero no sirve como respaldo ante el SRI.
- Las **ventas** todavía no existen (fase 5). Por eso la lista sugerida usa por ahora el **stock mínimo** de cada producto. Cuando haya ventas, también usará lo que se vende cada semana.
