import { Suspense } from "react";
import Link from "next/link";
import { ImageOff, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { formatoDolares } from "@/lib/dinero";
import { cantidadConUnidad } from "@/lib/catalogo";
import { textosCatalogo } from "@/lib/textos";
import { puede, requerirPermiso } from "@/server/sesion";
import { buscarProductos, categoriasEnArbol, listarCategorias, urlFotoProducto } from "@/server/catalogo";
import { FiltrosCatalogo } from "./filtros";

const t = textosCatalogo.lista;

export default function Catalogo({ searchParams }: PageProps<"/catalogo">) {
  return (
    <Suspense fallback={<p className="text-lg">Cargando…</p>}>
      <Contenido searchParams={searchParams} />
    </Suspense>
  );
}

async function Contenido({ searchParams }: { searchParams: PageProps<"/catalogo">["searchParams"] }) {
  const yo = await requerirPermiso("productos.ver");
  const { q = "", cat = "", inactivos } = (await searchParams) as Record<string, string | undefined>;
  const [productos, categorias] = await Promise.all([
    buscarProductos(yo, { texto: q, categoriaId: cat, incluirInactivos: inactivos === "1", limite: 300 }),
    listarCategorias(),
  ]);
  const arbol = categoriasEnArbol(categorias);
  const nombreCategoria = new Map(arbol.map((c) => [c.id, c.ruta]));
  const editar = puede(yo, "productos.editar");

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">{t.titulo}</h1>
        {editar && (
          <Link href="/catalogo/nuevo" className={buttonVariants()}>
            <Plus className="size-5" aria-hidden /> {t.nuevo}
          </Link>
        )}
      </div>

      <FiltrosCatalogo
        categorias={arbol.map((c) => ({ id: c.id, nombre: c.ruta, nivel: c.nivel }))}
        valores={{ q, cat, inactivos: inactivos === "1" }}
      />

      <p className="text-muted-foreground">{t.resultados(productos.length)}</p>

      {productos.length === 0 ? (
        <p className="text-lg">{q || cat ? t.ninguno : t.vacio}</p>
      ) : (
        <ul className="grid gap-2">
          {productos.map((p) => {
            const base = p.presentaciones.find((x) => x.esBase);
            const foto = urlFotoProducto(p.fotoRuta);
            const stockBajo = Number(p.stock) < Number(p.stockMinimo) && Number(p.stockMinimo) > 0;
            const sinCodigo = !p.presentaciones.some((x) => x.codigos.length) && !p.plu;
            const contenido = (
              <>
                {foto ? (
                  // eslint-disable-next-line @next/next/no-img-element -- fotos subidas por la tienda
                  <img src={foto} alt="" className="size-14 shrink-0 rounded-lg bg-white object-contain" loading="lazy" />
                ) : (
                  <span className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <ImageOff className="size-6 text-muted-foreground" aria-hidden />
                  </span>
                )}
                <span className="grid min-w-0 flex-1 gap-1">
                  <span className="truncate text-lg font-semibold">
                    {p.nombre}
                    {p.plu && <span className="ml-2 font-mono text-sm text-muted-foreground">#{p.plu}</span>}
                  </span>
                  <span className="truncate text-sm text-muted-foreground">
                    {[p.marca, p.categoriaId && nombreCategoria.get(p.categoriaId)].filter(Boolean).join(" · ")}
                  </span>
                  <span className="flex flex-wrap gap-1">
                    {!p.activo && <Badge variant="secondary">{t.desactivado}</Badge>}
                    {stockBajo && <Badge variant="destructive">{t.stockBajo}</Badge>}
                    {!base?.precioVenta && <Badge variant="outline">{t.sinPrecio}</Badge>}
                    {sinCodigo && <Badge variant="outline">{t.sinCodigo}</Badge>}
                  </span>
                </span>
                <span className="grid shrink-0 justify-items-end gap-1 text-right">
                  <span className="text-lg font-bold">{base?.precioVenta ? formatoDolares(base.precioVenta) : "—"}</span>
                  <span className={stockBajo ? "text-sm font-medium text-destructive" : "text-sm text-muted-foreground"}>
                    {cantidadConUnidad(p.stock, p.unidadBase)}
                  </span>
                </span>
              </>
            );
            return (
              <li key={p.id}>
                {editar ? (
                  <Link href={`/catalogo/${p.id}`} className="flex items-center gap-3 rounded-xl border p-3 hover:bg-muted/50">
                    {contenido}
                  </Link>
                ) : (
                  <div className="flex items-center gap-3 rounded-xl border p-3">{contenido}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
