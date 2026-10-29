import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { clienteServidor } from "@/lib/supabase/servidor";
import { textos } from "@/lib/textos";
import { puede, requerirUsuarioActivo } from "@/server/sesion";
import { productosParaCompra } from "@/server/abastecimiento";
import { PantallaConteo } from "./pantalla-conteo";

export default function PaginaConteo({ params }: PageProps<"/inventario/conteos/[id]">) {
  return (
    <Suspense fallback={<p className="text-lg">{textos.general.cargando}</p>}>
      <Contenido params={params} />
    </Suspense>
  );
}

async function Contenido({ params }: { params: PageProps<"/inventario/conteos/[id]">["params"] }) {
  const yo = await requerirUsuarioActivo();
  if (!puede(yo, "inventario.contar") && !puede(yo, "inventario.aprobar")) redirect("/?aviso=sin-permiso");
  const { id } = await params;
  const supabase = await clienteServidor();
  const { data: conteo } = await supabase
    .from("conteos")
    .select("id, nombre, estado, conteo_lineas(producto_id, sistema, contado, productos(nombre, unidad_base, existencias(cantidad)))")
    .eq("id", id)
    .maybeSingle();
  if (!conteo) notFound();
  const productos = await productosParaCompra(yo);
  const lineas = conteo.conteo_lineas
    .map((l) => {
      const p = l.productos as unknown as { nombre: string; unidad_base: string; existencias: { cantidad: number } | null };
      return {
        productoId: l.producto_id,
        nombre: p?.nombre ?? "",
        unidadBase: p?.unidad_base ?? "unidad",
        sistema: l.sistema === null ? String(p?.existencias?.cantidad ?? 0) : String(l.sistema),
        contado: l.contado === null ? "" : String(l.contado),
      };
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  return (
    <PantallaConteo
      conteo={{ id: conteo.id, nombre: conteo.nombre, estado: conteo.estado }}
      lineas={lineas}
      productos={productos}
      puedeContar={puede(yo, "inventario.contar")}
      puedeAprobar={puede(yo, "inventario.aprobar")}
    />
  );
}
