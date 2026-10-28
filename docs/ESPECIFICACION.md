# Proyecto: Sistema para la tienda de mi mamá (ventas + inventario + compras + reportes + facturación)

## 0. Cómo quiero que trabajes conmigo

- Háblame siempre en español sencillo. Tengo poca o ninguna experiencia programando: explícame en pocas líneas qué haces y por qué, sin jerga innecesaria. Cuando yo tenga que hacer algo fuera de aquí (crear una cuenta, copiar una clave, ejecutar un comando), dame los pasos exactos y numerados.
- Antes de escribir código: lee toda esta especificación, guárdala tal cual en `docs/ESPECIFICACION.md`, crea un `CLAUDE.md` con las reglas del proyecto y las decisiones que vayamos tomando, y preséntame un plan por fases. Si algo es ambiguo, pregúntame antes de asumir.
- Trabaja por fases (sección 13). Al terminar cada fase, la app debe funcionar y tener pruebas de lo importante. Dime cómo probarla yo mismo paso a paso y espera mi visto bueno antes de seguir.
- Usa git desde el inicio y haz commits pequeños con mensajes claros en español.
- Nunca pongas contraseñas, claves de API ni la firma electrónica en el código ni en git. Usa `.env.local` y explícame dónde configurarlas en producción.
- Prefiere soluciones simples y librerías populares y mantenidas. Pregúntame antes de agregar cualquier servicio de pago.
- Si una regla legal o tributaria de esta especificación te parece desactualizada, verifícala en fuentes oficiales (sri.gob.ec) y avísame. No inventes reglas.

## 1. Contexto del negocio

Tienda de barrio en Ecuador (moneda USD, zona horaria America/Guayaquil).

Qué vende (es solo un ejemplo: vende muchas más cosas y agrega productos nuevos seguido, así que nada del catálogo debe quedar fijo en el código):

- Bebidas: gaseosas (Coca-Cola y otras), aguas, jugos, energizantes.
- Cervezas y bebidas alcohólicas (Pilsener y otras).
- Helados, lácteos (leche, yogurt, queso), carnes y embutidos, y todo lo de congelador y refrigeradora.
- Víveres (arroz, azúcar, aceite, fideos, enlatados, granos, huevos) y pan.
- Golosinas y snacks, que se venden por funda y también por unidad.
- Frutas y verduras: algunas por unidad y también por libra (por ejemplo, las papas tienen un precio por unidad y otro por libra).
- Cigarrillos (por unidad y por cajetilla), medicinas de venta libre (por pastilla o sobre y por caja), artículos de limpieza y hogar (escobas, detergentes), aseo personal, algo de ferretería y cosas varias.

Algunos productos traen código de barras y otros no (pan, papas, caramelos sueltos, huevos, carnes, cosas a granel).

Cómo se abastece (las tres formas pasan siempre):

1. Distribuidores que llegan a la tienda (Coca-Cola, Cervecería Nacional/Pilsener, lácteos, pan, embutidos, snacks y otros): a veces el preventista toma un pedido y lo entregan otro día, y a veces llegan directo con la mercadería. Venden por jaba, por paquete o por unidad.
2. Ella sale en su carro a comprar en varios lugares en un mismo viaje (mercado, mayoristas, bodegas, supermercados). En esos viajes gasta en gasolina, parqueadero, etc., y esos son egresos de la tienda.
3. Compras sueltas en cualquier lugar cuando hace falta algo.

A veces paga con el dinero de la caja, a veces con su propio dinero y a veces desde su cuenta bancaria o Deuna.

El problema principal que hay que resolver: ella pone el precio de venta, pero hoy NO sabe cuánto gana por día, semana o mes, ni cuánto dinero entra y sale.

Usuarios: la dueña (administradora) y una o más trabajadoras que atienden. Lo usarán desde el celular y desde la computadora.

## 2. Objetivo

Una sola aplicación web instalable (PWA), que funcione en celular y en PC, con:

1. Punto de venta (POS) rápido, con lector de código de barras (PC y celular) y búsqueda fácil para productos sin código.
2. Inventario y stock en tiempo real.
3. Abastecimiento: compras a distribuidores, viajes de compras en su carro a varios lugares y compras sueltas, con sus gastos de transporte.
4. Importación y exportación de Excel.
5. Ganancias, ingresos y egresos por día, semana y mes.
6. Usuarios con roles y permisos.
7. Comprobantes: consumidor final o con datos del cliente, y factura electrónica del SRI cuando aplique.
8. Varias formas de pago: efectivo, Deuna, transferencia, tarjeta y fiado.

## 3. Tecnología (ya decidida; no la cambies sin consultarme)

- Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui.
- Supabase (plan gratuito): PostgreSQL, Auth (correo y contraseña, recuperación por correo), Storage (fotos de productos, recibos, comprobantes, logo) y Row Level Security activado en TODAS las tablas.
- Despliegue en Vercel (plan gratuito), con el código en GitHub.
- PWA instalable (manifest, íconos, service worker). El internet de la tienda es estable, así que no hace falta un modo offline completo. Sí hay que mostrar un aviso claro cuando no haya conexión y no perder lo que se estaba registrando (guardar en el dispositivo el carrito de venta y el borrador de una compra en curso, porque en el mercado o en el supermercado la señal puede ser débil).
- Correos (recuperar contraseña, enviar facturas): el correo por defecto de Supabase tiene límites muy bajos, así que configura un SMTP propio (por ejemplo, Resend en plan gratuito) y explícame cómo.
- Códigos de barras:
  - Lectura con cámara: la API nativa `BarcodeDetector` cuando el navegador la tenga y, si no (por ejemplo en iPhone), el paquete `barcode-detector` (basado en zxing-wasm) como respaldo.
  - Generación de códigos y etiquetas: `bwip-js` o `JsBarcode`.
  - Autocompletar datos de productos nuevos: la API gratuita de Open Food Facts.
- Excel: ExcelJS (o SheetJS instalado desde su CDN oficial) para leer y escribir .xlsx, con plantillas que tengan listas desplegables.
- Gráficos: Recharts. Validación: Zod. Formularios: React Hook Form.
- Pruebas: Vitest para la lógica y Playwright para los flujos críticos.
- Dinero: nunca uses números flotantes para montos. En la base de datos, montos con `numeric(12,4)` y cantidades con `numeric(12,3)` (para libras); en el código, una librería decimal (por ejemplo decimal.js). Redondeo final a 2 decimales.
- Toda la interfaz en español de Ecuador: montos como $1.50 y fechas como dd/mm/aaaa.
- Todo lo sensible (firma electrónica, llamadas al SRI, cálculos de ganancia) se ejecuta en el servidor, nunca en el navegador.

## 4. Usuarios, inicio de sesión y permisos

Registro: nombre completo, correo, teléfono, cédula (opcional, validando el dígito verificador), contraseña (mínimo 8 caracteres, con confirmación) y foto opcional.

- El primer usuario que se registre queda como Administrador (la dueña). Después, nadie entra sin aprobación: los registros nuevos quedan "pendientes" hasta que la administradora los apruebe y les asigne un rol. La administradora también puede invitar por correo.
- Inicio de sesión con correo y contraseña, con opción "Recordarme" en el dispositivo.
- Olvidé mi contraseña: enlace por correo para crear una nueva.
- Olvidé mi usuario o correo: la persona escribe su teléfono o cédula y se le muestra su correo enmascarado (por ejemplo ma****@gmail.com), con límite de intentos. La administradora también puede ver y corregir los correos de su personal.
- Cambio rápido de usuario en un dispositivo compartido con un PIN de 4 a 6 dígitos por persona, para que cada venta quede a nombre de quien la hizo.
- La administradora puede desactivar usuarios (no borrarlos, para conservar el historial), resetear el PIN y cambiar roles.
- Cierre de sesión automático por inactividad (tiempo configurable).

Roles (los permisos se pueden ajustar con casillas desde la cuenta de administradora):

- Administradora: acceso a todo.
- Trabajadora/Cajera: vende, busca productos, ve el stock y los precios de venta, abre y cierra SU caja, registra clientes y fiados (hasta el límite de cada cliente) y ve sus propias ventas del día. Si la administradora lo permite, también puede recibir la mercadería de un distribuidor. NO puede ver costos, ganancias ni reportes del negocio; no puede cambiar precios; no puede anular ventas, hacer devoluciones ni dar descuentos mayores a un porcentaje configurado sin que la administradora ingrese su PIN en ese momento; no puede borrar nada ni entrar a Ajustes o Usuarios.
- Encargada de inventario (opcional): registra compras, recibe mercadería y hace conteos de inventario, sin ver reportes de ganancia.

Los permisos se validan en el servidor y en las políticas RLS, no solo ocultando botones.

Bitácora de auditoría (visible solo para la administradora): quién y cuándo cambió precios, anuló ventas, hizo ajustes de stock, aprobó descuentos o cambió permisos.

## 5. Catálogo: categorías, productos, presentaciones y códigos

El catálogo es totalmente abierto: la administradora crea, edita, desactiva y reorganiza productos y categorías cuando quiera, y crear un producto nuevo debe tomar segundos (desde el catálogo, desde una compra o desde el POS al escanear un código desconocido).

Categorías en árbol (categoría → subcategoría → ...), editables, con ícono o color. Estas se cargan por defecto y se pueden cambiar:

