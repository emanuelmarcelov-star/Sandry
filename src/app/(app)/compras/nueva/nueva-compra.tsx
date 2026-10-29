"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FormularioCompra, type LineaPedida } from "@/components/compras/formulario-compra";
import { AvisosCosto } from "@/components/compras/avisos-costo";
import { lineaVacia, type ProductoLigero } from "@/lib/compras";
import { textosCompras } from "@/lib/textos";
import { marcarPedido, registrarCompra, type AvisoCosto } from "@/server/acciones/abastecimiento";

/** Compra suelta o del distribuidor que llega a la tienda: entra al stock al guardar. */
export function NuevaCompra({
  productos,
  proveedores,
  cuentas,
  pedido,
  puedeCrearProducto,
  puedeCrearLugar,
}: {
  productos: ProductoLigero[];
  proveedores: { id: string; nombre: string }[];
  cuentas: { id: string; nombre: string; tipo: string }[];
  pedido: { id: string; proveedorId: string; lineas: LineaPedida[] } | null;
  puedeCrearProducto: boolean;
  puedeCrearLugar: boolean;
}) {
  const router = useRouter();
  const [avisos, setAvisos] = useState<AvisoCosto[]>([]);
  const porId = new Map(productos.map((p) => [p.id, p]));
  const inicial = pedido
    ? {
        proveedorId: pedido.proveedorId,
        lineas: pedido.lineas
          .filter((l) => porId.has(l.productoId))
          .map((l) => ({ ...lineaVacia(porId.get(l.productoId)!, l.presentacionId), cantidad: l.cantidad })),
      }
    : undefined;

  return (
    <div className="grid gap-5">
      <AvisosCosto avisos={avisos} />
      <FormularioCompra
        productos={productos}
        proveedores={proveedores}
        cuentas={cuentas}
        claveBorrador={pedido ? `compra-pedido-${pedido.id}` : "compra-nueva"}
        inicial={inicial}
        pedido={pedido?.lineas}
        puedeCrearProducto={puedeCrearProducto}
        puedeCrearLugar={puedeCrearLugar}
        onGuardar={async (datos) => {
          const r = await registrarCompra(datos);
          if (!r.ok) return r;
          if (pedido) await marcarPedido(pedido.id, "recibido", r.datos!.id);
          toast.success(textosCompras.formulario.guardada);
          setAvisos(r.datos!.avisos);
          window.scrollTo({ top: 0, behavior: "smooth" });
          if (pedido) router.replace("/compras/nueva");
          router.refresh();
          return { ok: true };
        }}
      />
    </div>
  );
}
