import { Suspense } from "react";
import Link from "next/link";
import { FileSpreadsheet } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Aviso, Selector } from "@/components/formulario";
import { GraficoBarras } from "@/components/reportes/grafico-barras";
import { formatoDolares, formatoFecha, hoyEcuador } from "@/lib/dinero";
import { rangoPeriodo, rankings, type Periodo } from "@/lib/reportes";
import { textos, textosReportes, textosVentas } from "@/lib/textos";
import { requerirPermiso } from "@/server/sesion";
import { obtenerReporte, trabajadoras, type Reporte } from "@/server/reportes";
import { BotonImprimir, Conciliacion } from "./piezas";
import { cn } from "cn";

const t = textosReportes;

export default function Reportes({ searchParams }: PageProps<"/reportes">) {
  return (
    <div className="grid gap-6">
      <h1 className="text-3xl font-bold print:hidden">{t.titulo}</h1>
      <Suspense fallback={<p className="text-lg">{textos.general.cargando}</p>}>
        <Contenido searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const fechaValida = (x?: string) => (x && /^\d{4}-\d{2}-\d{2}$/.test(x) ? x : undefined);

async function Contenido({ searchParams }: { searchParams: PageProps<"/reportes">["searchParams"] }) {
  await requerirPermiso("reportes.ver");
  const q = (await searchParams) as Record<string, string | undefined>;
  const hoy = hoyEcuador();
  const periodo = (q.periodo && q.periodo in t.periodos ? q.periodo : q.desde ? null : "hoy") as Periodo | null;
  const rango = periodo ? rangoPeriodo(periodo, hoy) : { desde: fechaValida(q.desde) ?? hoy, hasta: fechaValida(q.hasta) ?? hoy };
  const usuario = q.usuario ?? "";
  const [{ reporte, error }, personas] = await Promise.all([obtenerReporte(rango.desde, rango.hasta, usuario), trabajadoras()]);
  const extra = usuario ? `&usuario=${usuario}` : "";

  return (
    <>
      <div className="flex flex-wrap gap-2 print:hidden">
        {Object.entries(t.periodos).map(([clave, nombre]) => (
          <Link
            key={clave}
            href={`/reportes?periodo=${clave}${extra}`}
            className={buttonVariants({ variant: periodo === clave ? "default" : "outline", size: "sm" })}
          >
            {nombre}
          </Link>
        ))}
      </div>
      <form className="flex flex-wrap items-end gap-2 print:hidden" action="/reportes">
        <label className="grid gap-1 text-sm">
          {t.desde}
          <Input type="date" name="desde" defaultValue={rango.desde} className="w-40" />
        </label>
        <label className="grid gap-1 text-sm">
          {t.hasta}
          <Input type="date" name="hasta" defaultValue={rango.hasta} className="w-40" />
        </label>
        <label className="grid gap-1 text-sm">
          {t.trabajadora}
          <Selector name="usuario" defaultValue={usuario} className="w-48">
            <option value="">{t.todas}</option>
            {personas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </Selector>
        </label>
        <button type="submit" className={buttonVariants()}>
          {t.ver}
        </button>
        <a href={`/reportes/excel?desde=${rango.desde}&hasta=${rango.hasta}${extra}`} download className={buttonVariants({ variant: "outline" })}>
          <FileSpreadsheet className="size-5" aria-hidden /> {t.excel}
        </a>
        <BotonImprimir />
      </form>

      {error && <Aviso tipo="error">{error}</Aviso>}
      {reporte && <Cuerpo r={reporte} desde={rango.desde} hasta={rango.hasta} />}
    </>
  );
}

function Tile({ titulo, valor, ayuda, destacado, negativo }: { titulo: string; valor: string; ayuda?: string; destacado?: boolean; negativo?: boolean }) {
  return (
    <div className={cn("grid gap-1 rounded-xl border p-4", destacado && "border-primary")}>
      <span className="text-sm text-muted-foreground">{titulo}</span>
      <span className={cn("text-2xl font-bold", destacado && "text-3xl", negativo && "text-destructive")}>{valor}</span>
      {ayuda && <span className="text-xs text-muted-foreground">{ayuda}</span>}
    </div>
  );
}

function Tabla({ titulo, filas, cabeza }: { titulo: string; filas: (string | number)[][]; cabeza?: string[] }) {
  if (!filas.length) return null;
  return (
    <section className="grid gap-2">
      <h2 className="text-lg font-semibold">{titulo}</h2>
      <table className="w-full text-base">
        {cabeza && (
          <thead>
            <tr className="text-left text-sm text-muted-foreground">
              {cabeza.map((c, i) => (
                <th key={i} className={cn("py-1 font-normal", i > 0 && "text-right")}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {filas.map((f, i) => (
            <tr key={i} className="border-b last:border-0">
              {f.map((c, j) => (
                <td key={j} className={cn("py-1.5", j > 0 && "text-right tabular-nums")}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Cuerpo({ r, desde, hasta }: { r: Reporte; desde: string; hasta: string }) {
  const $ = (v: number | string | null | undefined) => formatoDolares(Number(v ?? 0));
  const top = rankings(r.productos);
  const pctTransporte = Number(r.compras) > 0 ? ((Number(r.gastos_transporte) / Number(r.compras)) * 100).toFixed(1) : null;
  const titulo = desde === hasta ? formatoFecha(`${desde}T12:00:00`) : `${formatoFecha(`${desde}T12:00:00`)} – ${formatoFecha(`${hasta}T12:00:00`)}`;

  return (
    <div className="zona-impresion grid gap-6">
      <p className="text-lg font-medium">{titulo}</p>
      {!r.cantidad_ventas && <p className="text-muted-foreground">{t.sinDatos}</p>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile titulo={t.ventas} valor={$(r.ventas)} ayuda={`${t.numeroVentas}: ${r.cantidad_ventas} · ${t.ticket}: ${$(r.ticket_promedio)}`} />
        <Tile titulo={t.gananciaBruta} valor={$(r.ganancia_bruta)} ayuda={r.margen !== null ? `${t.margen} ${r.margen} %` : undefined} />
        <Tile titulo={t.gastos} valor={$(r.gastos)} ayuda={`${t.perdidas}: ${$(r.perdidas)}`} />
        <Tile titulo={t.gananciaNeta} valor={$(r.ganancia_neta)} ayuda={t.ayudaNeta} destacado negativo={Number(r.ganancia_neta) < 0} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <GraficoBarras
          titulo={t.porDia}
          etiqueta={t.ventas}
          datos={r.por_dia.map((d) => ({ nombre: formatoFecha(`${d.dia}T12:00:00`).slice(0, 5), valor: Number(d.ventas) }))}
        />
        <GraficoBarras titulo={t.porHora} etiqueta={t.ventas} datos={r.por_hora.map((h) => ({ nombre: `${h.hora}h`, valor: Number(h.total) }))} />
        {r.por_dia_semana.length > 1 && (
          <GraficoBarras
            titulo={t.porDiaSemana}
            etiqueta={t.ventas}
            datos={r.por_dia_semana.map((d) => ({ nombre: t.diasSemana[d.dia], valor: Number(d.total) }))}
          />
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Tabla
          titulo={t.porCategoria}
          cabeza={["", t.ventas, t.gananciaBruta]}
          filas={r.por_categoria.map((c) => [c.categoria, $(c.ventas), $(c.ganancia)]).concat(Number(r.varios) > 0 ? [[t.varios, $(r.varios), "—"]] : [])}
        />
        <Tabla
          titulo={t.porForma}
          filas={Object.entries(r.por_forma).map(([f, v]) => [textosVentas.ventas.pagos[f] ?? f, $(v)])}
        />
        <Tabla titulo={t.masVendidos} cabeza={["", "Cant.", t.ventas]} filas={top.masVendidos.map((p) => [p.producto, p.cantidad, $(p.ventas)])} />
        <Tabla titulo={t.masRentables} cabeza={["", t.gananciaBruta]} filas={top.masRentables.map((p) => [p.producto, $(p.ganancia)])} />
        <Tabla titulo={t.menosRentables} cabeza={["", t.gananciaBruta]} filas={top.menosRentables.map((p) => [p.producto, $(p.ganancia)])} />
        <Tabla titulo={t.aPerdida} cabeza={["", t.gananciaBruta]} filas={top.aPerdida.map((p) => [p.producto, $(p.ganancia)])} />
        <Tabla titulo={t.porTrabajadora} cabeza={["", t.numeroVentas, t.ventas]} filas={r.por_trabajadora.map((p) => [p.nombre, p.ventas, $(p.total)])} />
        <Tabla
          titulo={t.gastosPorGrupo}
          filas={[
            ...Object.entries(r.gastos_por_grupo).map(([g, v]) => [g, $(v)]),
            ...Object.entries(r.perdidas_por_tipo).map(([k, v]) => [t.perdidasTipo[k] ?? k, $(v)]),
            ...(Number(r.gastos_personales) > 0 ? [[t.gastosPersonales, $(r.gastos_personales)]] : []),
          ]}
        />
        <Tabla
          titulo={t.flujo}
          cabeza={["", t.entra, t.sale]}
          filas={r.flujo.map((f) => [t.motivos[f.motivo] ?? f.motivo, f.entra ? $(f.entra) : "", f.sale ? $(f.sale) : ""])}
        />
        <Tabla titulo={t.flujoPorCuenta} cabeza={["", t.entra, t.sale, t.saldo]} filas={r.flujo_por_cuenta.map((c) => [c.cuenta, $(c.entra), $(c.sale), $(c.saldo)])} />
        <Tabla titulo={t.comprasPorLugar} cabeza={["", "Nº", t.compras]} filas={r.compras_por_lugar.map((c) => [c.lugar, c.compras, $(c.total)])} />
        <section className="grid gap-2">
          <h2 className="text-lg font-semibold">{t.inventario}</h2>
          <p className="flex justify-between">
            <span>{t.inventarioCosto}</span>
            <span className="font-semibold">{$(r.inventario.costo)}</span>
          </p>
          <p className="flex justify-between">
            <span>{t.inventarioVenta}</span>
            <span className="font-semibold">{$(r.inventario.venta)}</span>
          </p>
          <p className="flex justify-between">
            <span>{t.fiados}</span>
            <span className="font-semibold">{$(r.fiados)}</span>
          </p>
          <p className="flex justify-between">
            <span>{t.porPagar}</span>
            <span className="font-semibold">{$(r.por_pagar)}</span>
          </p>
          {pctTransporte && <p className="text-muted-foreground">{t.costoAbastecimiento(pctTransporte)}</p>}
        </section>
      </div>

      {r.conciliacion.length > 0 && <Conciliacion filas={r.conciliacion} />}
    </div>
  );
}