- Bebidas → Gaseosas, Aguas, Jugos y néctares, Energizantes e hidratantes
- Cervezas y bebidas alcohólicas → Cervezas, Licores, Vinos
- Helados
- Lácteos → Leche, Yogurt, Quesos, Mantequilla
- Carnes y embutidos → Pollo, Res, Cerdo, Embutidos
- Congelados y refrigerados
- Víveres → Arroz, Azúcar y endulzantes, Aceites, Granos, Fideos, Harinas, Enlatados, Huevos, Condimentos, Café e infusiones
- Panadería
- Frutas y verduras → Tubérculos (papas), Verduras, Frutas
- Golosinas y snacks → Caramelos, Chocolates, Galletas, Snacks
- Cigarrillos
- Botiquín (medicinas de venta libre)
- Limpieza y hogar (escobas, trapeadores, detergentes, cloro)
- Aseo personal
- Ferretería
- Papelería y útiles
- Mascotas
- Hielo
- Varios (recargas, bazar, etc.)

Cada producto tiene: nombre, marca, categoría, uno o varios códigos de barras, código interno corto (ver 7.2), sinónimos o apodos para buscarlo (por ejemplo "colita", "chupete"), foto, unidad base de stock (unidad, libra, kilo o litro), tarifa de IVA (15%, 0% o exento; con un valor por defecto según la categoría y editable), proveedores o lugares donde se compra, stock mínimo, si maneja fecha de caducidad, si usa envase retornable, si es solo para mayores de 18 (alcohol y cigarrillos), si está activo, y ubicación (percha, congelador, refrigeradora).

Presentaciones (esto es clave). Cada producto se puede vender y comprar en varias presentaciones, y cada una tiene:

- nombre (unidad, funda, paquete x6, jaba x12, jaba x24, cajetilla, caja, libra, media libra...);
- factor de conversión a la unidad base. Ejemplos: Coca-Cola 500 ml → unidad = 1, paquete = 6, jaba = 12. Caramelo → unidad = 1, funda = 100. Papas → la unidad base es la libra y "unidad" equivale aproximadamente a 0.4 lb (valor editable);
- código de barras propio (opcional; por ejemplo, el código ITF-14 de la caja o del paquete, para que al escanear la caja se registre la jaba completa);
- precio de venta propio (no tiene que ser factor × precio unitario; la funda puede salir más barata);
- si se usa para vender, para comprar o para ambas cosas.

El stock SIEMPRE se guarda en la unidad base y, al vender o comprar, se convierte con el factor. Los productos por peso admiten cantidades con decimales.

Precios:

- Precio de venta por presentación, con el margen % calculado automáticamente frente al costo, mostrado en rojo si se vende a pérdida.
- Precio sugerido según un margen objetivo por categoría (por ejemplo, gaseosas 20% y golosinas 35%), con redondeo configurable a $0.05.
- Promociones y precios por cantidad (por ejemplo, 3 por $1.00, 2x1, o un precio especial por fecha u horario).
- Actualización masiva de precios: subir un % o un monto a toda una categoría, marca o proveedor (útil cuando el distribuidor sube precios), con vista previa antes de aplicar.
- Historial de cambios de precio y de costo.
- Los precios de venta al público incluyen IVA; el sistema desglosa la base imponible y el IVA cuando haga falta.

Etiquetas e impresión de códigos:

- Generar códigos de barras internos para productos que no traen (EAN-13 con prefijo 2, que está reservado para uso interno de cada tienda) y evitar duplicados.
- Imprimir etiquetas adhesivas con nombre, precio y código, en hojas A4 de etiquetas o en impresora térmica.
- Imprimir una "hoja de códigos" para tener plastificada junto a la caja, con foto, nombre y código de barras de los productos que no traen código (pan, papas por libra, caramelos sueltos, huevos...), para escanearlos directamente desde la hoja.
- Etiquetas de precio para perchas (habladores). Cuando un precio cambia, el producto entra a una lista de "etiquetas por reimprimir".

## 6. Abastecimiento: compras e inventario

### 6.1 Proveedores y lugares de compra

No todos son distribuidores. Cada uno tiene un tipo: distribuidor que entrega en la tienda, mayorista/bodega, mercado, supermercado u otro. Datos: nombre, tipo, RUC (opcional; en el mercado normalmente no hay), contacto, teléfono/WhatsApp, dirección o ubicación, días de visita del preventista (por ejemplo, Coca-Cola los martes), condiciones de pago, productos que vende e historial de precios.

### 6.2 Cuentas de dinero (de dónde sale y a dónde entra la plata)

