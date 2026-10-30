"use client";

import { useEffect } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { textosVentas } from "@/lib/textos";

/** Abre el cuadro de impresión solo (al venir de «Imprimir ticket») y deja el botón por si acaso. */
export function ImprimirAlAbrir({ automatico }: { automatico: boolean }) {
  useEffect(() => {
    if (!automatico) return;
    const reloj = window.setTimeout(() => window.print(), 300);
    return () => window.clearTimeout(reloj);
  }, [automatico]);
  return (
    <Button className="print:hidden" onClick={() => window.print()}>
      <Printer className="size-5" aria-hidden /> {textosVentas.cobro.imprimir}
    </Button>
  );
}
