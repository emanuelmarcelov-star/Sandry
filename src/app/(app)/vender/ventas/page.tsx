import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { clienteServidor } from "@/lib/supabase/servidor";
import { formatoDolares, formatoFecha, formatoHora } from "@/lib/dinero";
import { textos, textosVentas } from "@/lib/textos";
import { puede, requerirUsuarioActivo } from "@/server/sesion";

const t = textosVentas.ventas;

export default function Ventas() {
  return (
    <div className="grid max-w-2xl gap-4">
      <h1 className="text-3xl font-bold">{t.titulo}</h1>
      <Suspense fallback={<p className="text-lg">{textos.general.cargando}</p>}>
        <Contenido />
      </Suspense>
    </div>
  );
}

async function Contenido() {
  const yo = await requerirUsuarioActivo();
  if (!puede(yo, "ventas.ver_propias") && !puede(yo, "ventas.ver_todas")) redirect("/?aviso=sin-permiso");
  const supabase = await clienteServidor();
  // Las reglas de la base ya limitan a la cajera a sus propias ventas.
  const { data } = await supabase
    .from("ventas")
    .select("id, numero, fecha, total, estado, clientes(nombre), venta_pagos(forma_pago_id)")
    .order("fecha", { ascending: false })
    .limit(150);
  const ventas = data ?? [];
  if (!ventas.length) return <p className="text-lg">{t.vacio}</p>;
  return (
    <ul className="grid gap-2">
      {ventas.map((v) => (
        <li key={v.id}>
          <Link href={`/vender/ventas/${v.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 hover:bg-muted">
            <div className="grid">
              <span className="font-semibold">
                #{v.numero} · {formatoFecha(v.fecha)} {formatoHora(v.fecha)}
              </span>
              <span className="text-sm text-muted-foreground">
                {[...new Set(v.venta_pagos.map((p) => t.pagos[p.forma_pago_id] ?? p.forma_pago_id))].join(" + ")}
                {(v.clientes as { nombre: string } | null)?.nombre && ` · ${(v.clientes as { nombre: string }).nombre}`}
              </span>
            </div>
            <span className="flex items-center gap-2">
              {v.estado === "anulada" && <Badge variant="destructive">{t.anulada}</Badge>}
              <span className={v.estado === "anulada" ? "text-lg font-bold line-through" : "text-lg font-bold"}>{formatoDolares(v.total)}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
