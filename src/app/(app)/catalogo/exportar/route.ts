import { NextResponse } from "next/server";
import { obtenerUsuario, puede } from "@/server/sesion";
import { buscarProductos, listarCategorias } from "@/server/catalogo";
import { crearPlantilla } from "@/server/excel/plantilla";
import { filasParaExportar } from "@/lib/excel/productos";
import { formatoFecha } from "@/lib/dinero";

/**
 * «Descargar mis productos»: todos los productos activos en el mismo formato de
 * la plantilla, listos para editar y volver a importar. Los costos solo salen
 * si la persona tiene permiso de verlos.
 */
export async function GET() {
  const usuario = await obtenerUsuario();
  if (!usuario || usuario.estado !== "activo" || !puede(usuario, "productos.editar")) {
    return new NextResponse("No tienes permiso.", { status: 403 });
  }
  const [categorias, productos] = await Promise.all([listarCategorias(), buscarProductos(usuario, { limite: 20000 })]);
  const ordenados = [...productos].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  const filas = filasParaExportar(
    ordenados,
    categorias.map((c) => ({ id: c.id, nombre: c.nombre, padreId: c.padreId })),
  );
  const archivo = await crearPlantilla(
    categorias.filter((c) => c.activa),
    filas,
  );
  const fecha = formatoFecha(new Date()).replaceAll("/", "-");
  return new NextResponse(new Uint8Array(archivo), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="productos-sandry-${fecha}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
