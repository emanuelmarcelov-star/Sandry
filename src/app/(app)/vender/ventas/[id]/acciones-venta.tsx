"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Aviso, Campo, Selector } from "@/components/formulario";
import { dec } from "@/lib/dinero";
import { textos, textosVentas } from "@/lib/textos";
import { devolverVenta } from "@/server/acciones/ventas";
import type { VentaDetalle } from "@/server/ventas";

const t = textosVentas.ventas;

/** Anular toda la venta o devolver algunos productos. Siempre con motivo y autorización. */
export function AccionesVenta({ venta, cuentas, esAdministradora }: { venta: VentaDetalle; cuentas: { id: string; nombre: string }[]; esAdministradora: boolean }) {
  const [modo, setModo] = useState<"anular" | "devolver" | null>(null);
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => setModo("devolver")}>
        {t.devolver}
      </Button>
      <Button variant="ghost" className="text-destructive" onClick={() => setModo("anular")}>
        {t.anular}
      </Button>
      {modo && <Dialogo modo={modo} venta={venta} cuentas={cuentas} esAdministradora={esAdministradora} onCerrar={() => setModo(null)} />}
    </div>
  );
}

function Dialogo({
  modo,
  venta,
  cuentas,
  esAdministradora,
  onCerrar,
}: {
  modo: "anular" | "devolver";
  venta: VentaDetalle;
  cuentas: { id: string; nombre: string }[];
  esAdministradora: boolean;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const [motivo, setMotivo] = useState("");
  const [pin, setPin] = useState("");
  const [cuentaId, setCuentaId] = useState(cuentas[0]?.id ?? "");
  const [cantidades, setCantidades] = useState<Record<number, string>>({});
  const [error, setError] = useState<string>();
  const [guardando, iniciar] = useTransition();
  const conFiado = venta.pagos.some((p) => p.forma === "fiado");

  return (
    <Dialog open onOpenChange={(a) => !a && onCerrar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto text-base sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">{modo === "anular" ? t.anular : t.devolver}</DialogTitle>
        </DialogHeader>
        {error && <Aviso tipo="error">{error}</Aviso>}
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            iniciar(async () => {
              const r = await devolverVenta({
                ventaId: venta.id,
                motivo,
                pin,
                cuentaId: modo === "devolver" && !conFiado ? cuentaId : undefined,
                lineas: modo === "anular" ? null : Object.entries(cantidades).map(([id, cantidad]) => ({ lineaId: Number(id), cantidad })),
              });
              if (!r.ok) return setError(r.mensaje);
              toast.success(r.mensaje);
              onCerrar();
              router.refresh();
            });
          }}
        >
          {modo === "devolver" && (
            <ul className="grid gap-2">
              {venta.lineas
                .filter((l) => dec(l.cantidad).gt(l.devuelto))
                .map((l) => (
                  <li key={l.id} className="flex items-center gap-3">
                    <label htmlFor={`dev-${l.id}`} className="flex-1">
                      {l.descripcion} <span className="text-sm text-muted-foreground">(máx. {dec(l.cantidad).minus(l.devuelto).toString()})</span>
                    </label>
                    <Input
                      id={`dev-${l.id}`}
                      className="w-24"
                      inputMode="decimal"
                      aria-label={`${t.cantidadDevolver}: ${l.descripcion}`}
                      value={cantidades[l.id] ?? ""}
                      onChange={(e) => setCantidades({ ...cantidades, [l.id]: e.target.value })}
                    />
                  </li>
                ))}
            </ul>
          )}
          <Campo id="dev-motivo" etiqueta={t.motivo}>
            <Input id="dev-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus={modo === "anular"} />
          </Campo>
          {modo === "devolver" && !conFiado && (
            <Campo id="dev-cuenta" etiqueta={t.cuenta}>
              <Selector id="dev-cuenta" value={cuentaId} onChange={(e) => setCuentaId(e.target.value)}>
                {cuentas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </Selector>
            </Campo>
          )}
          {!esAdministradora && (
            <Campo id="dev-pin" etiqueta={t.pin} ayuda={t.pinAyuda}>
              <Input id="dev-pin" type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={(e) => setPin(e.target.value)} />
            </Campo>
          )}
          <Button type="submit" size="lg" variant={modo === "anular" ? "destructive" : "default"} disabled={guardando || !motivo.trim()}>
            {guardando ? textos.general.guardando : modo === "anular" ? t.anular : t.devolver}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
