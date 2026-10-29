import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { clienteServidor } from "@/lib/supabase/servidor";
import { formatoFecha } from "@/lib/dinero";
import { textos, textosCompras, textosInventario } from "@/lib/textos";
import { puede, requerirUsuarioActivo } from "@/server/sesion";
import { listarCategorias } from "@/server/catalogo";
import { NuevoConteo } from "./nuevo-conteo";

const t = textosInventario.conteos;

export default function Conteos() {
  return (
    <div className="grid max-w-2xl gap-5">
      <h1 className="text-3xl font-bold">{t.titulo}</h1>
      <p className="text-muted-foreground">{t.ayuda}</p>
      <Suspense fallback={<p className="text-lg">{textos.general.cargando}</p>}>
        <Contenido />
      </Suspense>
    </div>
  );
}

async function Contenido() {
  const yo = await requerirUsuarioActivo();
  if (!puede(yo, "inventario.contar") && !puede(yo, "inventario.aprobar")) redirect("/?aviso=sin-permiso");
  const supabase = await clienteServidor();
  const [{ data: conteos }, categorias] = await Promise.all([
    supabase.from("conteos").select("id, nombre, estado, creado_en, conteo_lineas(count)").order("creado_en", { ascending: false }).limit(50),
    listarCategorias(),
  ]);
  return (
    <>
      {puede(yo, "inventario.contar") && <NuevoConteo categorias={categorias.filter((c) => c.activa).map((c) => ({ id: c.id, nombre: c.nombre }))} />}
      {!conteos?.length ? (
        <p className="text-lg">{t.vacio}</p>
      ) : (
        <ul className="grid gap-2">
          {conteos.map((c) => (
            <li key={c.id}>
              <Link href={`/inventario/conteos/${c.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-4 hover:bg-muted">
                <div className="grid">
                  <span className="text-lg font-semibold">{c.nombre}</span>
                  <span className="text-sm text-muted-foreground">
                    {formatoFecha(c.creado_en)} · {textosCompras.lista.productos((c.conteo_lineas as unknown as { count: number }[])[0]?.count ?? 0)}
                  </span>
                </div>
                <Badge variant={c.estado === "por_aprobar" ? "default" : "outline"}>{t.estados[c.estado]}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
