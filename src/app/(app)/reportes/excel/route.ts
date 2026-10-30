import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { clienteServidor } from "@/lib/supabase/servidor";
import { textosReportes, textosVentas } from "@/lib/textos";
import { obtenerUsuario, puede } from "@/server/sesion";
import { obtenerReporte } from "@/server/reportes";

const t = textosReportes;
const VERDE = "FF15803D";
const fecha = (x?: string | null) => (x && /^\d{4}-\d{2}-\d{2}$/.test(x) ? x : null);
const horaLocal = (f: string) => new Date(new Date(f).getTime() - 5 * 3600_000); // Ecuador: UTC−5

/** El reporte del período en Excel: resumen, ventas, gastos, productos y flujo de dinero. */
export async function GET(pedido: Request) {
  const usuario = await obtenerUsuario();
  if (!usuario || usuario.estado !== "activo" || !puede(usuario, "reportes.ver")) {
    return new NextResponse("No tienes permiso.", { status: 403 });
  }
  const url = new URL(pedido.url);
  const desde = fecha(url.searchParams.get("desde"));
  const hasta = fecha(url.searchParams.get("hasta"));
  if (!desde || !hasta) return new NextResponse("Fechas no válidas.", { status: 400 });
  const persona = url.searchParams.get("usuario") ?? "";
  const { reporte: r, error } = await obtenerReporte(desde, hasta, persona);
  if (!r) return new NextResponse(error ?? "No se pudo armar el reporte.", { status: 500 });

  const supabase = await clienteServidor();
  const inicio = new Date(`${desde}T05:00:00Z`).toISOString();
  const fin = new Date(new Date(`${hasta}T05:00:00Z`).getTime() + 86_400_000).toISOString();
  let consultaVentas = supabase
    .from("ventas")
    .select("numero, fecha, total, estado, clientes(nombre), perfiles!ventas_usuario_id_fkey(nombre_completo), venta_pagos(forma_pago_id, monto)")
    .gte("fecha", inicio)
    .lt("fecha", fin)
    .order("fecha");
  if (persona) consultaVentas = consultaVentas.eq("usuario_id", persona);
  const [{ data: ventas }, { data: gastos }] = await Promise.all([
    consultaVentas,
    supabase
      .from("gastos")
      .select("fecha, monto, descripcion, personal, anulado, categorias_gasto(nombre, grupo), cuentas_dinero(nombre)")
      .gte("fecha", inicio)
      .lt("fecha", fin)
      .order("fecha"),
  ]);

  const libro = new ExcelJS.Workbook();
  libro.creator = "Sandry";
  const hoja = (nombre: string, columnas: { titulo: string; ancho: number; dinero?: boolean }[], filas: unknown[][]) => {
    const h = libro.addWorksheet(nombre);
    h.columns = columnas.map((c) => ({ header: c.titulo, width: c.ancho }));
    const cabeza = h.getRow(1);
    cabeza.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cabeza.fill = { type: "pattern", pattern: "solid", fgColor: { argb: VERDE } };
    for (const f of filas) h.addRow(f);
    columnas.forEach((c, i) => {
      if (c.dinero) h.getColumn(i + 1).numFmt = '"$"#,##0.00';
    });
    h.views = [{ state: "frozen", ySplit: 1 }];
    return h;
  };
  const n = (v: unknown) => Number(v ?? 0);

  hoja("Resumen", [{ titulo: `Reporte ${desde} a ${hasta}`, ancho: 44 }, { titulo: "", ancho: 16, dinero: true }], [
    [t.ventas, n(r.ventas)],
    [t.numeroVentas, r.cantidad_ventas],
    [t.costo, n(r.costo)],
    [t.gananciaBruta, n(r.ganancia_bruta)],
    [t.gastos, n(r.gastos)],
    [t.perdidas, n(r.perdidas)],
    [t.gananciaNeta, n(r.ganancia_neta)],
    [t.compras, n(r.compras)],
    [t.inventarioCosto, n(r.inventario.costo)],
    [t.inventarioVenta, n(r.inventario.venta)],
    [t.fiados, n(r.fiados)],
    [t.porPagar, n(r.por_pagar)],
  ]);
  hoja("Por día", [{ titulo: "Día", ancho: 14 }, { titulo: t.ventas, ancho: 14, dinero: true }, { titulo: t.gananciaBruta, ancho: 16, dinero: true }],
    r.por_dia.map((d) => [d.dia, n(d.ventas), n(d.ganancia)]));
  hoja("Por categoría", [{ titulo: "Categoría", ancho: 30 }, { titulo: t.ventas, ancho: 14, dinero: true }, { titulo: t.gananciaBruta, ancho: 16, dinero: true }],
    r.por_categoria.map((c) => [c.categoria, n(c.ventas), n(c.ganancia)]));
  hoja("Productos", [{ titulo: "Producto", ancho: 34 }, { titulo: "Cantidad", ancho: 12 }, { titulo: t.ventas, ancho: 14, dinero: true }, { titulo: t.gananciaBruta, ancho: 16, dinero: true }],
    [...r.productos].sort((a, b) => n(b.ventas) - n(a.ventas)).map((p) => [p.producto, n(p.cantidad), n(p.ventas), n(p.ganancia)]));
  hoja("Ventas", [{ titulo: "Nº", ancho: 8 }, { titulo: "Fecha", ancho: 18 }, { titulo: "Vendió", ancho: 22 }, { titulo: "Cliente", ancho: 22 }, { titulo: "Pago", ancho: 22 }, { titulo: "Total", ancho: 12, dinero: true }, { titulo: "Estado", ancho: 10 }],
    (ventas ?? []).map((v) => [
      v.numero,
      horaLocal(v.fecha),
      (v.perfiles as unknown as { nombre_completo: string } | null)?.nombre_completo ?? "",
      (v.clientes as { nombre: string } | null)?.nombre ?? "",
      v.venta_pagos.map((p) => textosVentas.ventas.pagos[p.forma_pago_id] ?? p.forma_pago_id).join(" + "),
      n(v.total),
      v.estado === "anulada" ? "Anulada" : "",
    ])).getColumn(2).numFmt = "dd/mm/yyyy hh:mm";
  hoja("Gastos", [{ titulo: "Fecha", ancho: 14 }, { titulo: "Tipo", ancho: 22 }, { titulo: "Qué fue", ancho: 24 }, { titulo: "Detalle", ancho: 28 }, { titulo: "Cuenta", ancho: 16 }, { titulo: "Monto", ancho: 12, dinero: true }, { titulo: "", ancho: 14 }],
    (gastos ?? []).map((g) => {
      const c = g.categorias_gasto as { nombre: string; grupo: string } | null;
      return [horaLocal(g.fecha), c?.grupo ?? "", c?.nombre ?? "", g.descripcion, (g.cuentas_dinero as { nombre: string } | null)?.nombre ?? "", n(g.monto), g.anulado ? "Anulado" : g.personal ? "Personal" : ""];
    })).getColumn(1).numFmt = "dd/mm/yyyy";
  hoja("Dinero", [{ titulo: "", ancho: 28 }, { titulo: t.entra, ancho: 14, dinero: true }, { titulo: t.sale, ancho: 14, dinero: true }],
    r.flujo.map((f) => [t.motivos[f.motivo] ?? f.motivo, f.entra === null ? "" : n(f.entra), f.sale === null ? "" : n(f.sale)]));

  const archivo = Buffer.from(await libro.xlsx.writeBuffer());
  return new NextResponse(new Uint8Array(archivo), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="reporte-sandry-${desde}-a-${hasta}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
