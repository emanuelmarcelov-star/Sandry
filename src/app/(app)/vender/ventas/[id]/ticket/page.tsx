import { Suspense } from "react";
import { notFound } from "next/navigation";
import { dec, formatoDolares, formatoFecha, formatoHora } from "@/lib/dinero";
import { textos, textosVentas } from "@/lib/textos";
import { requerirPermiso } from "@/server/sesion";
import { ajustesVenta, obtenerVenta } from "@/server/ventas";
import { ImprimirAlAbrir } from "./imprimir";

const t = textosVentas.ticket;

/** Ticket interno para impresora térmica de 58 u 80 mm (o guardar como PDF). */
export default function Ticket({ params, searchParams }: PageProps<"/vender/ventas/[id]/ticket">) {
  return (
    <Suspense fallback={<p className="text-lg">{textos.general.cargando}</p>}>
      <Contenido params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Contenido({
  params,
  searchParams,
}: {
  params: PageProps<"/vender/ventas/[id]/ticket">["params"];
  searchParams: PageProps<"/vender/ventas/[id]/ticket">["searchParams"];
}) {
  await requerirPermiso("ventas.vender");
  const { id } = await params;
  const { imprimir } = (await searchParams) as Record<string, string | undefined>;
  const [venta, ajustes] = await Promise.all([obtenerVenta(id), ajustesVenta()]);
  if (!venta) notFound();
  const ancho = ajustes.ticketAncho;
  const efectivo = venta.pagos.find((p) => p.forma === "efectivo" && p.recibido);

  return (
    <div className="grid justify-center gap-4">
      <style>{`@page { size: ${ancho}mm auto; margin: 2mm; }`}</style>
      <article
        className="zona-impresion bg-white p-2 font-mono text-black"
        style={{ width: `${ancho - 4}mm`, fontSize: ancho === 58 ? "10px" : "12px", lineHeight: 1.35 }}
      >
        <p className="text-center font-bold" style={{ fontSize: "1.4em" }}>
          {ajustes.tienda}
        </p>
        <p className="text-center">{t.sinValor}</p>
        <p className="mt-1 text-center">
          {t.numero} #{venta.numero} · {formatoFecha(venta.fecha)} {formatoHora(venta.fecha)}
        </p>
        <p className="text-center">
          {t.atendio}: {venta.vendedor.split(" ")[0]}
          {venta.cliente && ` · ${venta.cliente.nombre}`}
        </p>
        {venta.estado === "anulada" && <p className="text-center font-bold">*** ANULADA ***</p>}
        <hr className="my-1 border-dashed border-black" />
        {venta.lineas.map((l) => (
          <div key={l.id}>
            <p>{l.descripcion}</p>
            <p className="flex justify-between">
              <span>
                {l.cantidad} × {formatoDolares(l.precio)}
              </span>
              <span>{formatoDolares(l.total)}</span>
            </p>
          </div>
        ))}
        <hr className="my-1 border-dashed border-black" />
        {dec(venta.descuento).gt(0) && (
          <>
            <p className="flex justify-between">
              <span>{t.subtotal}</span>
              <span>{formatoDolares(venta.subtotal)}</span>
            </p>
            <p className="flex justify-between">
              <span>{textosVentas.pos.descuento}</span>
              <span>−{formatoDolares(venta.descuento)}</span>
            </p>
          </>
        )}
        <p className="flex justify-between font-bold" style={{ fontSize: "1.3em" }}>
          <span>{t.total}</span>
          <span>{formatoDolares(venta.total)}</span>
        </p>
        {venta.pagos.map((p, i) => (
          <p key={i} className="flex justify-between">
            <span>{textosVentas.ventas.pagos[p.forma] ?? p.forma}</span>
            <span>{formatoDolares(p.monto)}</span>
          </p>
        ))}
        {efectivo && (
          <>
            <p className="flex justify-between">
              <span>{t.recibido}</span>
              <span>{formatoDolares(efectivo.recibido!)}</span>
            </p>
            <p className="flex justify-between">
              <span>{t.cambio}</span>
              <span>{formatoDolares(efectivo.cambio ?? 0)}</span>
            </p>
          </>
        )}
        {ajustes.ticketMensaje && <p className="mt-2 text-center">{ajustes.ticketMensaje}</p>}
      </article>
      <ImprimirAlAbrir automatico={imprimir === "1"} />
    </div>
  );
}
