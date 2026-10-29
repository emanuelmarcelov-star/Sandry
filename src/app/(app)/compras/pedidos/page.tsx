import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { clienteServidor } from "@/lib/supabase/servidor";
import { formatoFecha } from "@/lib/dinero";
import { textos, textosCompras } from "@/lib/textos";
import { requerirPermiso } from "@/server/sesion";

const t = textosCompras.pedidos;

export default function Pedidos() {
  return (
    <div className="grid max-w-2xl gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">{t.titulo}</h1>
        <Link href="/compras/pedidos/nuevo" className={buttonVariants()}>
          <Plus className="size-5" aria-hidden /> {t.nuevo}
        </Link>
      </div>
      <p className="text-muted-foreground">{t.ayuda}</p>
      <Suspense fallback={<p className="text-lg">{textos.general.cargando}</p>}>
        <Contenido />
      </Suspense>
    </div>
  );
}

async function Contenido() {
  await requerirPermiso("compras.registrar");
  const supabase = await clienteServidor();
  const { data } = await supabase
    .from("pedidos")
    .select("id, fecha, estado, proveedores(nombre), pedido_lineas(count)")
    .order("fecha", { ascending: false })
    .limit(100);
  const pedidos = data ?? [];
  if (!pedidos.length) return <p className="text-lg">{t.vacio}</p>;
  return (
    <ul className="grid gap-2">
      {pedidos.map((p) => (
        <li key={p.id}>
          <Link href={`/compras/pedidos/${p.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 hover:bg-muted">
            <div className="grid">
              <span className="text-lg font-semibold">{(p.proveedores as { nombre: string } | null)?.nombre}</span>
              <span className="text-sm text-muted-foreground">
                {formatoFecha(p.fecha)} · {textosCompras.lista.productos((p.pedido_lineas as unknown as { count: number }[])[0]?.count ?? 0)}
              </span>
            </div>
            <Badge variant={p.estado === "enviado" ? "default" : "outline"}>{t.estados[p.estado]}</Badge>
          </Link>
        </li>
      ))}
    </ul>
  );
}