- Cuentas configurables: Caja (efectivo del turno), Caja fuerte / ahorro de la tienda, Banco (una o varias), Deuna y "Dinero personal de la dueña".
- Toda venta, compra, gasto, abono o retiro dice de qué cuenta sale o a qué cuenta entra, y cada cuenta muestra su saldo.
- Transferencias entre cuentas (por ejemplo, depositar el efectivo en el banco o pasar dinero de la caja a la caja fuerte).
- Si la dueña paga algo de la tienda con su dinero personal, queda como "aporte de la dueña". Si saca dinero de la tienda para la casa, queda como "retiro de la dueña". Así el flujo de dinero de la tienda es real.

### 6.3 Distribuidor que llega a la tienda

- Pedido al preventista (opcional): se arma desde la lista de compras sugerida y se puede enviar por WhatsApp.
- Recepción de mercadería: escanear o elegir productos y comparar contra el pedido (faltantes, sobrantes, dañados). Por cada línea: presentación (jaba, paquete o unidad), cantidad y costo de esa presentación (o total de la línea). También: bonificaciones, envases retornables entregados y recibidos, número y foto de la factura, y si se paga de contado (y desde qué cuenta) o a crédito (genera una cuenta por pagar con fecha de vencimiento).

### 6.4 Viaje de compras en su carro (pensado para el celular)

- "Iniciar viaje de compras": carga la lista de compras sugerida (stock bajo y lo que se vende más) más lo que ella agregue.
- En cada lugar que visita registra la compra: lugar, productos, presentación, cantidades, precios (o solo el total si tiene apuro, y luego detalla), foto del recibo, si tiene factura o no, y de qué cuenta pagó. Va tachando la lista. Tiene que poder hacerse rápido, con una sola mano, y no perder nada si se va la señal.
- Gastos del viaje: gasolina, parqueadero, peajes, cargador/estibador, fundas, etc.
- "Recibir en tienda": al llegar, confirma lo que entra al stock (cantidades reales y productos dañados).
- Resumen del viaje: total comprado por lugar, gastos del viaje y qué porcentaje representan sobre lo comprado.
- Costo del transporte, configurable:
  - Opción 1 (por defecto): se registra como gasto del negocio (Transporte).
  - Opción 2: se reparte (prorratea) en el costo de los productos de ese viaje según su valor, para ver el costo real de cada producto.
  - El mismo gasto nunca se cuenta dos veces.

### 6.5 Reglas comunes a todas las compras

- También existe un registro rápido de compra suelta (sin viaje y sin pedido).
- El sistema calcula el costo por unidad base. Las bonificaciones (por ejemplo, "por 10 jabas te regalan 1") entran al stock con costo cero y bajan el costo promedio.
- Al guardar: suma el stock, recalcula el costo promedio ponderado y, si el costo subió, ofrece actualizar el precio de venta mostrando el precio sugerido.
- Distinguir compras con factura y sin factura. Para el contador, solo las que tienen factura sirven como respaldo tributario (verificar la regla vigente). Avisar que las compras de más de $500 deben pagarse por el sistema financiero para que sean deducibles (verificar).
- Comparador de precios: por cada producto, el último precio pagado en cada lugar y cuál es el más barato. Alerta si pagó más caro que de costumbre o que en otro lugar.

### 6.6 Importar por Excel (requisito importante)

- Botón "Descargar plantilla" que genera un .xlsx con las hojas `Productos`, `Compras`, `Gastos`, `Categorias` (solo de referencia) e `Instrucciones`. Las columnas llevan listas desplegables (categoría, unidad, presentación, IVA, lugar, cuenta de dinero) y filas de ejemplo.
- Hoja Productos: código de barras, código interno, nombre, marca, categoría, subcategoría, unidad base, presentación, factor, precio de compra, precio de venta, IVA, stock inicial, stock mínimo, fecha de caducidad y proveedor.
- Hoja Compras: fecha, lugar o proveedor, número de factura (opcional), con factura sí/no, cuenta de dinero, código o nombre del producto, presentación, cantidad y costo.
- Hoja Gastos: fecha, categoría (por ejemplo, gasolina), descripción, monto y cuenta de dinero.
- Flujo: subir el archivo → vista previa con las filas válidas en verde y los errores en rojo, explicando el problema (categoría inexistente, precio vacío, código duplicado...) → corregir en pantalla si hace falta → confirmar. Al confirmar se crean o actualizan productos, se crean las categorías y lugares nuevos (si la administradora acepta) y el stock se suma como una compra.
- Coincidencias: buscar primero por código de barras, luego por código interno y luego por nombre parecido (en este último caso, pedir confirmación).
- Tolerante con mayúsculas y minúsculas, tildes, espacios, coma o punto decimal y filas vacías.
- Un mismo archivo puede traer productos nuevos, compras y gastos a la vez.
- Exportar a Excel: inventario actual (con su valor a costo y a precio de venta), lista de precios, ventas, compras, gastos y reportes.

