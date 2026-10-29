import { Suspense } from "react";
import { notFound } from "next/navigation";
import { dec, formatoDolares, formatoFecha } from "@/lib/dinero";
import { porcentajeGastos } from "@/lib/compras";
import { textos, textosCompras } from "@/lib/textos";
import { puede, requerirPermiso } from "@/server/sesion";
import { obtenerViaje, productosParaCompra } from "@/server/abastecimiento";
import { RecibirViaje } from "./recibir-viaje";

const t = textosCompras.viaje;

export default function PaginaRecibirViaje({ params }: PageProps<"/compras/viaje/[id]">) {
  return (
    <Suspense fallback={<p className="text-lg">{textos.general.cargando}</p>}>
      <Contenido params={params} />
    </Suspense>
  );
}

async function Contenido({ params }: { params: PageProps<"/compras/viaje/[id]">["params"] }) {
  const yo = await requerirPermiso("compras.registrar");
  const { id } = await params;
  const viaje = await obtenerViaje(id);
  if (!viaje) notFound();
  const comprado = viaje.compras.reduce((s, c) => s.plus(c.total), dec(0));
  const gastos = viaje.gastos.reduce((s, g) => s.plus(g.monto), dec(0));
  const porcentaje = porcentajeGastos(comprado, gastos);
  const sinDetalle = viaje.compras.filter((c) => c.estado === "por_recibir" && c.lineas.length === 0);
  const productos = sinDetalle.length ? await productosParaCompra(yo) : [];

  return (
    <div className="grid max-w-2xl gap-5">
      <div>
        <h1 className="text-3xl font-bold">{viaje.estado === "en_curso" ? t.recibirTitulo : t.resumen}</h1>
        <p className="text-muted-foreground">{formatoFecha(viaje.inicio)}</p>
      </div>

      <section className="grid gap-2 rounded-xl border p-4">
        <h2 className="text-xl font-semibold">{t.porLugar}</h2>
        <ul className="grid gap-1">
          {viaje.compras.map((c) => (
            <li key={c.id} className="flex justify-between gap-2">
              <span>{c.lugar || textosCompras.lista.sinLugar}</span>
              <span className="font-medium">{formatoDolares(c.total)}</span>
            </li>
          ))}
          {viaje.gastos.map((g) => (
            <li key={g.id} className="flex justify-between gap-2 text-muted-foreground">
              <span>
                {g.categoria}
                {g.descripcion && ` · ${g.descripcion}`}
              </span>
              <span>{formatoDolares(g.monto)}</span>
            </li>
          ))}
        </ul>
        <div className="flex justify-between border-t pt-2 text-lg font-semibold">
          <span>{t.totalComprado}</span>
          <span>{formatoDolares(comprado)}</span>
        </div>
        <div className="flex justify-between">
          <span>{t.totalGastos}</span>
          <span>{formatoDolares(gastos)}</span>
        </div>
        {porcentaje && gastos.gt(0) && <p className="text-muted-foreground">{t.porcentaje(porcentaje.toString())}</p>}
      </section>

      {viaje.estado === "en_curso" ? (
        <RecibirViaje
          viajeId={viaje.id}
          compras={viaje.compras}
          productos={productos}
          puedeCrearProducto={puede(yo, "productos.editar")}
        />
      ) : (
        <p className="text-lg font-medium">{t.yaRecibido}</p>
      )}
    </div>
  );
}
