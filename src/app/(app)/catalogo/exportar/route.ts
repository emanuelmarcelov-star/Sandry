import { NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";
import { obtenerUsuario, puede } from "@/server/sesion";
import { buscarProductos, listarCategorias } from "@/server/catalogo";
import { crearPlantilla, type MovimientoExcel, type ResumenExcel } from "@/server/excel/plantilla";
import { filasDeCompras, filasDeSalidas, filasParaExportar } from "@/lib/excel/productos";
import { dec, formatoFecha } from "@/lib/dinero";
import { textosCatalogo } from "@/lib/textos";

/** Ecuador está en UTC−5 todo el año: Excel no maneja zonas horarias. */
const horaLocal = (fecha: string) => new Date(new Date(fecha).getTime() - 5 * 3600_000);
const DIAS_DE_MOVIMIENTOS = 90;

/**
 * «Descargar mis productos»: todo lo de la tienda al día en un solo Excel.
 *  - «Productos», «Compras» y «Salidas» van llenas, listas para editar y
 *    volver a importar (solo se escribe lo que entró o salió).
 *  - «Resumen» y «Movimientos» son solo para ver.
 * Los costos y el kardex solo salen si la persona tiene permiso de verlos.
 */
export async function GET() {
  const usuario = await obtenerUsuario();
  if (!usuario || usuario.estado !== "activo" || !puede(usuario, "productos.editar")) {
    return new NextResponse("No tienes permiso.", { status: 403 });
  }
  const verCostos = puede(usuario, "costos.ver");
  const [categorias, productos] = await Promise.all([listarCategorias(), buscarProductos(usuario, { limite: 20000 })]);
  const ordenados = [...productos].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  const contexto = categorias.map((c) => ({ id: c.id, nombre: c.nombre, padreId: c.padreId }));

  // Kardex de los últimos 90 días (RLS: solo quien ve costos).
  let movimientos: MovimientoExcel[] | undefined;
  const delMes = new Map<string, { cantidad: number; valor: number }>();
  if (verCostos) {
    const supabase = await clienteServidor();
    const desde = new Date(Date.now() - DIAS_DE_MOVIMIENTOS * 86400_000).toISOString();
    const { data } = await supabase
      .from("movimientos_stock")
      .select("fecha, tipo, cantidad, saldo, costo_unitario, nota, productos(nombre)")
      .gte("fecha", desde)
      .order("fecha", { ascending: false })
      .limit(10000);
    const ahora = horaLocal(new Date().toISOString());
    const inicioMes = Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), 1);
    movimientos = (data ?? []).map((m) => {
      const fecha = horaLocal(m.fecha);
      if (fecha.getTime() >= inicioMes) {
        const total = delMes.get(m.tipo) ?? { cantidad: 0, valor: 0 };
        total.cantidad += Math.abs(Number(m.cantidad));
        total.valor += Math.abs(Number(m.cantidad)) * Number(m.costo_unitario ?? 0);
        delMes.set(m.tipo, total);
      }
      return {
        fecha,
        producto: (m.productos as { nombre: string } | null)?.nombre ?? "",
        tipo: textosCatalogo.stock.tipos[m.tipo] ?? m.tipo,
        cantidad: Number(m.cantidad),
        saldo: Number(m.saldo),
        nota: m.nota,
      };
    });
  }

  // Resumen: cómo está la tienda hoy.
  let valorCosto = dec(0);
  let valorVenta = dec(0);
  let pocos = 0;
  let agotados = 0;
  for (const p of ordenados) {
    const stock = dec(p.stock);
    if (stock.lte(0)) agotados++;
    else if (dec(p.stockMinimo).gt(0) && stock.lt(p.stockMinimo)) pocos++;
    const precio = p.presentaciones.find((x) => x.esBase)?.precioVenta;
    if (stock.gt(0) && p.costo) valorCosto = valorCosto.plus(stock.times(p.costo));
    if (stock.gt(0) && precio) valorVenta = valorVenta.plus(stock.times(precio));
  }
  const resumen: ResumenExcel = [
    {
      titulo: `Inventario al ${formatoFecha(new Date())}`,
      filas: [
        ["Productos", ordenados.length],
        ["Agotados (0 o menos)", agotados],
        ["Con poco stock (menos del aviso)", pocos],
        ...(verCostos ? [["Lo que costó lo que hay en la tienda", valorCosto.toNumber(), true] as const] : []),
        ["Lo que valdría todo vendido", valorVenta.toNumber(), true],
        ...(verCostos ? [["Ganancia si se vende todo", valorVenta.minus(valorCosto).toNumber(), true] as const] : []),
      ] as ResumenExcel[number]["filas"],
    },
  ];
  if (verCostos) {
    const tipos = textosCatalogo.stock.tipos;
    const filas: ResumenExcel[number]["filas"] = [];
    const compras = delMes.get("compra");
    filas.push(["Entró mercadería (unidades)", compras?.cantidad ?? 0]);
    filas.push(["Lo que costó lo que entró", compras?.valor ?? 0, true]);
    for (const tipo of ["merma", "caducado", "autoconsumo", "regalo", "robo"]) {
      const t = delMes.get(tipo);
      if (t) filas.push([`Salió: ${tipos[tipo].toLowerCase()} (unidades)`, t.cantidad], [`   lo que costó`, t.valor, true]);
    }
    resumen.push({ titulo: "Este mes (entradas y salidas de mercadería)", filas });
  }
  resumen.push({
    titulo: "Ventas, gastos e ingresos",
    filas: [["Todavía no: se agregan aquí cuando estén la caja (fase 5) y los reportes (fase 6).", ""]],
  });

  const archivo = await crearPlantilla(categorias.filter((c) => c.activa), {
    productos: filasParaExportar(ordenados, contexto),
    compras: filasDeCompras(ordenados, contexto),
    salidas: filasDeSalidas(ordenados, contexto),
    resumen,
    movimientos,
  });
  const fecha = formatoFecha(new Date()).replaceAll("/", "-");
  return new NextResponse(new Uint8Array(archivo), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="sandry-${fecha}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
