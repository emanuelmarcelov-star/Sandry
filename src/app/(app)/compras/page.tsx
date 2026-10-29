import { Suspense } from "react";
import Link from "next/link";
import { Car, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { formatoDolares, formatoFecha } from "@/lib/dinero";
import { textos, textosCompras } from "@/lib/textos";
import { requerirPermiso } from "@/server/sesion";
import { listarCompras } from "@/server/abastecimiento";

const t = textosCompras.lista;

export default function Compras() {
  return (
    <Suspense fallback={<p className="text-lg">{textos.general.cargando}</p>}>
      <Contenido />
    </Suspense>
  );
}

async function Contenido() {
  await requerirPermiso("compras.registrar");
  const compras = await listarCompras(150);
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">{t.titulo}</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/compras/viaje" className={buttonVariants({ variant: "outline" })}>
            <Car className="size-5" aria-hidden /> {textosCompras.pestanas.viaje}
          </Link>
          <Link href="/compras/nueva" className={buttonVariants()}>
            <Plus className="size-5" aria-hidden /> {textosCompras.pestanas.nueva}
          </Link>
        </div>
      </div>
      {compras.length === 0 ? (
        <p className="text-lg">{t.vacio}</p>
      ) : (
        <ul className="grid gap-2">
          {compras.map((c) => (
            <li key={c.id}>
              <Link
                href={c.viajeId ? `/compras/viaje/${c.viajeId}` : `/compras/${c.id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 hover:bg-muted"
              >
                <div className="grid gap-1">
                  <span className="text-lg font-semibold">{c.lugar || t.sinLugar}</span>
                  <span className="text-sm text-muted-foreground">
                    {formatoFecha(c.fecha)} · {t.productos(c.lineas)}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {c.estado !== "recibida" && <Badge variant="secondary">{t.estados[c.estado]}</Badge>}
                  <Badge variant={c.pago === "credito" ? "destructive" : "outline"}>{c.pago === "credito" ? t.credito : t.contado}</Badge>
                  <span className="text-lg font-bold">{formatoDolares(c.total)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
