# Fase 6 — Gastos y reportes: qué hay y cómo probarlo

Se abre igual que antes: doble clic en **«Abrir Sandry»** del Escritorio (o **http://localhost:3200**).

## Qué se hizo

- **Inicio** (para la administradora), con un panel:
  - **ventas de hoy**, comparadas con el mismo día de la semana pasada;
  - **ganancia bruta de hoy**;
  - **efectivo en la caja**;
  - **saldo de cada cuenta**.
  - Abajo, **lo que hay que revisar**: poco stock, por caducar, fiados, deudas vencidas, productos vendidos sin registrar, «venta libre» por revisar y gastos fijos por pagar.
- **Gastos** (menú → Gastos):
  - Anotas un gasto con qué fue, cuánto y de qué cuenta salió el dinero.
  - **Gastos del carro** (gasolina, mantenimiento, lavado, matrícula…): eliges si son **de la tienda** o **personales**.
    - Lo personal pagado con plata de la tienda cuenta como **retiro de la dueña**, no como gasto del negocio, y aparece en «Dinero personal».
    - Lo personal pagado con su propio dinero no toca la tienda.
    - Opcional: el carro, los galones y el kilometraje.
  - **Gastos fijos del mes**: arriendo, luz, agua, internet y sueldo de la trabajadora.
    - La app avisa cuáles faltan por pagar.
    - Con **Configurar** pones el monto y el día; con **Pagar**, el gasto se llena solo.
  - **Otro ingreso** (lo que no es venta, por ejemplo la comisión de recargas).
  - **Anular** un gasto anotado por error: el dinero vuelve a su cuenta.
- **Reportes** (menú → Reportes), por **hoy, ayer, esta semana, este mes, el mes pasado, este año** o las fechas que elijas, y por trabajadora:
  - **Ventas, costo, ganancia bruta, margen, gastos, mermas y ganancia neta.**
    - Ganancia neta = ganancia bruta − gastos del negocio − lo que se dañó, caducó o se consumió en la casa.
  - Gráficos: **ventas por día**, **horas con más ventas** y **días de la semana**.
  - **Por categoría**, **por forma de pago**, **por trabajadora**.
  - **Lo más vendido**, **lo que más deja**, **lo que menos deja** y **lo vendido a pérdida**.
  - **Gastos por tipo** y **mermas por motivo**.
  - **Entradas y salidas de dinero**, en total y por cuenta.
  - **Compras por lugar** y cuánto fue la gasolina y el transporte comparado con lo comprado.
  - **Valor del inventario** (a costo y a precio de venta), **fiados por cobrar** y **deudas con proveedores**.
  - **Conciliación**: lo cobrado por Deuna o transferencia cada día, para comparar con la app del banco y marcar «verificado».
  - **Descargar Excel** (resumen, por día, por categoría, productos, ventas, gastos y dinero) e **Imprimir o guardar PDF**.
- **Resumen del día al cerrar la caja**:
  - en pantalla, como siempre;
  - **por correo**, cuando actives el Gmail de la tienda (ver abajo).

Pruebas automáticas, todas pasan:
- 127 de cálculos;
- 104 de reglas de la base de datos;
- 41 recorridos en el navegador.

---

## Activar el correo del resumen (una sola vez)

Hace falta una **contraseña de aplicación** del Gmail de la tienda (`tiendasandry.ec@gmail.com`). Es la misma clase de clave que usamos en la fase 2. Si la guardaste, puedes usar esa misma.

1. Si no la tienes, créala:
   1. Entra a **https://myaccount.google.com/apppasswords** con el Gmail de la tienda.
   2. Escribe el nombre `Sandry resumen` y toca **Crear**.
   3. Copia las 16 letras que aparecen.
2. Abre el **Bloc de notas** → **Archivo → Abrir**.
3. Pega esta ruta y ábrela:
   `C:\Users\Emanuel\Desktop\tienda-web\.env.production.local`
   (abajo a la derecha elige «Todos los archivos»).
4. Busca la línea `GMAIL_CLAVE_APP=` y pega las 16 letras justo después del `=`, sin espacios antes.
5. **Guarda** el archivo.
6. Cierra la ventana negra de Sandry y vuelve a abrir **«Abrir Sandry»**.
7. En **Ajustes → Punto de venta → Correo para el resumen del día** escribe a qué correo quieres que llegue y toca **Guardar**.

**No pegues esa clave en el chat.** Solo va en ese archivo.

## Cómo probarlo tú mismo

1. **Inicio**: entra como administradora. Verás las ventas y la ganancia de hoy, el efectivo de la caja y los saldos.
2. **Gastos fijos**: menú → **Gastos**.
   1. En «Arriendo del local» toca **Configurar**, pon el monto y el día, y guarda.
   2. Luego toca **Pagar**, elige la cuenta y guarda: desaparece de pendientes.
3. **Gasto del carro**:
   1. Elige **Gasolina** y luego **Personal / de la casa**.
   2. Toca **+ Agregar carro** y escribe el nombre del carro.
   3. Pon el monto y la cuenta, y guarda.
   4. En **Dinero**, ese monto aparece como retiro de la dueña.
4. **Gasto de la tienda**: elige **Luz**, pon el monto y guarda. En **Reportes → Hoy** sube «Gastos del negocio».
5. **Reportes**:
   1. Toca **Este mes**: revisa la ganancia bruta y la neta, los gráficos y lo más vendido.
   2. Toca **Descargar Excel** y ábrelo.
   3. Toca **Imprimir o guardar PDF**.
6. **Conciliación**: si vendiste con Deuna, en Reportes marca **Verificado** el día que ya revisaste en la app de Deuna.
7. **Resumen por correo**: con el correo activado, cierra la caja: llegará el resumen.

Cuando todo te funcione, dime **«fase 6 aprobada»**. Lo que sigue es la **fase 8** (extras y pulido: promociones, cambio masivo de precios, respaldos y el manual para tu mamá). La **fase 7** (facturación) queda al final, como acordamos.

## Notas

- **Ganancia real**: cada venta guarda lo que costó el producto en ese momento. Por eso la ganancia no cambia si después cambia el costo.
- **Mermas**: lo que se dañó, caducó, se robó, se regaló o se consumió en la casa se valora al costo promedio actual del producto.
- **Sin categorías dentro del filtro**: el reporte ya muestra la parte de cada categoría, así que no hace falta filtrar por una.
