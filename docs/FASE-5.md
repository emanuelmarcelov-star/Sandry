# Fase 5 — Punto de venta: qué hay y cómo probarlo

Menú → **Vender** (y **Clientes**). Mientras Netlify no tenga créditos (hasta el 28/11/2026),
se prueba en la computadora: **http://localhost:3200**, o desde el celular en el mismo wifi
(la dirección cambia según el wifi; pídeme la de ese momento), por ejemplo:
**http://192.168.0.168:3200**.

## Qué se hizo

- **Pantalla de venta** pensada para la PC y el celular.
  - En la PC el carrito va al lado.
  - En el celular hay una barra abajo con el total, que abre el carrito.
- **Tres formas de leer códigos**, todas listas:
  - **Lector USB** en la PC: escaneas sin hacer clic antes. La app distingue el lector de alguien escribiendo.
  - **Lector Bluetooth** emparejado con el celular o la tablet: funciona igual.
  - **Cámara** del celular o de la PC (botón **Cámara**): lee varios productos seguidos sin cerrarse.
  - Al leer un código suena un pitido y el celular vibra.
  - Si escaneas el mismo producto otra vez, sube la cantidad.
  - Si escaneas la jaba, se agrega la jaba.
- **Cantidades**: escribe `6*` y luego escanea o busca: se agregan 6.
- **Buscar**: por nombre, apodo («colita»), código corto (`10` = pan) o código de barras.
- **Botones** de lo más vendido (se ordenan solos, y pesa más lo que se vende a esa hora) y botones por categoría.
- **Productos con varias presentaciones**: al tocarlos pregunta unidad, jaba, funda…
- **Por libra o kilo**: escribes cuántas libras, o cuánto dinero («deme $1 de papas»).
- **Código no registrado**:
  - la administradora puede crearlo con el código ya puesto;
  - la cajera lo vende como **pendiente** (nombre y precio) y la administradora lo completa después.
- **Botones**:
  - **Venta libre**: cobrar un monto sin buscar el producto. Queda marcado para revisar.
  - **Consultar precio**: muestra el precio sin vender.
  - **En espera**: atender a otro cliente y retomar la venta después.
  - **Repetir última** y **Deshacer**.
- **Atajos en la PC**: F2 buscar, F4 cobrar, F8 poner en espera.
- **Avisos al vender**:
  - Sin stock: avisa pero deja vender. En Ajustes se puede cambiar a no dejar vender.
  - Alcohol y cigarrillos: aviso de mayoría de edad y horario de alcohol (configurable).
- **Cobrar**:
  - **Efectivo**: botones rápidos ($5, $10, $20…), el **cambio en grande** y con qué billetes darlo.
  - **Deuna**: muestra el QR de la tienda y anotas el número de transacción.
  - **Transferencia**: muestra los datos del banco, con un botón para copiarlos.
  - **Fiado**: solo a clientes. Pasar el límite necesita el PIN de la administradora.
  - **Pago mixto**: parte en una forma y parte en otra.
- **Descuentos**: más del límite configurado (5 %) necesita el **PIN de la administradora**.
- **El precio lo pone la app**, no el celular: nadie puede cobrar otro precio por error.
- **Ticket** para impresora térmica de 58 u 80 mm («Documento sin valor tributario»). También se puede enviar por **WhatsApp**.
- **Caja** (Vender → Caja), una sola para todas:
  - se abre en la mañana con el fondo de cambio;
  - muestra lo vendido por forma de pago;
  - se cierra contando billetes y monedas;
  - el sobrante o faltante queda registrado;
  - solo la administradora puede reabrirla.
- **Ventas** (Vender → Ventas):
  - la cajera ve solo las suyas y la administradora todas;
  - para **anular** o **devolver** productos hace falta un motivo y el PIN de la administradora;
  - el stock y el dinero vuelven a su lugar.
- **Clientes y fiados** (menú → Clientes):
  - ficha con lo que debe y su historial;
  - **abonos** (por partes);
  - **recordatorio amable por WhatsApp**;
  - el límite de fiado solo lo sube la administradora.
- **Cada venta guarda el costo del momento**, para que la ganancia de la fase 6 sea la real.

Pruebas automáticas, todas pasan:
- 122 de cálculos;
- 95 de reglas de la base de datos;
- 38 recorridos en el navegador, con el lector USB simulado.

---

## Antes de probar (una sola vez)

1. Menú → **Ajustes** → **Punto de venta**:
   - **Subir imagen del QR de Deuna**: es la foto del QR de tu cuenta Deuna Negocios.
   - **Datos de la cuenta bancaria**: banco, tipo, número, titular y cédula.
   - Revisa a qué cuenta entra cada forma de pago. Por defecto: efectivo → Caja, Deuna → Deuna, transferencia → Banco.
   - Toca **Guardar**.
