import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { clienteServidor } from "@/lib/supabase/servidor";
import { dec, formatoDolares, formatoFecha } from "@/lib/dinero";
import { textos, textosVentas } from "@/lib/textos";
import { puede, requerirPermiso } from "@/server/sesion";
import { ajustesVenta, clientesConSaldo, formasDePago } from "@/server/ventas";
import { FichaCliente } from "./ficha-cliente";

const t = textosVentas.clientes;

export default function PaginaCliente({ params }: PageProps<"/clientes/[id]">) {
  return (
    <Suspense fallback={<p className="text-lg">{textos.general.cargando}</p>}>
      <Contenido params={params} />
    </Suspense>
  );
}

async function Contenido({ params }: { params: PageProps<"/clientes/[id]">["params"] }) {
  const yo = await requerirPermiso("clientes.gestionar");
  const { id } = await params;
  const supabase = await clienteServidor();
  const [{ data: c }, lista, formas, ajustes, { data: ventas }, { data: abonos }] = await Promise.all([
    supabase.from("clientes").select("*").eq("id", id).maybeSingle(),
    clientesConSaldo(),
    formasDePago(),
    ajustesVenta(),
    supabase.from("ventas").select("id, numero, fecha, total, estado, venta_pagos(forma_pago_id, monto)").eq("cliente_id", id).order("fecha", { ascending: false }).limit(50),
    supabase.from("abonos").select("id, fecha, monto, forma_pago_id").eq("cliente_id", id).order("fecha", { ascending: false }).limit(50),
  ]);
  if (!c) notFound();
  const saldo = lista.find((x) => x.id === id)?.saldo ?? "0";

  return (
    <div className="grid max-w-2xl gap-5">
      <FichaCliente
        cliente={{
          id: c.id,
          nombre: c.nombre,
          identificacion: c.identificacion,
          telefono: c.telefono,
          correo: c.correo,
          direccion: c.direccion,
          limite: String(c.limite_credito),
          notas: c.notas,
          activo: c.activo,
        }}
        saldo={saldo}
        tienda={ajustes.tienda}
        formas={formas.filter((f) => f.id !== "fiado")}
        puedeSubirLimite={puede(yo, "clientes.fiar_sobre_limite")}
      />
      <section className="grid gap-2">
        <h2 className="text-xl font-semibold">{t.historial}</h2>
        <ul className="grid gap-1">
          {(abonos ?? []).map((a) => (
            <li key={`a${a.id}`} className="flex justify-between border-b py-2 text-green-700 dark:text-green-400">
              <span>
                {formatoDolares(String(a.monto))} · {textosVentas.ventas.pagos[a.forma_pago_id]} — {t.abonar.toLowerCase()}
              </span>
              <span>{formatoFecha(a.fecha)}</span>
            </li>
          ))}
          {(ventas ?? []).map((v) => {
            const fiado = v.venta_pagos.filter((p) => p.forma_pago_id === "fiado").reduce((s, p) => s.plus(String(p.monto)), dec(0));
            return (
              <li key={v.id}>
                <Link href={`/vender/ventas/${v.id}`} className="flex justify-between gap-2 border-b py-2 hover:bg-muted">
                  <span>
                    #{v.numero} · {formatoDolares(String(v.total))}
                    {fiado.gt(0) && <Badge variant="destructive" className="ml-2">Fiado {formatoDolares(fiado)}</Badge>}
                    {v.estado === "anulada" && <Badge variant="outline" className="ml-2">{textosVentas.ventas.anulada}</Badge>}
                  </span>
                  <span className="text-muted-foreground">{formatoFecha(v.fecha)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
