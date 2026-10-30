"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Aviso, Campo } from "@/components/formulario";
import { dec, formatoDolares, formatoFecha, formatoHora } from "@/lib/dinero";
import { DENOMINACIONES_ARQUEO, totalArqueo } from "@/lib/ventas";
import { textos, textosVentas } from "@/lib/textos";
import { abrirCaja, cerrarCaja, reabrirCaja } from "@/server/acciones/ventas";
import type { ResumenCaja } from "@/server/ventas";
import { cn } from "cn";

const t = textosVentas.caja;

export function PantallaCaja({ abierta, ultima, puedeReabrir }: { abierta: ResumenCaja | null; ultima: ResumenCaja | null; puedeReabrir: boolean }) {
  const router = useRouter();
  const [fondo, setFondo] = useState("");
  const [conteo, setConteo] = useState<Record<string, string>>({});
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string>();
  const [ocupado, iniciar] = useTransition();

  if (!abierta) {
    return (
      <div className="grid gap-4">
        <Aviso tipo="info">{t.cerrada}</Aviso>
        {error && <Aviso tipo="error">{error}</Aviso>}
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            iniciar(async () => {
              const r = await abrirCaja(fondo);
              if (!r.ok) return setError(r.mensaje);
              toast.success(r.mensaje);
              router.refresh();
            });
          }}
        >
          <Campo id="caja-fondo" etiqueta={t.fondo}>
            <Input id="caja-fondo" inputMode="decimal" value={fondo} onChange={(e) => setFondo(e.target.value)} placeholder="$0.00" />
          </Campo>
          <Button type="submit" size="lg" disabled={ocupado}>
            {t.abrir}
          </Button>
        </form>
        {ultima && (
          <section className="grid gap-1 rounded-xl border p-4">
            <h2 className="text-lg font-semibold">{t.ultima}</h2>
            <Resumen r={ultima} />
            {ultima.diferencia && <Diferencia valor={ultima.diferencia} />}
            {puedeReabrir && (
              <Button
                variant="outline"
                className="mt-2 justify-self-start"
                disabled={ocupado}
                onClick={() =>
                  iniciar(async () => {
                    const r = await reabrirCaja();
                    if (!r.ok) return setError(r.mensaje);
                    toast.success(r.mensaje);
                    router.refresh();
                  })
                }
              >
                {t.reabrir}
              </Button>
            )}
          </section>
        )}
      </div>
    );
  }

  const contado = totalArqueo(conteo);
  const diferencia = contado.minus(abierta.esperado);
  return (
    <div className="grid gap-5">
      <section className="grid gap-1 rounded-xl border p-4">
        <p className="text-muted-foreground">{t.abierta(formatoHora(abierta.abiertaEn), abierta.abiertaPor)}</p>
        <Resumen r={abierta} />
        <p className="flex justify-between border-t pt-2 text-xl font-bold">
          <span>{t.esperado}</span>
          <span>{formatoDolares(abierta.esperado)}</span>
        </p>
      </section>

      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          iniciar(async () => {
            const r = await cerrarCaja(conteo, nota);
            if (!r.ok) return setError(r.mensaje);
            toast.success(t.cerrada2);
            setConteo({});
            router.refresh();
          });
        }}
      >
        <h2 className="text-xl font-semibold">{t.arqueo}</h2>
        <div className="grid grid-cols-3 gap-2">
          {DENOMINACIONES_ARQUEO.map((d) => (
            <label key={d} className="grid gap-1 text-sm">
              <span className="font-medium">{formatoDolares(d)}</span>
              <Input
                aria-label={`Cuántos de ${formatoDolares(d)}`}
                inputMode="numeric"
                value={conteo[d] ?? ""}
                onChange={(e) => setConteo({ ...conteo, [d]: e.target.value.replace(/\D/g, "") })}
              />
            </label>
          ))}
        </div>
        <p className="flex justify-between text-xl">
          <span>{t.contado}</span>
          <strong data-testid="contado">{formatoDolares(contado)}</strong>
        </p>
        <Diferencia valor={diferencia.toString()} />
        <Campo id="caja-nota" etiqueta={t.nota} opcional>
          <Input id="caja-nota" value={nota} onChange={(e) => setNota(e.target.value)} />
        </Campo>
        {error && <Aviso tipo="error">{error}</Aviso>}
        <Button type="submit" size="lg" disabled={ocupado}>
          {ocupado ? textos.general.guardando : t.cerrar}
        </Button>
      </form>
    </div>
  );
}

function Resumen({ r }: { r: ResumenCaja }) {
  return (
    <>
      <p className="flex justify-between">
        <span>{t.fondo}</span>
        <span>{formatoDolares(r.fondo)}</span>
      </p>
      <p className="flex justify-between">
        <span>
          {t.ventas(r.ventas)} {r.cerradaEn && `· ${formatoFecha(r.cerradaEn)}`}
        </span>
        <span className="font-semibold">{formatoDolares(r.totalVentas)}</span>
      </p>
      {Object.entries(r.porForma).map(([forma, monto]) => (
        <p key={forma} className="flex justify-between pl-4 text-muted-foreground">
          <span>{textosVentas.ventas.pagos[forma] ?? forma}</span>
          <span>{formatoDolares(monto)}</span>
        </p>
      ))}
      {dec(r.abonos).gt(0) && (
        <p className="flex justify-between">
          <span>{t.abonos}</span>
          <span>{formatoDolares(r.abonos)}</span>
        </p>
      )}
    </>
  );
}

function Diferencia({ valor }: { valor: string }) {
  const d = dec(valor);
  return (
    <p className={cn("text-center text-2xl font-bold", d.isZero() ? "text-green-700 dark:text-green-400" : d.isNegative() ? "text-destructive" : "text-amber-600")}>
      {d.isZero() ? t.cuadra : `${d.isNegative() ? t.faltante : t.sobrante}: ${formatoDolares(d.abs())}`}
    </p>
  );
}