2. Menú → **Mi cuenta** → crea **tu PIN** si no lo tienes. La cajera lo necesita cuando tú autorizas algo.

## Cómo probarlo tú mismo

1. **Abrir caja**: menú → **Vender** → escribe cuánto hay en la caja (ej. `20`) → **Abrir caja**.
2. **Vender con la cámara** (en el celular): toca **Cámara** y apunta a un producto que tenga su código registrado. Escucharás el pitido. Escanea otro y otro.
3. **Vender buscando**: escribe `coca` y toca el producto. Si tiene jaba, te pregunta cuál.
4. **Por libra**: toca un producto por libra (papas) y escribe `$1` en «…o ¿cuánto dinero?».
5. **Cobrar en efectivo**: toca **Cobrar** → **$5.00** → verás el cambio en grande → **Confirmar venta**.
   - Luego toca **Imprimir ticket**: puedes elegir «Guardar como PDF».
6. **Deuna**: haz otra venta y en Cobrar elige **Deuna**: aparece tu QR.
7. **Fiado**:
   1. Menú → **Clientes** → **Nuevo cliente**, con un límite de `$10`.
   2. Vende y cobra con **Fiado**, eligiendo ese cliente.
   3. En su ficha toca **Registrar abono**.
   4. Prueba también **Recordar por WhatsApp**.
8. **Anular**: Vender → **Ventas** → abre una venta → **Anular venta** → escribe el motivo.
9. **Cerrar caja**: Vender → **Caja**.
   - Escribe cuántos billetes y monedas hay de cada uno.
   - Verás si **cuadra**, si **sobra** o si **falta**.
   - Toca **Cerrar caja**.
10. **Lector USB** (cuando lo compres): conéctalo a la PC, abre **Vender** y escanea sin hacer clic en nada.

Cuando todo te funcione, dime **«fase 5 aprobada»** y seguimos con la fase 6 (gastos y reportes: cuánto ganas por día, semana y mes).

---

## Qué comprar: lector e impresora

No encontré precios de tiendas de Ecuador en internet. Lo que sigue son las características que importan y precios aproximados de otros países, solo como referencia. Pídelos con estas características en Mercado Libre Ecuador, Kywi o en tiendas de equipos para negocios (POS).

**Lector de códigos (recomendado: 2D inalámbrico)**
- **2D**: lee códigos de barras **y QR**. Los 1D o «láser» no leen QR.
- **Inalámbrico con base USB (2.4 GHz) y también Bluetooth**: sirve en la PC y en el celular o tablet.
- Que funcione en **modo teclado (HID)**. Casi todos lo traen así de fábrica. No necesita programas.
- Precio de referencia: unos **$35 a $60**. En mayoristas aparece desde unos $54 por pieza ([Made-in-China](https://es.made-in-china.com/category23_Consumer-Electronics/Barcode-Scanner_13.html)).
- Mientras tanto, la **cámara del celular** funciona sin comprar nada.

**Impresora de tickets (recomendada: térmica de 80 mm, USB)**
- **Térmica** (no usa tinta), ancho de papel de **80 mm**. Hay de 58 mm, más baratas, y la app también las acepta: se elige en Ajustes.
- **USB** para conectarla a la PC, y que tenga **driver para Windows**. Así imprime desde el navegador con «Imprimir».
- Compatible con **ESC/POS**, que es el estándar ([Yo Facturo](https://yo-facturo.com/blog/impresora-termica-como-elegir-para-tu-negocio/)). Si tiene corte automático, mejor.
- Desde el celular, por ahora, el ticket se envía por **WhatsApp**. Imprimir directo desde el celular por Bluetooth necesita una app extra.
- Referencia de precios fuera de Ecuador:
  - una 80 mm con USB y Bluetooth en España cuesta unos 70 € ([PcComponentes](https://www.pccomponentes.com/qian-impresora-termica-de-tickets-80mm-usb-rj45-bluetooth-negra));
  - una 58 mm de escritorio en Perú, unos S/ 142 (≈ $38) ([Falabella Perú](https://www.falabella.com.pe/falabella-pe/category/CATG46272/Impresoras-Termicas)).

**Etiquetas adhesivas**: siguen funcionando las hojas A4 de la fase 3. Si algún día quieres una impresora de etiquetas, que imprima **50 × 25 mm**.

## Notas

- **Sin señal**: el carrito queda guardado en el dispositivo. Si se va el internet al cobrar, la venta se envía sola cuando vuelve.
- **Open Food Facts**: al crear un producto desde la caja con el código puesto, el botón de autocompletar del formulario busca el nombre y la marca.
- **Balanza** (a futuro): ya se leen los códigos de peso variable (prefijos 20–28). El código corto del producto en la balanza debe ser su código corto en Sandry.