### 6.7 Inventario

- Kardex por producto: todas las entradas y salidas con fecha, usuario, motivo y saldo.
- Ajustes con motivo obligatorio: merma o daño, caducado, robo o pérdida, consumo de la casa (autoconsumo; importante para que la ganancia sea real), regalo o error de conteo.
- Conteo físico (toma de inventario) por categoría o total, desde el celular y escaneando códigos, comparando sistema contra realidad y generando ajustes que aprueba la administradora.
- Lotes con fecha de caducidad (leche, yogurt, carnes, medicinas), alerta de "por caducar en X días" y sugerencia de vender primero lo que vence antes.
- Alertas de stock bajo y "lista de compras sugerida", agrupada por proveedor o lugar según las ventas promedio de las últimas semanas. Sirve para enviarla por WhatsApp al preventista o para usarla en el viaje de compras.
- Productos sin movimiento en X días.
- Control de envases retornables (jabas y botellas de Coca-Cola y Pilsener): cuántos envases vacíos hay, cuántos se deben al proveedor y la garantía cobrada al cliente que no trae envase (devuelta cuando lo trae).

## 7. Punto de venta (POS)

Debe ser MUY rápido y fácil en celular y en PC, con botones grandes y pocos toques.

### 7.1 Lector de código de barras

Todavía no tenemos lector: el sistema debe funcionar perfecto sin él y quedar listo para cuando lo compremos. Hay tres formas de leer códigos y todas deben funcionar:

- Lector USB en la PC: funciona como un teclado (escribe los números muy rápido y termina con Enter). Implementa en el POS un "escuchador global" que detecte esa escritura rápida terminada en Enter aunque el cursor no esté en el buscador, para no tener que hacer clic antes de escanear, y que no la confunda con alguien escribiendo a mano.
- Lector inalámbrico/Bluetooth emparejado con un celular o tablet en modo teclado: funciona igual que el USB.
- Cámara del celular o de la PC, sin comprar nada: botón "Escanear" que abre la cámara y puede leer varios productos seguidos sin cerrarse. Formatos: EAN-13, EAN-8, UPC-A/E, Code 128, ITF-14 y QR.

Comportamiento al escanear:

- Pitido y vibración de confirmación. Si se escanea otra vez el mismo producto, sube la cantidad.
- Si se escribe una cantidad antes de escanear (por ejemplo "6" y luego escanear), se agregan 6.
- Si el código pertenece a una presentación (jaba, paquete), se agrega esa presentación.
- Si el código no existe:
  - la administradora puede crear el producto ahí mismo, con el código ya puesto. El sistema intenta autocompletar nombre, marca y foto con Open Food Facts y, si no lo encuentra, se llena a mano;
  - la cajera puede venderlo como "producto pendiente" (nombre y precio), que queda en una lista para que la administradora lo complete después.
- El escaneo también se usa en la recepción de compras, en el conteo de inventario y en "Consultar precio".
- Cuando lleguemos a esa fase, recomiéndame qué lector comprar (que lea códigos de barras y QR, USB o inalámbrico, en modo teclado) y qué impresora térmica de tickets y etiquetas sirve con el sistema.

### 7.2 Productos sin código de barras

- Código interno corto (PLU) de 1 a 4 dígitos, fácil de recordar (por ejemplo 10 = pan, 25 = papas por libra). Se escribe y, con Enter, se agrega.
- Búsqueda por nombre tolerante a errores, sin importar tildes ni mayúsculas, y por sinónimos ("cocacola", "coca 3l", "pilsner", "colita").
- Cuadrícula de botones con foto o color, por categoría.
- La "hoja de códigos" plastificada y las etiquetas de la sección 5 para escanear lo que no trae código.
- A futuro, una balanza digital: dejar preparado el soporte de los códigos de peso variable (prefijo 2 + código del producto + peso o precio) que imprimen algunas balanzas.

### 7.3 Facilidades para vender rápido

- Favoritos que se ordenan solos por lo más vendido y según la hora del día (por ejemplo, pan y leche en la mañana).
- Al tocar un producto con varias presentaciones, se elige entre unidad, funda, jaba, libra, etc. En productos por peso se ingresan libras o un monto en dólares ("deme $1 de papas" calcula las libras).
- Botón "Varios / venta libre" para cobrar un monto sin buscar el producto; queda marcado para revisión.
- Atajos de teclado en la PC (por ejemplo F2 buscar, F4 cobrar, F8 poner en espera, Esc cancelar) y teclado numérico grande en el celular.
- Deshacer el último producto agregado.
- Ventas en espera (atender a otro cliente y retomar después).
- Repetir la última venta o el "pedido de siempre" de un cliente frecuente.
- Modo "Consultar precio" sin vender.
- Búsqueda por voz opcional, cuando el navegador la soporte.
- Carrito: cambiar cantidad, quitar, agregar nota, aplicar promociones automáticamente y dar descuento manual con el límite de cada rol.
- Al cobrar en efectivo, mostrar el cambio en grande y sugerir con qué billetes y monedas darlo.

