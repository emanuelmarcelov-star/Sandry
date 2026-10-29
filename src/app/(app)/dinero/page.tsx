import { Suspense } from "react";
import Link from "next/link";
import { clienteServidor } from "@/lib/supabase/servidor";
import { formatoDolares, formatoFecha, formatoHora } from "@/lib/dinero";
import { textos, textosDinero } from "@/lib/textos";
import { puede, requerirPermiso } from "@/server/sesion";
import { AccionesDinero } from "./acciones-dinero";
import { cn } from "cn";

const t = textosDinero;

export default function Dinero({ searchParams }: PageProps<"/dinero">) {
  return (
    <div className="grid max-w-3xl gap-5">
      <h1 className="text-3xl font-bold">{t.titulo}</h1>
      <p className="text-muted-foreground">{t.ayuda}</p>
      <Suspense fallback={<p className="text-lg">{textos.general.cargando}</p>}>
        <Contenido searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Contenido({ searchParams }: { searchParams: PageProps<"/dinero">["searchParams"] }) {
  const yo = await requerirPermiso("dinero.ver");
  const { cuenta } = (await searchParams) as Record<string, string | undefined>;
  const supabase = await clienteServidor();
  let consulta = supabase
    .from("movimientos_dinero")
    .select("id, fecha, monto, motivo, descripcion, cuenta_id, cuentas_dinero(nombre)")
    .order("fecha", { ascending: false })
    .limit(100);
  if (cuenta) consulta = consulta.eq("cuenta_id", cuenta);
  const [{ data: saldos }, { data: movimientos }] = await Promise.all([supabase.rpc("saldos_cuentas"), consulta]);
  const cuentas = saldos ?? [];

  return (
    <>
      <ul className="grid gap-3 sm:grid-cols-2">
        {cuentas.map((c) => (
          <li key={c.id}>
            <Link
              href={cuenta === c.id ? "/dinero" : `/dinero?cuenta=${c.id}`}
              className={cn("grid gap-1 rounded-xl border p-4 hover:bg-muted", cuenta === c.id && "border-primary", !c.activa && "opacity-60")}
            >
              <span className="text-base text-muted-foreground">{c.nombre}</span>
              <span className={cn("text-3xl font-bold", Number(c.saldo) < 0 && c.tipo !== "personal" && "text-destructive")}>
                {formatoDolares(c.saldo)}
              </span>
              {c.tipo === "personal" && <span className="text-sm text-muted-foreground">{t.personal}</span>}
            </Link>
          </li>
        ))}
      </ul>

      {puede(yo, "dinero.mover") && (
        <AccionesDinero cuentas={cuentas.map((c) => ({ id: c.id, nombre: c.nombre, tipo: c.tipo, activa: c.activa, saldo: String(c.saldo) }))} />
      )}

      <section className="grid gap-2">
        <h2 className="text-xl font-semibold">
          {t.movimientos}
          {cuenta && ` · ${cuentas.find((c) => c.id === cuenta)?.nombre ?? ""}`}
        </h2>
        {!movimientos?.length ? (
          <p className="text-muted-foreground">{t.sinMovimientos}</p>
        ) : (
          <ul className="grid gap-1">
            {movimientos.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-2">
                <div className="grid">
                  <span className="font-medium">{m.descripcion || t.motivos[m.motivo]}</span>
                  <span className="text-sm text-muted-foreground">
                    {formatoFecha(m.fecha)} {formatoHora(m.fecha)} · {(m.cuentas_dinero as { nombre: string } | null)?.nombre} · {t.motivos[m.motivo]}
                  </span>
                </div>
                <span className={cn("text-lg font-semibold", Number(m.monto) < 0 ? "text-destructive" : "text-green-700 dark:text-green-400")}>
                  {Number(m.monto) > 0 && "+"}
                  {formatoDolares(m.monto)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
