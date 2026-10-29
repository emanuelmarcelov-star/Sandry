import { Suspense } from "react";
import { clienteServidor } from "@/lib/supabase/servidor";
import { formatoDolares, formatoFecha, hoyEcuador } from "@/lib/dinero";
import { textos, textosCompras } from "@/lib/textos";
import { requerirPermiso } from "@/server/sesion";
import { listarCuentas } from "@/server/abastecimiento";
import { BotonPagar } from "./boton-pagar";

const t = textosCompras.porPagar;

export default function PorPagar() {
  return (
    <div className="grid max-w-2xl gap-5">
      <h1 className="text-3xl font-bold">{t.titulo}</h1>
      <Suspense fallback={<p className="text-lg">{textos.general.cargando}</p>}>
        <Contenido />
      </Suspense>
    </div>
  );
}

async function Contenido() {
  await requerirPermiso("compras.registrar");
  const supabase = await clienteServidor();
  const [{ data }, cuentas] = await Promise.all([supabase.rpc("cuentas_por_pagar"), listarCuentas()]);
  const deudas = data ?? [];
  const hoy = hoyEcuador();
  if (!deudas.length) return <p className="text-lg">{t.vacio}</p>;
  const total = deudas.reduce((s, d) => s + Number(d.saldo), 0);
  return (
    <>
      <p className="text-xl">
        {t.debe}: <strong>{formatoDolares(total)}</strong>
      </p>
      <ul className="grid gap-2">
        {deudas.map((d) => {
          const vencida = d.vence !== null && d.vence < hoy;
          return (
            <li key={d.compra_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
              <div className="grid gap-1">
                <span className="text-lg font-semibold">{d.proveedor || textosCompras.lista.sinLugar}</span>
                <span className="text-sm text-muted-foreground">
                  {formatoFecha(d.fecha)} · {formatoDolares(d.total)}
                  {d.numero_factura && ` · ${d.numero_factura}`}
                </span>
                {d.vence && (
                  <span className={vencida ? "font-semibold text-destructive" : "text-sm"}>
                    {vencida ? t.vencida : t.vence}: {formatoFecha(`${d.vence}T12:00:00`)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xl font-bold">{formatoDolares(d.saldo)}</span>
                <BotonPagar compraId={d.compra_id} saldo={String(d.saldo)} proveedor={d.proveedor} cuentas={cuentas} />
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