### 7.4 Reglas de la venta

- Validación de stock: avisar si no hay stock (configurable entre bloquear o permitir con alerta).
- Aviso de mayoría de edad en alcohol y cigarrillos, y horario de venta de alcohol configurable.
- Al cobrar: elegir el tipo de comprobante (sección 9) y la forma o formas de pago (sección 8).
- Ticket: imprimir en impresora térmica de 58 u 80 mm (con CSS de impresión), compartir por WhatsApp, enviar por correo o no imprimir.
- Devoluciones y anulaciones solo con autorización de la administradora y con motivo; devuelven el stock y quedan en la bitácora.
- Cada venta guarda: usuario, caja o turno, fecha y hora, cliente, líneas con precio de venta y COSTO UNITARIO EN ESE MOMENTO (para calcular la ganancia real aunque luego cambie el costo), IVA, descuentos y pagos.

## 8. Formas de pago

Lista configurable. Cada forma de pago se asocia a una cuenta de dinero (sección 6.2). Por defecto:

- Efectivo: se ingresa con cuánto paga el cliente y se muestra el cambio en grande, con botones rápidos ($1, $5, $10, $20, monto exacto).
- Deuna Negocios (y, opcionalmente, "Deuna personal" si recibe pagos en su cuenta personal): la pantalla muestra la imagen del QR de su cuenta (la administradora la sube en Ajustes) para que el cliente lo escanee. La cajera confirma que llegó la notificación en la app Deuna y registra el número de transacción o sus últimos dígitos. No hay una API pública de autoservicio para que el sistema confirme el pago solo, así que la confirmación es manual. Deja el código preparado con una interfaz `ProveedorPagoQR` por si en el futuro se integra la API de algún agregador (por ejemplo, Payvalida genera QR de Deuna desde un servidor); no la implementes ahora.
- Transferencia / banca web: mostrar los datos de la cuenta bancaria (banco, tipo, número, titular, cédula o RUC) con botón de copiar; registrar el banco de origen y el número de comprobante, con foto opcional del comprobante.
- Tarjeta (si algún día tiene datáfono o cobra con tarjeta desde Deuna Negocios): registrar el número de voucher.
- Fiado / crédito: solo para clientes registrados con límite de crédito; queda como cuenta por cobrar.
- Pago mixto: dividir el total entre varias formas de pago.

Conciliación: reporte diario por forma de pago para comparar con la app Deuna y con el estado de cuenta del banco, con una casilla de "verificado".

## 9. Comprobantes y facturación (Ecuador, SRI)

IMPORTANTE: no soy contador. Implementa esto como un módulo configurable y deja la facturación electrónica funcionando primero en el ambiente de PRUEBAS del SRI. El paso a producción solo se hace cuando yo lo indique y después de que un contador lo valide. Verifica cada regla en sri.gob.ec antes de implementarla y avísame si algo cambió.

Ajustes del emisor (solo la administradora): régimen (Sin RUC / RIMPE Negocio Popular / RIMPE Emprendedor / Régimen General), RUC, razón social, nombre comercial, dirección de la matriz y del establecimiento, código de establecimiento (ej. 001) y punto de emisión (ej. 001), secuenciales, si está obligado a llevar contabilidad, ambiente (pruebas o producción), correo, logo, y firma electrónica (.p12 + clave) guardada cifrada en el servidor y nunca expuesta en el navegador.

Comportamiento según el régimen:

- Sin RUC: solo un ticket interno con la leyenda "Documento sin valor tributario".
- RIMPE Negocio Popular (ingresos de hasta $20.000 al año): emite notas de venta y no cobra IVA (no se desglosa IVA). Por defecto se imprime un ticket interno; si el cliente pide comprobante, se registra el número de la nota de venta (preimpresa por imprenta autorizada, o el medio que el SRI permita en ese momento; verifícalo) y se asocia a la venta. Incluir la leyenda vigente para Negocio Popular (verificarla en el SRI; por ejemplo, "Contribuyente Negocio Popular - Régimen RIMPE").
- RIMPE Emprendedor y Régimen General: factura electrónica con IVA. La tarifa general es 15%. Según la ley, algunos productos tienen tarifa 0%, como muchos alimentos de la canasta básica (leche, carnes, pan, huevos, frutas y verduras, arroz, azúcar, aceite...) y las medicinas; las gaseosas, cervezas, cigarrillos, golosinas y productos de limpieza van con 15%. Cada producto tiene su tarifa editable. La tienda no calcula ICE (lo paga el fabricante), pero verifícalo. Leyenda "Contribuyente Régimen RIMPE" para Emprendedor.

