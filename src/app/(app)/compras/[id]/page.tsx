import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { cantidadConUnidad, type UnidadBase } from "@/lib/catalogo";
import { dec, formatoDolares, formatoFecha, formatoHora } from "@/lib/dinero";
import { textos, textosCompras } from "@/lib/textos";
import { requerirPermiso } from "@/server/sesion";
import { obtenerCompra } from "@/server/abastecimiento";

const t = textosCompras;

export default function PaginaCompra({ params }: PageProps<"/compras/[id]">) {
  return (
    <Suspense fallback={<p className="text-lg">{textos.general.cargando}</p>}>
      <Contenido params={params} />
    </Suspense>
  );
}

async function Contenido({ params }: { params: PageProps<"/compras/[id]">["params"] }) {
  await requerirPermiso("compras.registrar");
  const { id } = await params;
  const compra = await obtenerCompra(id);
  if (!compra) notFound();
  return (
    <div className="grid max-w-2xl gap-5">
      <div className="grid gap-1">
        <h1 className="text-3xl font-bold">{compra.lugar || t.lista.sinLugar}</h1>
        <p className="text-muted-foreground">
          {formatoFecha(compra.fecha)} {formatoHora(compra.fecha)}
        </p>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{t.lista.estados[compra.estado]}</Badge>
          <Badge variant={compra.pago === "credito" ? "destructive" : "outline"}>
            {compra.pago === "credito" ? t.lista.credito : `${t.lista.contado} · ${compra.cuenta}`}
          </Badge>
          {compra.conFactura && <Badge variant="secondary">{t.formulario.conFactura} {compra.numeroFactura}</Badge>}
        </div>
      </div>
      <ul className="grid gap-2">
        {compra.lineas.map((l) => {
          const unidad = l.unidadBase as UnidadBase;
          return (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3">
              <div className="grid">
                <span className="font-semibold">{l.producto}</span>
                <span className="text-sm text-muted-foreground">
                  {l.cantidad} × {l.presentacion}
                  {dec(l.bonificacion).gt(0) && ` + ${l.bonificacion} ${t.formulario.bonificacion.toLowerCase()}`}
                  {dec(l.danados).gt(0) && ` · ${cantidadConUnidad(l.danados, unidad)} dañadas`}
                  {l.vence && ` · ${t.formulario.vence.toLowerCase()} ${formatoFecha(l.vence + "T12:00:00")}`}
                </span>
              </div>
              <span className="font-bold">{formatoDolares(l.costoTotal)}</span>
            </li>
          );
        })}
      </ul>
      {compra.nota && <p className="text-muted-foreground">{compra.nota}</p>}
      <p className="text-right text-2xl font-bold">
        {t.formulario.total}: {formatoDolares(compra.total)}
      </p>
    </div>
  );
}
