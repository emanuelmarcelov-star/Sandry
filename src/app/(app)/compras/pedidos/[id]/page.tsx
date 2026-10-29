import { Suspense } from "react";
import { notFound } from "next/navigation";
import { clienteServidor } from "@/lib/supabase/servidor";
import { textos, textosCompras } from "@/lib/textos";
import { requerirPermiso } from "@/server/sesion";
import { listaSugerida, listarProveedores, productosParaCompra } from "@/server/abastecimiento";
import { EditorPedido, type PedidoEditable } from "./editor-pedido";

export default function PaginaPedido({ params, searchParams }: PageProps<"/compras/pedidos/[id]">) {
  return (
    <div className="grid max-w-2xl gap-5">
      <h1 className="text-3xl font-bold">{textosCompras.pedidos.titulo}</h1>
      <Suspense fallback={<p className="text-lg">{textos.general.cargando}</p>}>
        <Contenido params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Contenido({
  params,
  searchParams,
}: {
  params: PageProps<"/compras/pedidos/[id]">["params"];
  searchParams: PageProps<"/compras/pedidos/[id]">["searchParams"];
}) {
  const yo = await requerirPermiso("compras.registrar");
  const { id } = await params;
  const { proveedor } = (await searchParams) as Record<string, string | undefined>;
  const supabase = await clienteServidor();
  const [productos, proveedores, sugerida, { data: ajustes }] = await Promise.all([
    productosParaCompra(yo),
    listarProveedores(true),
    listaSugerida(),
    supabase.from("ajustes").select("nombre_tienda").maybeSingle(),
  ]);

  let pedido: PedidoEditable = { proveedorId: proveedor ?? "", estado: "borrador", nota: "", lineas: [] };
  if (id !== "nuevo") {
    const { data } = await supabase
      .from("pedidos")
      .select("id, proveedor_id, estado, nota, pedido_lineas(producto_id, presentacion_id, cantidad)")
      .eq("id", id)
      .maybeSingle();
    if (!data) notFound();
    pedido = {
      id: data.id,
      proveedorId: data.proveedor_id,
      estado: data.estado,
      nota: data.nota,
      lineas: data.pedido_lineas.map((l) => ({ productoId: l.producto_id, presentacionId: l.presentacion_id, cantidad: String(l.cantidad) })),
    };
  }

  return (
    <EditorPedido
      inicial={pedido}
      productos={productos}
      proveedores={proveedores.map((p) => ({ id: p.id, nombre: p.nombre, telefono: p.telefono }))}
      sugerida={sugerida.map((s) => ({ productoId: s.productoId, cantidad: s.sugerido, proveedorId: s.proveedorId }))}
      tienda={ajustes?.nombre_tienda ?? "Sandry"}
    />
  );
}