Al cobrar, el sistema pregunta: "¿Consumidor final o con datos?"

- Consumidor final: identificación 9999999999999, sin datos del comprador. Bloquear si el total supera el límite vigente (hoy $50 con IVA incluido; dejar el monto configurable). Algunas fuentes indican un límite distinto para Negocio Popular; verifícalo.
- Con datos: cédula, RUC o pasaporte (validar cédula y RUC con su algoritmo de dígito verificador), nombre o razón social, dirección, correo y teléfono. Guardar al cliente para la próxima vez (buscar por cédula, RUC o nombre).

Factura electrónica (esquema offline del SRI):

- Generar el XML según la ficha técnica vigente del SRI, firmarlo con XAdES-BES usando el .p12 y calcular la clave de acceso de 49 dígitos (con dígito verificador módulo 11). Enviarlo al web service de Recepción y luego consultar el de Autorización. Ambientes: pruebas (celcer.sri.gob.ec) y producción (cel.sri.gob.ec).
- Transmitir al SRI en el momento de la venta (desde 2026 la transmisión es inmediata). Si el SRI no responde, reintentar en segundo plano y mostrar el estado: pendiente, autorizada, devuelta o no autorizada (con el mensaje de error entendible).
- Generar el RIDE (PDF) con el logo y el código de barras de la clave de acceso, y enviarlo por correo al cliente junto con el XML; también se puede compartir por WhatsApp.
- Formas de pago del SRI: efectivo → 01 (sin utilización del sistema financiero), tarjeta de débito → 16, tarjeta de crédito → 19, Deuna y transferencias → 20 (otros con utilización del sistema financiero). Verificar la tabla vigente.
- Notas de crédito electrónicas para devoluciones de facturas con datos. Respetar las reglas vigentes sobre anulación (por ejemplo, las facturas a consumidor final ya no se anulan ni se corrigen con nota de crédito una vez transmitidas; verificar).
- Guardar los XML y RIDE autorizados durante 7 años, con buscador y descarga masiva.
- Diseñar una interfaz `ProveedorFacturacion` con dos implementaciones posibles: (a) conexión directa al SRI (puedes evaluar librerías open source para Node como `open-factura`, revisando que estén mantenidas) y (b) la API de un proveedor de facturación electrónica autorizado. Implementar (a) en el ambiente de pruebas. Revisar si la resolución del SRI sobre el registro de proveedores de sistemas de facturación (NAC-DGERCGC26-00000027) afecta a un sistema hecho para uso propio, y avisarme.
- Reporte mensual de ventas y compras para el contador (Excel), con base 0%, base 15%, IVA y totales, separando las compras con y sin factura.

## 10. Caja, gastos, vehículo, ingresos y egresos

- Apertura de caja por turno y usuario, con monto inicial (fondo de cambio).
- Movimientos de caja: ingresos extra y egresos con categoría y foto opcional.
- Gastos del negocio, cada uno con su cuenta de dinero y foto opcional del recibo. Categorías por defecto (editables):
  - Transporte y vehículo: gasolina, parqueadero, peajes, mantenimiento, lavado, matrícula.
  - Servicios básicos: luz, agua, internet, teléfono.
  - Arriendo.
  - Sueldos.
  - Impuestos y permisos.
  - Mantenimiento del local.
  - Suministros: fundas, papel para la impresora, etiquetas.
  - Otros.
- Gastos recurrentes mensuales (arriendo, luz, internet, sueldos) con recordatorio.
- Vehículo: registrar el o los vehículos que se usan para la tienda y sus cargas de gasolina (monto y, de forma opcional, galones y kilometraje). Como el carro también es de uso familiar, cada gasto se marca como "tienda" o "personal", o se configura un % de uso para la tienda. Solo la parte de la tienda cuenta como egreso del negocio.
- Cierre de caja con arqueo: contar billetes y monedas por denominación ($20, $10, $5, $1, $0.50, $0.25, $0.10, $0.05, $0.01). El sistema compara con lo esperado y muestra el sobrante o faltante, separando lo cobrado en efectivo de Deuna, transferencias, tarjeta y fiado. Solo la administradora puede reabrir una caja.
- Retiros y aportes de la dueña (sección 6.2).
- Clientes y fiados: ficha de cliente, límite de crédito, abonos parciales, historial y saldo; recordatorio por WhatsApp con un mensaje amable y el estado de cuenta.
- Cuentas por pagar a proveedores, con vencimientos y recordatorio.

## 11. Reportes y panel (solo la administradora)

