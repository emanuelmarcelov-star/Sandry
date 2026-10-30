import Link from "next/link";
import { CircleAlert } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { formatoDolares } from "@/lib/dinero";
import { variacion } from "@/lib/reportes";
import { textosPanel } from "@/lib/textos";
import type { Panel } from "@/server/reportes";
import { cn } from "cn";

const t = textosPanel;

const ENLACES: Record<string, string> = {
  poco_stock: "/inventario",
  por_caducar: "/inventario",
  fiados: "/clientes",
  por_pagar_vencido: "/compras/por-pagar",
  pendientes: "/catalogo",
  revisar: "/vender/ventas",
  gastos_fijos: "/gastos",
};

/** Panel de la administradora: ventas y ganancia de hoy, efectivo, cuentas y lo que hay que revisar. */
export function PanelInicio({ p }: { p: Panel }) {
  const ventas = Number(p.hoy.ventas);
  const cambio = variacion(ventas, Number(p.semana_pasada.ventas));
  const alertas = Object.entries(p.alertas).filter(([, v]) => Number(v) > 0);

  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <div className="col-span-2 grid gap-1 rounded-xl border border-primary p-4 md:col-span-1">
          <span className="text-sm text-muted-foreground">{t.ventasHoy}</span>
          <span className="text-4xl font-bold" data-testid="ventas-hoy">
            {formatoDolares(ventas)}
          </span>
          <span className="text-sm text-muted-foreground">
            {t.numeroVentas(Number(p.hoy.cantidad_ventas))}
            {p.hoy.ticket_promedio !== null && ` · ${formatoDolares(Number(p.hoy.ticket_promedio))} ${t.ticket}`}
          </span>
          {cambio !== null && (
            <span className={cn("text-sm", cambio >= 0 ? "text-green-700 dark:text-green-400" : "text-destructive")}>{t.vsSemana(String(Math.abs(cambio)), cambio >= 0)}</span>
          )}
        </div>
        <div className="grid gap-1 rounded-xl border p-4">
          <span className="text-sm text-muted-foreground">{t.gananciaHoy}</span>
          <span className="text-2xl font-bold">{formatoDolares(Number(p.hoy.ganancia_bruta))}</span>
        </div>
        <div className="grid gap-1 rounded-xl border p-4">
          <span className="text-sm text-muted-foreground">{t.efectivo}</span>
          <span className="text-2xl font-bold">{p.caja_abierta ? formatoDolares(Number(p.efectivo_esperado)) : t.cajaCerrada}</span>
        </div>
      </div>

      <section className="grid gap-2">
        <h2 className="text-lg font-semibold">{t.cuentas}</h2>
        <ul className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {p.saldos.map((s) => (
            <li key={s.nombre} className="rounded-lg bg-muted p-3">
              <span className="block text-sm text-muted-foreground">{s.nombre}</span>
              <span className="text-lg font-semibold">{formatoDolares(Number(s.saldo))}</span>
            </li>
          ))}
        </ul>
      </section>

      {alertas.length > 0 && (
        <section className="grid gap-2">
          <h2 className="text-lg font-semibold">{t.alertas}</h2>
          <ul className="grid gap-1">
            {alertas.map(([clave, valor]) => {
              const texto = clave === "fiados" || clave === "por_pagar_vencido"
                ? t.alerta[clave](formatoDolares(Number(valor)))
                : t.alerta[clave as Exclude<keyof typeof t.alerta, "fiados" | "por_pagar_vencido">](Number(valor));
              return (
                <li key={clave}>
                  <Link href={ENLACES[clave]} className="flex items-center gap-2 rounded-lg border p-3 hover:bg-muted">
                    <CircleAlert className="size-5 shrink-0 text-amber-600" aria-hidden />
                    {texto}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        <Link href="/vender" className={buttonVariants({ size: "lg" })}>
          {t.irVender}
        </Link>
        <Link href="/reportes" className={buttonVariants({ size: "lg", variant: "outline" })}>
          {t.verReportes}
        </Link>
      </div>
    </div>
  );
}
