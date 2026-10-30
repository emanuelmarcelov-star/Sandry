"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MessageCircle, Pencil } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Aviso, Campo, Selector } from "@/components/formulario";
import { enlaceWhatsApp } from "@/lib/compras";
import { dec, formatoDolares } from "@/lib/dinero";
import { textos, textosVentas } from "@/lib/textos";
import { registrarAbono, type DatosCliente } from "@/server/acciones/ventas";
import type { FormaPago } from "@/server/ventas";
import { DialogoCliente } from "../lista-clientes";

const t = textosVentas.clientes;

export function FichaCliente({
  cliente,
  saldo,
  tienda,
  formas,
  puedeSubirLimite,
}: {
  cliente: DatosCliente & { id: string };
  saldo: string;
  tienda: string;
  formas: FormaPago[];
  puedeSubirLimite: boolean;
}) {
  const router = useRouter();
  const [editar, setEditar] = useState(false);
  const [monto, setMonto] = useState("");
  const [forma, setForma] = useState(formas[0]?.id ?? "efectivo");
  const [error, setError] = useState<string>();
  const [guardando, iniciar] = useTransition();
  const debe = dec(saldo).gt(0);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">{cliente.nombre}</h1>
          <p className="text-muted-foreground">{[cliente.telefono, cliente.identificacion].filter(Boolean).join(" · ")}</p>
          {cliente.notas && <p className="text-muted-foreground">{cliente.notas}</p>}
        </div>
        <Button variant="outline" onClick={() => setEditar(true)}>
          <Pencil className="size-4" aria-hidden /> {t.editar}
        </Button>
      </div>
      <section className="grid gap-3 rounded-xl border p-4">
        <p className="flex items-baseline justify-between">
          <span className="text-lg">{t.debe}</span>
          <span className={debe ? "text-3xl font-bold text-destructive" : "text-3xl font-bold"} data-testid="saldo-cliente">
            {formatoDolares(saldo)}
          </span>
        </p>
        <p className="text-sm text-muted-foreground">
          {t.limite}: {formatoDolares(cliente.limite)}
        </p>
        {debe && (
          <>
            <form
              className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
              onSubmit={(e) => {
                e.preventDefault();
                iniciar(async () => {
                  const r = await registrarAbono(cliente.id, monto, forma);
                  if (!r.ok) return setError(r.mensaje);
                  toast.success(r.mensaje);
                  setMonto("");
                  setError(undefined);
                  router.refresh();
                });
              }}
            >
              <Campo id="abono-monto" etiqueta={t.monto}>
                <Input id="abono-monto" inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder={formatoDolares(saldo)} />
              </Campo>
              <Campo id="abono-forma" etiqueta={t.como}>
                <Selector id="abono-forma" value={forma} onChange={(e) => setForma(e.target.value)}>
                  {formas.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nombre}
                    </option>
                  ))}
                </Selector>
              </Campo>
              <Button type="submit" size="lg" disabled={guardando || !monto.trim()}>
                {guardando ? textos.general.guardando : t.abonar}
              </Button>
            </form>
            {error && <Aviso tipo="error">{error}</Aviso>}
            {cliente.telefono && (
              <a
                href={enlaceWhatsApp(cliente.telefono, t.mensaje(cliente.nombre.split(" ")[0], tienda, formatoDolares(saldo)))}
                target="_blank"
                rel="noopener"
                className={buttonVariants({ variant: "outline", className: "justify-self-start" })}
              >
                <MessageCircle className="size-5" aria-hidden /> {t.recordar}
              </a>
            )}
          </>
        )}
      </section>
      {editar && <DialogoCliente inicial={cliente} puedeSubirLimite={puedeSubirLimite} onCerrar={() => setEditar(false)} />}
    </>
  );
}
