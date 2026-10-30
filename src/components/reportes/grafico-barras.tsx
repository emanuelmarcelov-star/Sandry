"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatoDolares } from "@/lib/dinero";

/**
 * Barras de una sola serie (un solo color, el de la marca): ventas por día,
 * por hora o por día de la semana. Al pasar el dedo o el mouse se ve el valor.
 */
export function GraficoBarras({
  datos,
  etiqueta,
  dinero = true,
  titulo,
}: {
  datos: { nombre: string; valor: number }[];
  etiqueta: string;
  dinero?: boolean;
  titulo: string;
}) {
  if (!datos.length) return null;
  const formato = (v: number) => (dinero ? formatoDolares(v) : String(v));
  return (
    <figure className="grid gap-2" aria-label={titulo}>
      <figcaption className="font-semibold">{titulo}</figcaption>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={datos} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={2}>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.6} />
            <XAxis dataKey="nombre" tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} interval="preserveStartEnd" />
            <YAxis tickLine={false} axisLine={false} width={56} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} tickFormatter={(v: number) => formato(v)} />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.6 }}
              formatter={(v) => [formato(Number(v)), etiqueta]}
              contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)" }}
              labelStyle={{ color: "var(--muted-foreground)" }}
            />
            <Bar dataKey="valor" name={etiqueta} fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
