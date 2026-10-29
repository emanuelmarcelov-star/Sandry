import { Suspense } from "react";
import { clienteServidor } from "@/lib/supabase/servidor";
import { textos, textosCompras } from "@/lib/textos";
import { puede, requerirUsuarioActivo } from "@/server/sesion";
import { listarCuentas, listarProveedores, productosParaCompra } from "@/server/abastecimiento";
import { redirect } from "next/navigation";
import { NuevaCompra } from "./nueva-compra";

export default function PaginaNuevaCompra({ searchParams }: PageProps<"/compras/nueva">) {
  return (
    <Suspense fallback={<p className="text-lg">{textos.general.cargando}</p>}>
      <Contenido searchParams={searchParams} />
    </Suspense>
  );
}

async function Contenido({ searchParams }: { searchParams: PageProps<"/compras/nueva">["searchParams"] }) {
  const yo = await requerirUsuarioActivo();
  if (!puede(yo, "compras.registrar") && !puede(yo, "compras.recibir")) redirect("/?aviso=sin-permiso");
  const { pedido: pedidoId } = (await searchParams) as Record<string, string | undefined>;
  const [productos, proveedores, cuentas] = await Promise.all([productosParaCompra(yo), listarProveedores(true), listarCuentas()]);

  // «Llegó el pedido»: se arma la compra con lo pedido para comparar.
  let pedido: { id: string; proveedorId: string; lineas: { productoId: string; presentacionId: string; cantidad: string; producto: string; presentacion: string }[] } | null = null;
  if (pedidoId) {
    const supabase = await clienteServidor();
    const { data } = await supabase
      .from("pedidos")
      .select("id, proveedor_id, estado, pedido_lineas(producto_id, presentacion_id, cantidad, productos(nombre), presentaciones(nombre))")
      .eq("id", pedidoId)
      .maybeSingle();
    if (data && (data.estado === "borrador" || data.estado === "enviado")) {
      pedido = {
        id: data.id,
        proveedorId: data.proveedor_id,
        lineas: data.pedido_lineas.map((l) => ({
          productoId: l.producto_id,
          presentacionId: l.presentacion_id,
          cantidad: String(l.cantidad),
          producto: (l.productos as { nombre: string } | null)?.nombre ?? "",
          presentacion: (l.presentaciones as { nombre: string } | null)?.nombre ?? "",
        })),
      };
    }
  }

  return (
    <div className="grid max-w-2xl gap-5">
      <h1 className="text-3xl font-bold">{textosCompras.pestanas.nueva}</h1>
      <NuevaCompra
        productos={productos}
        proveedores={proveedores.map((p) => ({ id: p.id, nombre: p.nombre }))}
        cuentas={cuentas}
        pedido={pedido}
        puedeCrearProducto={puede(yo, "productos.editar")}
        puedeCrearLugar={puede(yo, "proveedores.gestionar")}
      />
    </div>
  );
}
