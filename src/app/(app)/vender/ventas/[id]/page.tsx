import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { dec, formatoDolares, formatoFecha, formatoHora } from "@/lib/dinero";
import { textos, textosVentas } from "@/lib/textos";
import { puede, requerirPermiso } from "@/server/sesion";
import { listarCuentas } from "@/server/abastecimiento";
import { obtenerVenta } from "@/server/ventas";
import { AccionesVenta } from "./acciones-venta";

const t = textosVentas.ventas;

export default function PaginaVenta({ params }: PageProps<"/vender/ventas/[id]">) {
  return (
    <Suspense fallback={<p className="text-lg">{textos.general.cargando}</p>}>
      <Contenido params={params} />
    </Suspense>
  );
}

async function Contenido({ params }: { params: PageProps<"/vender/ventas/[id]">["params"] }) {
  const yo = await requerirPermiso("ventas.vender");
  const { id } = await params;
  const [venta, cuentas] = await Promise.all([obtenerVenta(id), listarCuentas()]);
  if (!venta) notFound();
  return (
    <div className="grid max-w-2xl gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-3xl font-bold">
          {t.ticket} #{venta.numero}
        </h1>
        {venta.estado === "anulada" && <Badge variant="destructive">{t.anulada}</Badge>}
      </div>
      <p className="text-muted-foreground">
        {formatoFecha(venta.fecha)} {formatoHora(venta.fecha)} · {t.vendio}: {venta.vendedor}
        {venta.cliente && ` · ${venta.cliente.nombre}`}
      </p>
      {venta.motivoAnulacion && <p className="text-destructive">{venta.motivoAnulacion}</p>}
      <ul className="grid gap-1">
        {venta.lineas.map((l) => (
          <li key={l.id} className="flex justify-between gap-2 border-b py-2">
            <span>
              {l.cantidad} × {l.descripcion}
              {l.revisar && <Badge variant="secondary" className="ml-2">{t.revisar}</Badge>}
              {dec(l.devuelto).gt(0) && <span className="ml-2 text-sm text-destructive">({l.devuelto} {t.devuelto})</span>}
            </span>
            <span className="font-medium">{formatoDolares(l.total)}</span>
          </li>
        ))}
      </ul>
      {dec(venta.descuento).gt(0) && (
        <p className="flex justify-between text-muted-foreground">
          <span>{textosVentas.pos.descuento}</span>
          <span>−{formatoDolares(venta.descuento)}</span>
        </p>
      )}
      <p className="flex justify-between text-2xl font-bold">
        <span>{textosVentas.pos.total}</span>
        <span>{formatoDolares(venta.total)}</span>
      </p>
      <ul className="grid gap-1 text-muted-foreground">
        {venta.pagos.map((p, i) => (
          <li key={i}>
            {t.pagos[p.forma] ?? p.forma}: {formatoDolares(p.monto)}
            {p.referencia && ` · ${p.referencia}`}
            {p.cambio && dec(p.cambio).gt(0) && ` · ${textosVentas.cobro.cambio} ${formatoDolares(p.cambio)}`}
          </li>
        ))}
      </ul>
      <a href={`/vender/ventas/${venta.id}/ticket?imprimir=1`} target="_blank" rel="noopener" className={buttonVariants({ variant: "outline", className: "justify-self-start" })}>
        {textosVentas.cobro.imprimir}
      </a>
      {venta.estado === "normal" && (
        <AccionesVenta
          venta={venta}
          cuentas={cuentas.map((c) => ({ id: c.id, nombre: c.nombre }))}
          esAdministradora={puede(yo, "ventas.anular")}
        />
      )}
    </div>
  );
}
