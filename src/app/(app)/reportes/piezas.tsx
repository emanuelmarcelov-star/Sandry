"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Casilla } from "@/components/formulario";
import { formatoDolares, formatoFecha } from "@/lib/dinero";
import { textosReportes, textosVentas } from "@/lib/textos";
import { marcarConciliado } from "@/server/acciones/gastos";

const t = textosReportes;

export function BotonImprimir() {
  return (
    <Button type="button" variant="outline" onClick={() => window.print()}>
      <Printer className="size-5" aria-hidden /> {t.pdf}
    </Button>
  );
}

/** Lo cobrado por Deuna, transferencia, etc. cada día, para marcarlo cuando se revisó en el banco. */
export function Conciliacion({ filas }: { filas: { dia: string; forma: string; total: number; verificado: boolean }[] }) {
  const [marcados, setMarcados] = useState(() => new Set(filas.filter((f) => f.verificado).map((f) => `${f.dia}|${f.forma}`)));
  const [, iniciar] = useTransition();
  return (
    <section className="grid gap-2">
      <h2 className="text-lg font-semibold">{t.conciliacion}</h2>
      <p className="text-sm text-muted-foreground">{t.conciliacionAyuda}</p>
      <ul className="grid gap-1">
        {filas.map((f) => {
          const clave = `${f.dia}|${f.forma}`;
          return (
            <li key={clave}>
              <label className="flex items-center gap-3 border-b py-2">
                <Casilla
                  checked={marcados.has(clave)}
                  onChange={(e) => {
                    const valor = e.target.checked;
                    const s = new Set(marcados);
                    if (valor) s.add(clave);
                    else s.delete(clave);
                    setMarcados(s);
                    iniciar(async () => {
                      const r = await marcarConciliado(f.dia, f.forma, valor);
                      if (!r.ok) toast.error(r.mensaje);
                    });
                  }}
                />
                <span className="flex-1">
                  {formatoFecha(`${f.dia}T12:00:00`)} · {textosVentas.ventas.pagos[f.forma] ?? f.forma}
                </span>
                <span className="font-semibold">{formatoDolares(f.total)}</span>
                {marcados.has(clave) && <span className="text-sm text-green-700 dark:text-green-400">{t.verificado}</span>}
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
