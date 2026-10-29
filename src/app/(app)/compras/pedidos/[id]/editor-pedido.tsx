"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MessageCircle, PackageCheck, Sparkles, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Aviso, Campo, Selector } from "@/components/formulario";
import { BuscarProducto } from "@/components/compras/formulario-compra";
import { enlaceWhatsApp, textoPedido, type ProductoLigero } from "@/lib/compras";
import { textos, textosCompras } from "@/lib/textos";
import { guardarPedido, marcarPedido } from "@/server/acciones/abastecimiento";

const t = textosCompras.pedidos;

type Linea = { productoId: string; presentacionId: string; cantidad: string };
export type PedidoEditable = { id?: string; proveedorId: string; estado: string; nota: string; lineas: Linea[] };

export function EditorPedido({
  inicial,
  productos,
  proveedores,
  sugerida,
  tienda,
}: {
  inicial: PedidoEditable;
  productos: ProductoLigero[];
  proveedores: { id: string; nombre: string; telefono: string }[];
  sugerida: { productoId: string; cantidad: string; proveedorId: string | null }[];
  tienda: string;
}) {
  const router = useRouter();
  const [p, setP] = useState(inicial);
  const [error, setError] = useState<string>();
  const [guardando, iniciar] = useTransition();
  const porId = new Map(productos.map((x) => [x.id, x]));
  const editable = p.estado === "borrador" || p.estado === "enviado";
  const proveedor = proveedores.find((x) => x.id === p.proveedorId);

  function agregar(productoId: string, presentacionId: string | undefined, cantidad: string) {
    const producto = porId.get(productoId);
    if (!producto) return;
    const pres =
      producto.presentaciones.find((x) => x.id === presentacionId) ??
      producto.presentaciones.find((x) => x.esBase)!;
    if (p.lineas.some((l) => l.presentacionId === pres.id)) return;
    setP((actual) => ({ ...actual, lineas: [...actual.lineas, { productoId, presentacionId: pres.id, cantidad }] }));
  }

  async function guardar(): Promise<string | null> {
    setError(undefined);
    const r = await guardarPedido({ id: p.id, proveedorId: p.proveedorId, nota: p.nota, lineas: p.lineas });
    if (!r.ok) {
      setError(r.mensaje);
      return null;
    }
    setP((actual) => ({ ...actual, id: r.datos!.id }));
    return r.datos!.id;
  }

  const lineasTexto = p.lineas.map((l) => {
    const producto = porId.get(l.productoId);
    return {
      producto: producto?.nombre ?? "",
      presentacion: producto?.presentaciones.find((x) => x.id === l.presentacionId)?.nombre ?? "",
      cantidad: l.cantidad,
    };
  });

  return (
    <div className="grid gap-5">
      {error && <Aviso tipo="error">{error}</Aviso>}
      {!editable && <Aviso tipo="info">{t.estados[p.estado]}</Aviso>}
      <Campo id="pedido-proveedor" etiqueta={t.proveedor}>
        <Selector id="pedido-proveedor" value={p.proveedorId} disabled={!editable} onChange={(e) => setP({ ...p, proveedorId: e.target.value })}>
          <option value="">—</option>
          {proveedores.map((x) => (
            <option key={x.id} value={x.id}>
              {x.nombre}
            </option>
          ))}
        </Selector>
      </Campo>

      {editable && (
        <>
          {p.proveedorId && sugerida.some((s) => s.proveedorId === p.proveedorId) && (
            <Button
              variant="outline"
              className="justify-self-start"
              onClick={() => sugerida.filter((s) => s.proveedorId === p.proveedorId).forEach((s) => agregar(s.productoId, undefined, s.cantidad))}
            >
              <Sparkles className="size-5" aria-hidden /> {t.sugeridos}
            </Button>
          )}
          <BuscarProducto productos={productos} puedeCrear={false} onElegir={(x, pres) => agregar(x.id, pres, "1")} onCreado={() => {}} />
        </>
      )}

      <ul className="grid gap-2">
        {p.lineas.map((l, i) => {
          const producto = porId.get(l.productoId);
          if (!producto) return null;
          const opciones = producto.presentaciones.filter((x) => x.paraCompra || x.esBase);
          return (
            <li key={l.presentacionId} className="grid grid-cols-[1fr_auto] items-end gap-2 rounded-xl border p-3">
              <span className="col-span-2 font-semibold">{producto.nombre}</span>
              <div className="grid grid-cols-2 gap-2">
                <Selector
                  aria-label={textosCompras.formulario.presentacion}
                  value={l.presentacionId}
                  disabled={!editable}
                  onChange={(e) => setP({ ...p, lineas: p.lineas.map((x, j) => (j === i ? { ...x, presentacionId: e.target.value } : x)) })}
                >
                  {opciones.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.nombre}
                    </option>
                  ))}
                </Selector>
                <Input
                  aria-label={`${textosCompras.formulario.cantidad} ${producto.nombre}`}
                  inputMode="decimal"
                  value={l.cantidad}
                  disabled={!editable}
                  onChange={(e) => setP({ ...p, lineas: p.lineas.map((x, j) => (j === i ? { ...x, cantidad: e.target.value } : x)) })}
                />
              </div>
              {editable && (
                <Button variant="ghost" onClick={() => setP({ ...p, lineas: p.lineas.filter((_, j) => j !== i) })} aria-label={`${textosCompras.formulario.quitar} ${producto.nombre}`}>
                  <Trash2 className="size-5" aria-hidden />
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      {editable && (
        <div className="flex flex-wrap gap-2">
          <Button
            size="lg"
            disabled={guardando}
            onClick={() =>
              iniciar(async () => {
                const id = await guardar();
                if (!id) return;
                toast.success(t.guardado);
                router.replace(`/compras/pedidos/${id}`);
              })
            }
          >
            {guardando ? textos.general.guardando : t.guardar}
          </Button>
          <Button
            size="lg"
            variant="outline"
            disabled={guardando || !proveedor?.telefono || !p.lineas.length}
            title={proveedor && !proveedor.telefono ? t.sinTelefono : undefined}
            onClick={() =>
              iniciar(async () => {
                const id = await guardar();
                if (!id || !proveedor) return;
                await marcarPedido(id, "enviado");
                setP((actual) => ({ ...actual, estado: "enviado" }));
                // Se abre WhatsApp en la misma pestaña (una ventana nueva la bloquean los celulares).
                window.location.href = enlaceWhatsApp(proveedor.telefono, textoPedido(tienda, lineasTexto));
              })
            }
          >
            <MessageCircle className="size-5" aria-hidden /> {t.whatsapp}
          </Button>
          {p.id && (
            <>
              <Link href={`/compras/nueva?pedido=${p.id}`} className={buttonVariants({ size: "lg", variant: "outline" })}>
                <PackageCheck className="size-5" aria-hidden /> {t.recibir}
              </Link>
              <Button
                size="lg"
                variant="ghost"
                className="text-destructive"
                onClick={() =>
                  iniciar(async () => {
                    const r = await marcarPedido(p.id!, "anulado");
                    if (!r.ok) return setError(r.mensaje);
                    router.push("/compras/pedidos");
                  })
                }
              >
                {t.anular}
              </Button>
            </>
          )}
        </div>
      )}
      {proveedor && !proveedor.telefono && editable && <p className="text-sm text-muted-foreground">{t.sinTelefono}</p>}
    </div>
  );
}
