"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Aviso, Campo, Selector } from "@/components/formulario";
import { dec } from "@/lib/dinero";
import { textos, textosCompras } from "@/lib/textos";
import { pagarCompra } from "@/server/acciones/abastecimiento";

const t = textosCompras.porPagar;

export function BotonPagar({
  compraId,
  saldo,
  proveedor,
  cuentas,
}: {
  compraId: string;
  saldo: string;
  proveedor: string;
  cuentas: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [monto, setMonto] = useState(dec(saldo).toDecimalPlaces(2).toString());
  const [cuentaId, setCuentaId] = useState("");
  const [error, setError] = useState<string>();
  const [guardando, iniciar] = useTransition();
  return (
    <>
      <Button onClick={() => setAbierto(true)}>{t.pagar}</Button>
      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="text-base sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {t.pagar} · {proveedor}
            </DialogTitle>
          </DialogHeader>
          {error && <Aviso tipo="error">{error}</Aviso>}
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              iniciar(async () => {
                const r = await pagarCompra({ compraId, monto, cuentaId, nota: "" });
                if (!r.ok) return setError(r.mensaje);
                toast.success(t.pagado);
                setAbierto(false);
                router.refresh();
              });
            }}
          >
            <Campo id="pago-monto" etiqueta={t.monto}>
              <Input id="pago-monto" inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} />
            </Campo>
            <Campo id="pago-cuenta" etiqueta={t.cuenta}>
              <Selector id="pago-cuenta" value={cuentaId} onChange={(e) => setCuentaId(e.target.value)}>
                <option value="">—</option>
                {cuentas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </Selector>
            </Campo>
            <Button type="submit" size="lg" disabled={guardando || !cuentaId}>
              {guardando ? textos.general.guardando : t.pagar}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
