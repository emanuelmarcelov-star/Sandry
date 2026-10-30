"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Copy, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Aviso, Campo, Selector } from "@/components/formulario";
import { dec, formatoDolares, leerNumero, type Dec } from "@/lib/dinero";
import { desgloseCambio, faltaPorPagar, montosRapidos, type PagoVenta } from "@/lib/ventas";
import { textosVentas } from "@/lib/textos";
import type { AjustesVenta, ClienteResumen, FormaPago } from "@/server/ventas";
import { cn } from "cn";

const t = textosVentas.cobro;

/**
 * Cobrar: una o varias formas de pago. En efectivo muestra el cambio en grande
 * y con qué billetes darlo; en Deuna, el QR; en transferencia, los datos.
 */
export function DialogoCobro({
  total,
  formas,
  clientes,
  clienteId,
  ajustes,
  pidePin,
  error,
  onCliente,
  onConfirmar,
  onCerrar,
}: {
  total: Dec;
  formas: FormaPago[];
  clientes: ClienteResumen[];
  clienteId: string | null;
  ajustes: AjustesVenta;
  pidePin: boolean;
  error?: string;
  onCliente: (id: string | null) => void;
  onConfirmar: (pagos: PagoVenta[], pin: string) => Promise<void>;
  onCerrar: () => void;
}) {
  const [pagos, setPagos] = useState<PagoVenta[]>([{ forma: formas[0]?.id ?? "efectivo", monto: total.toFixed(2), recibido: "" }]);
  const [pin, setPin] = useState("");
  const [guardando, iniciar] = useTransition();
  const varios = pagos.length > 1;
  const falta = faltaPorPagar(total, pagos);

  const cambiarPago = (i: number, c: Partial<PagoVenta>) => setPagos(pagos.map((p, j) => (j === i ? { ...p, ...c } : p)));

  const efectivo = pagos.find((p) => p.forma === "efectivo");
  const recibido = efectivo?.recibido ? leerNumero(efectivo.recibido) : null;
  const cambio = efectivo && recibido ? recibido.minus(leerNumero(efectivo.monto) ?? 0) : null;
  const faltaRecibir = cambio?.isNegative() ?? false;

  return (
    <Dialog open onOpenChange={(a) => !a && !guardando && onCerrar()}>
      <DialogContent className="max-h-[95vh] overflow-y-auto text-base sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">{t.titulo}</DialogTitle>
        </DialogHeader>
        <p className="text-center text-5xl font-bold" data-testid="total-cobro">
          {formatoDolares(total)}
        </p>

        {pagos.map((pago, i) => (
          <section key={i} className="grid gap-3 rounded-xl border p-3">
            <div className="flex flex-wrap gap-2">
              {formas.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={pago.forma === f.id}
                  onClick={() => cambiarPago(i, { forma: f.id })}
                  className={cn("h-11 rounded-lg border px-3 text-base", pago.forma === f.id ? "border-primary bg-primary text-primary-foreground" : "bg-background")}
                >
                  {f.nombre}
                </button>
              ))}
              {varios && (
                <Button variant="ghost" size="sm" aria-label="Quitar este pago" onClick={() => setPagos(pagos.filter((_, j) => j !== i))}>
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              )}
            </div>
            {varios && (
              <Campo id={`pago-monto-${i}`} etiqueta={textosVentas.pos.montoVarios}>
                <Input id={`pago-monto-${i}`} inputMode="decimal" value={pago.monto} onChange={(e) => cambiarPago(i, { monto: e.target.value })} />
              </Campo>
            )}

            {pago.forma === "efectivo" && (
              <>
                <Campo id={`recibido-${i}`} etiqueta={t.recibido}>
                  <Input
                    id={`recibido-${i}`}
                    inputMode="decimal"
                    value={pago.recibido ?? ""}
                    onChange={(e) => cambiarPago(i, { recibido: e.target.value })}
                    placeholder={formatoDolares(leerNumero(pago.monto) ?? 0)}
                    autoFocus
                  />
                </Campo>
                <div className="flex flex-wrap gap-2">
                  {montosRapidos(leerNumero(pago.monto) ?? dec(0)).map((m, k) => (
                    <Button key={m} variant="outline" onClick={() => cambiarPago(i, { recibido: m })}>
                      {k === 0 ? t.exacto : formatoDolares(m)}
                    </Button>
                  ))}
                </div>
                {cambio && !cambio.isNegative() && (
                  <div className="rounded-xl bg-green-600/10 p-3 text-center">
                    <p className="text-base">{t.cambio}</p>
                    <p className="text-5xl font-bold text-green-700 dark:text-green-400" data-testid="cambio">
                      {formatoDolares(cambio)}
                    </p>
                    {cambio.gt(0) && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t.darCambio}: {desgloseCambio(cambio).map(([d, c]) => `${c} × ${formatoDolares(d)}`).join(" · ")}
                      </p>
                    )}
                  </div>
                )}
              </>
            )}

            {pago.forma === "deuna" && (
              <>
                {ajustes.deunaQr ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={ajustes.deunaQr} alt="QR de Deuna" className="mx-auto max-h-64 rounded-lg bg-white p-2" />
                    <p className="text-sm text-muted-foreground">{t.escaneaQr}</p>
                  </>
                ) : (
                  <Aviso tipo="info">{t.sinQr}</Aviso>
                )}
                <Campo id={`ref-${i}`} etiqueta={t.referencia} opcional>
                  <Input id={`ref-${i}`} inputMode="numeric" value={pago.referencia ?? ""} onChange={(e) => cambiarPago(i, { referencia: e.target.value })} />
                </Campo>
              </>
            )}

            {pago.forma === "transferencia" && (
              <>
                <DatosBanco banco={ajustes.banco} />
                <Campo id={`ref-${i}`} etiqueta={t.referenciaTransf} opcional>
                  <Input id={`ref-${i}`} value={pago.referencia ?? ""} onChange={(e) => cambiarPago(i, { referencia: e.target.value })} />
                </Campo>
              </>
            )}

            {pago.forma === "tarjeta" && (
              <Campo id={`ref-${i}`} etiqueta="Número de voucher" opcional>
                <Input id={`ref-${i}`} value={pago.referencia ?? ""} onChange={(e) => cambiarPago(i, { referencia: e.target.value })} />
              </Campo>
            )}

            {pago.forma === "fiado" && (
              <Campo id={`cliente-${i}`} etiqueta={t.clienteFiado}>
                <Selector id={`cliente-${i}`} value={clienteId ?? ""} onChange={(e) => onCliente(e.target.value || null)}>
                  <option value="">—</option>
                  {clientes
                    .filter((c) => c.activo)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                        {dec(c.saldo).gt(0) && ` (debe ${formatoDolares(c.saldo)} de ${formatoDolares(c.limite)})`}
                      </option>
                    ))}
                </Selector>
              </Campo>
            )}
          </section>
        ))}

        {varios && !falta.isZero() && (
          <p className={cn("text-center text-lg font-semibold", falta.isNegative() ? "text-destructive" : "")}>
            {t.falta}: {formatoDolares(falta)}
          </p>
        )}
        <Button
          variant="ghost"
          className="justify-self-start"
          onClick={() => {
            const resto = falta.gt(0) ? falta : dec(0);
            const primero = varios ? pagos : [{ ...pagos[0], monto: total.minus(resto).gt(0) ? total.minus(resto).toFixed(2) : pagos[0].monto }];
            setPagos([...primero, { forma: formas.find((f) => f.id !== pagos[0].forma)?.id ?? "efectivo", monto: resto.toFixed(2) }]);
          }}
        >
          <Plus className="size-4" aria-hidden /> {t.agregarForma}
        </Button>

        {pidePin && (
          <Campo id="cobro-pin" etiqueta={t.pin}>
            <Input id="cobro-pin" type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={(e) => setPin(e.target.value)} />
          </Campo>
        )}
        {error && <Aviso tipo="error">{error}</Aviso>}
        <Button
          size="lg"
          className="h-14 text-xl"
          disabled={guardando || !falta.isZero() || faltaRecibir}
          onClick={() => iniciar(() => onConfirmar(pagos, pin))}
        >
          {guardando ? t.guardando : t.confirmar}
        </Button>
        {guardando && typeof navigator !== "undefined" && !navigator.onLine && <p className="text-center text-sm text-muted-foreground">{t.esperandoSenal}</p>}
      </DialogContent>
    </Dialog>
  );
}

function DatosBanco({ banco }: { banco: AjustesVenta["banco"] }) {
  const filas = [
    ["Banco", banco.banco],
    ["Tipo", banco.tipo],
    ["Número", banco.numero],
    ["Titular", banco.titular],
    ["Cédula/RUC", banco.identificacion],
  ].filter(([, v]) => v);
  if (!filas.length) return <Aviso tipo="info">Todavía no hay datos bancarios (Ajustes).</Aviso>;
  const texto = filas.map(([k, v]) => `${k}: ${v}`).join("\n");
  return (
    <div className="grid gap-1 rounded-lg bg-muted p-3">
      <p className="font-semibold">{t.datosBanco}</p>
      {filas.map(([k, v]) => (
        <p key={k}>
          <span className="text-muted-foreground">{k}:</span> {v}
        </p>
      ))}
      <Button
        variant="outline"
        size="sm"
        className="justify-self-start"
        onClick={() => {
          void navigator.clipboard?.writeText(texto).then(() => toast.success(t.copiado));
        }}
      >
        <Copy className="size-4" aria-hidden /> {t.copiar}
      </Button>
    </div>
  );
}