Panel de inicio con tarjetas: ventas de hoy, ganancia bruta de hoy, efectivo esperado en caja, saldo de cada cuenta de dinero, número de ventas, ticket promedio y comparación con el mismo día de la semana anterior. Alertas: stock bajo, productos por caducar, fiados vencidos, cuentas por pagar y productos pendientes de completar (vendidos sin estar registrados).

Filtros por día, semana, mes, año o rango de fechas; por trabajadora; por categoría.

- Ventas totales, costo de lo vendido, ganancia bruta y margen %.
- Ganancia neta = ganancia bruta − gastos del negocio (incluidos gasolina y transporte, salvo que se hayan prorrateado en el costo) − mermas y autoconsumo.
- Flujo de caja: todo lo que entró contra todo lo que salió (ventas cobradas, abonos de fiados, compras pagadas, gastos, aportes y retiros de la dueña), en total y por cuenta de dinero.
- Por categoría y subcategoría (por ejemplo, cuánto deja Bebidas frente a Cervezas).
- Productos más vendidos, más rentables, menos rentables, vendidos a pérdida y sin movimiento.
- Ventas por forma de pago, por hora del día (horas pico) y por día de la semana.
- Compras por lugar y por proveedor, comparador de precios entre lugares, y costo de abastecimiento (gasolina y gastos de viaje por mes y como % de lo comprado).
- Valor del inventario a costo y a precio de venta.
- Mermas y autoconsumo en dólares.
- Fiados pendientes y cuentas por pagar.
- Gráficos claros, y exportación de todo a Excel y PDF.
- Resumen diario automático al cerrar caja (en pantalla y, opcionalmente, por correo).

## 12. Calidad, seguridad y extras

- Interfaz pensada para personas no técnicas: letras grandes, íconos, pocas pantallas, confirmaciones claras y mensajes de error en español entendible. Modo claro y oscuro.
- Diseño adaptable: en celular el POS ocupa toda la pantalla; en PC, el POS va con el carrito al lado. Las pantallas de viaje de compras y conteo de inventario están pensadas primero para celular.
- Respaldo: exportación automática semanal de toda la información y un botón "Descargar respaldo" para la administradora.
- Políticas RLS probadas con pruebas automáticas: una trabajadora no puede leer costos ni ganancias ni siquiera llamando a la API directamente.
- Pruebas automáticas al menos de: conversión de presentaciones y descuento de stock, costo promedio ponderado, prorrateo del transporte, cálculo de ganancia, saldos de las cuentas de dinero, desglose de IVA, cierre de caja, detección del lector de códigos (simulando escritura rápida + Enter), generación de códigos internos sin duplicados, validación de cédula y RUC, clave de acceso y permisos por rol.
- Datos de prueba (seed) realistas de una tienda ecuatoriana para probar todo, y un comando para borrarlos antes de empezar a usar el sistema en serio.
- Manual corto de uso para mi mamá y para la trabajadora (en `docs/`), con pasos simples.
- Textos de la interfaz centralizados en un solo lugar para poder corregirlos fácilmente.

## 13. Fases (entrega cada una funcionando y espera mi aprobación)

1. Preparación: explícame qué instalar (Node LTS, git) y qué cuentas crear (GitHub, Supabase, Vercel, Resend). Crea el proyecto, el `CLAUDE.md`, la estructura de carpetas y un primer despliegue en Vercel.
2. Usuarios: registro, aprobación, inicio de sesión, recuperar contraseña y correo, roles, permisos, PIN y bitácora.
3. Catálogo: categorías, productos, presentaciones, precios, códigos internos, generación e impresión de códigos, etiquetas y hoja de códigos, plantilla de Excel e importación de productos.
4. Abastecimiento e inventario: proveedores y lugares, cuentas de dinero, recepción de distribuidores, viaje de compras desde el celular, compras sueltas y por Excel, gastos de transporte y prorrateo, comparador de precios, costo promedio, kardex, ajustes, caducidades, alertas y envases.
5. Punto de venta: lectura de códigos (lector USB, Bluetooth y cámara), búsqueda y facilidades de venta, formas de pago, caja (apertura, cierre y arqueo), clientes y fiados, y tickets.
6. Gastos, vehículo y reportes: panel de ganancias, ingresos y egresos, flujo por cuenta de dinero y exportaciones.
7. Comprobantes: consumidor final o con datos, nota de venta y factura electrónica en el ambiente de pruebas del SRI, con RIDE y envío por correo.
8. Extras y pulido: promociones, actualización masiva de precios, WhatsApp, búsqueda por voz, respaldos, manual de uso y revisión de seguridad y rendimiento.

Empieza por la fase 1. Primero muéstrame el plan completo y el modelo de datos (tablas principales y cómo se relacionan) explicado de forma sencilla, y espera mi aprobación antes de escribir código.
