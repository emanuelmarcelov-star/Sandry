import { Suspense } from "react";
import Link from "next/link";
import { CalendarClock, PackageSearch, ShoppingCart } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { clienteServidor } from "@/lib/supabase/servidor";
import { cantidadConUnidad, type UnidadBase } from "@/lib/catalogo";
import { formatoFecha, hoyEcuador } from "@/lib/dinero";
import { textos, textosInventario } from "@/lib/textos";
import { puede, requerirPermiso } from "@/server/sesion";
import { listaSugerida, type Sugerido } from "@/server/abastecimiento";
import { cn } from "cn";

const t = textosInventario.alertas;

export default function Alertas() {
  return (
    <div className="grid max-w-3xl gap-6">
      <h1 className="text-3xl font-bold">{t.titulo}</h1>
      <Suspense fallback={<p className="text-lg">{textos.general.cargando}</p>}>
        <Contenido />
      </Suspense>
    </div>
  );
}

function diasEntre(desde: string, hasta: string) {
  return Math.round((Date.parse(`${hasta}T12:00:00Z`) - Date.parse(`${desde}T12:00:00Z`)) / 86_400_000);
}

async function Contenido() {
  const yo = await requerirPermiso("productos.ver");
  const supabase = await clienteServidor();
  const { data: ajustes } = await supabase.from("ajustes").select("dias_aviso_caducidad, dias_sin_movimiento").maybeSingle();
  const diasCaducidad = ajustes?.dias_aviso_caducidad ?? 7;
  const diasSinMovimiento = ajustes?.dias_sin_movimiento ?? 30;
  const hoy = hoyEcuador();
  const limite = new Date(Date.parse(`${hoy}T12:00:00Z`) + diasCaducidad * 86_400_000).toISOString().slice(0, 10);

  const [{ data: lotes }, sugerida, { data: quietos }] = await Promise.all([
    supabase
      .from("lotes")
      .select("id, vence, cantidad, productos!inner(id, nombre, unidad_base, activo)")
      .gt("cantidad", 0)
      .lte("vence", limite)
      .eq("productos.activo", true)
      .order("vence"),
    listaSugerida(),
    supabase.rpc("productos_sin_movimiento", { p_dias: diasSinMovimiento }),
  ]);

  const grupos = new Map<string, { proveedorId: string | null; nombre: string; items: Sugerido[] }>();
  for (const s of sugerida) {
    const clave = s.proveedorId ?? "";
    if (!grupos.has(clave)) grupos.set(clave, { proveedorId: s.proveedorId, nombre: s.proveedor || t.sinLugar, items: [] });
    grupos.get(clave)!.items.push(s);
  }
  const compras = puede(yo, "compras.registrar");

  return (
    <>
      <section className="grid gap-3">
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <CalendarClock className="size-6" aria-hidden /> {t.caducan(diasCaducidad)}
        </h2>
        {!lotes?.length ? (
          <p className="text-muted-foreground">{t.sinCaducan}</p>
        ) : (
          <>
            <p className="text-muted-foreground">{t.venderPrimero}</p>
            <ul className="grid gap-2">
              {lotes.map((l) => {
                const p = l.productos as unknown as { id: string; nombre: string; unidad_base: UnidadBase };
                const dias = diasEntre(hoy, l.vence);
                return (
                  <li key={l.id}>
                    <Link
                      href={`/catalogo/${p.id}`}
                      className={cn("flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 hover:bg-muted", dias < 0 && "border-destructive/60")}
                    >
                      <span className="font-semibold">{p.nombre}</span>
                      <span className={cn("text-sm", dias <= 1 && "font-semibold text-destructive")}>
                        {cantidadConUnidad(String(l.cantidad), p.unidad_base)} · {dias < 0 ? t.vencido : t.venceEn(dias)} ({formatoFecha(`${l.vence}T12:00:00`)})
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      <section className="grid gap-3">
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <ShoppingCart className="size-6" aria-hidden /> {t.pocoStock}
        </h2>
        <p className="text-muted-foreground">{t.ayudaPocoStock}</p>
        {!sugerida.length ? (
          <p className="text-muted-foreground">{t.sinPocoStock}</p>
        ) : (
          <>
            {compras && (
              <Link href="/compras/viaje" className={buttonVariants({ variant: "outline", className: "justify-self-start" })}>
                {t.iniciarViaje}
              </Link>
            )}
            {[...grupos.values()].map((g) => (
              <div key={g.nombre} className="grid gap-2 rounded-xl border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-lg font-semibold">{g.nombre}</h3>
                  {compras && g.proveedorId && (
                    <Link href={`/compras/pedidos/nuevo?proveedor=${g.proveedorId}`} className={buttonVariants({ size: "sm" })}>
                      {t.hacerPedido}
                    </Link>
                  )}
                </div>
                <ul className="grid gap-1">
                  {g.items.map((s) => {
                    const u = s.unidadBase as UnidadBase;
                    return (
                      <li key={s.productoId} className="flex flex-wrap justify-between gap-2">
                        <Link href={`/catalogo/${s.productoId}`} className="underline-offset-2 hover:underline">
                          {s.nombre}
                        </Link>
                        <span className="text-sm">
                          {t.hay} {cantidadConUnidad(s.stock, u)} · <strong>{t.comprar} {cantidadConUnidad(s.sugerido, u)}</strong>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </>
        )}
      </section>

      <section className="grid gap-3">
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <PackageSearch className="size-6" aria-hidden /> {t.sinMovimiento(diasSinMovimiento)}
        </h2>
        {!quietos?.length ? (
          <p className="text-muted-foreground">{t.sinSinMovimiento}</p>
        ) : (
          <ul className="grid gap-1">
            {quietos.map((q) => (
              <li key={q.producto_id} className="flex flex-wrap justify-between gap-2">
                <Link href={`/catalogo/${q.producto_id}`} className="hover:underline">
                  {q.nombre}
                </Link>
                <span className="text-sm text-muted-foreground">
                  {cantidadConUnidad(String(q.stock), q.unidad_base as UnidadBase)} · {t.ultimo}: {q.ultimo ? formatoFecha(q.ultimo) : t.nunca}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
