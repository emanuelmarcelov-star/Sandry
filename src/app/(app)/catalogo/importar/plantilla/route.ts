import { NextResponse } from "next/server";
import { obtenerUsuario } from "@/server/sesion";
import { listarCategorias } from "@/server/catalogo";
import { crearPlantilla } from "@/server/excel/plantilla";

/** Descarga la plantilla de Excel con las categorías actuales en las listas. */
export async function GET() {
  const usuario = await obtenerUsuario();
  if (!usuario || usuario.estado !== "activo" || !usuario.permisos.includes("productos.editar")) {
    return new NextResponse("No tienes permiso.", { status: 403 });
  }
  const categorias = await listarCategorias();
  const archivo = await crearPlantilla(categorias.filter((c) => c.activa));
  return new NextResponse(new Uint8Array(archivo), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="plantilla-sandry.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
