"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Aviso, Campo } from "@/components/formulario";
import { textos, textosInventario } from "@/lib/textos";
import { registrarLote } from "@/server/acciones/abastecimiento";

const t = textosInventario.lote;

/** Anotar la fecha de caducidad de algo que ya está en la tienda (ej. la leche de la refri). */
export function AnotarLote({ productoId }: { productoId: string }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [vence, setVence] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [error, setError] = useState<string>();
  const [guardando, iniciar] = useTransition();
  return (
    <>
      <Button variant="outline" onClick={() => setAbierto(true)}>
        <CalendarPlus className="size-5" aria-hidden /> {t.anotar}
      </Button>
      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="text-base sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">{t.anotar}</DialogTitle>
          </DialogHeader>
          {error && <Aviso tipo="error">{error}</Aviso>}
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              iniciar(async () => {
                const r = await registrarLote({ productoId, vence, cantidad });
                if (!r.ok) return setError(r.mensaje);
                toast.success(t.guardado);
                setAbierto(false);
                setVence("");
                setCantidad("");
                router.refresh();
              });
            }}
          >
            <Campo id="lote-vence" etiqueta={t.vence}>
              <Input id="lote-vence" type="date" value={vence} onChange={(e) => setVence(e.target.value)} />
            </Campo>
            <Campo id="lote-cantidad" etiqueta={t.cantidad}>
              <Input id="lote-cantidad" inputMode="decimal" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
            </Campo>
            <Button type="submit" size="lg" disabled={guardando || !vence || !cantidad}>
              {guardando ? textos.general.guardando : textos.general.guardar}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
