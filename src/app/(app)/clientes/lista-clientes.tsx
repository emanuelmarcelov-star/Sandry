"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Aviso, Campo, Casilla } from "@/components/formulario";
import { dec, formatoDolares } from "@/lib/dinero";
import { normalizarTexto } from "@/lib/excel/productos";
import { textos, textosVentas } from "@/lib/textos";
import { guardarCliente, type DatosCliente } from "@/server/acciones/ventas";
import type { ClienteResumen } from "@/server/ventas";

const t = textosVentas.clientes;

export function ListaClientes({ clientes, puedeSubirLimite }: { clientes: ClienteResumen[]; puedeSubirLimite: boolean }) {
  const [buscar, setBuscar] = useState("");
  const [nuevo, setNuevo] = useState(false);
  const n = normalizarTexto(buscar);
  const visibles = clientes.filter((c) => !n || normalizarTexto(`${c.nombre} ${c.identificacion} ${c.telefono}`).includes(n));
  const deuda = clientes.reduce((s, c) => s.plus(dec(c.saldo).gt(0) ? c.saldo : 0), dec(0));
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button onClick={() => setNuevo(true)}>
          <Plus className="size-5" aria-hidden /> {t.nuevo}
        </Button>
        {deuda.gt(0) && (
          <span className="text-lg">
            {t.debe}: <strong>{formatoDolares(deuda)}</strong>
          </span>
        )}
      </div>
      <Input aria-label={t.buscar} placeholder={t.buscar} value={buscar} onChange={(e) => setBuscar(e.target.value)} />
      {clientes.length === 0 ? (
        <p className="text-lg">{t.vacio}</p>
      ) : (
        <ul className="grid gap-2">
          {visibles.map((c) => (
            <li key={c.id}>
              <Link href={`/clientes/${c.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 hover:bg-muted">
                <span className="grid">
                  <span className="text-lg font-semibold">{c.nombre}</span>
                  <span className="text-sm text-muted-foreground">{[c.telefono, c.identificacion].filter(Boolean).join(" · ")}</span>
                </span>
                {dec(c.saldo).gt(0) ? (
                  <Badge variant="destructive" className="h-7 px-3 text-sm">
                    {t.debe} {formatoDolares(c.saldo)}
                  </Badge>
                ) : (
                  <Badge variant="outline">{t.alDia}</Badge>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {nuevo && <DialogoCliente puedeSubirLimite={puedeSubirLimite} onCerrar={() => setNuevo(false)} />}
    </div>
  );
}

export function DialogoCliente({ inicial, puedeSubirLimite, onCerrar }: { inicial?: DatosCliente; puedeSubirLimite: boolean; onCerrar: () => void }) {
  const router = useRouter();
  const [d, setD] = useState<DatosCliente>(
    inicial ?? { nombre: "", identificacion: "", telefono: "", correo: "", direccion: "", limite: "", notas: "", activo: true },
  );
  const [error, setError] = useState<string>();
  const [guardando, iniciar] = useTransition();
  const cambiar = (c: Partial<DatosCliente>) => setD({ ...d, ...c });
  return (
    <Dialog open onOpenChange={(a) => !a && onCerrar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto text-base sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">{d.id ? t.editar : t.nuevo}</DialogTitle>
        </DialogHeader>
        {error && <Aviso tipo="error">{error}</Aviso>}
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            iniciar(async () => {
              const r = await guardarCliente(d);
              if (!r.ok) return setError(r.mensaje);
              toast.success(t.guardado);
              onCerrar();
              router.refresh();
            });
          }}
        >
          <Campo id="cli-nombre" etiqueta={t.nombre}>
            <Input id="cli-nombre" value={d.nombre} onChange={(e) => cambiar({ nombre: e.target.value })} autoFocus />
          </Campo>
          <Campo id="cli-telefono" etiqueta={t.telefono} opcional>
            <Input id="cli-telefono" inputMode="tel" value={d.telefono} onChange={(e) => cambiar({ telefono: e.target.value })} />
          </Campo>
          <Campo id="cli-limite" etiqueta={t.limite} ayuda={t.limiteAyuda}>
            <Input id="cli-limite" inputMode="decimal" value={d.limite} onChange={(e) => cambiar({ limite: e.target.value })} placeholder="$0.00" disabled={!puedeSubirLimite && !d.id} />
          </Campo>
          <Campo id="cli-id" etiqueta={t.identificacion} opcional>
            <Input id="cli-id" inputMode="numeric" value={d.identificacion} onChange={(e) => cambiar({ identificacion: e.target.value })} />
          </Campo>
          <Campo id="cli-correo" etiqueta={t.correo} opcional>
            <Input id="cli-correo" type="email" value={d.correo} onChange={(e) => cambiar({ correo: e.target.value })} />
          </Campo>
          <Campo id="cli-direccion" etiqueta={t.direccion} opcional>
            <Input id="cli-direccion" value={d.direccion} onChange={(e) => cambiar({ direccion: e.target.value })} />
          </Campo>
          <Campo id="cli-notas" etiqueta={t.notas} opcional>
            <Input id="cli-notas" value={d.notas} onChange={(e) => cambiar({ notas: e.target.value })} placeholder="Ej.: pedido de siempre: 2 panes y una leche" />
          </Campo>
          {d.id && (
            <label className="flex items-center gap-3">
              <Casilla checked={d.activo} onChange={(e) => cambiar({ activo: e.target.checked })} /> {t.activo}
            </label>
          )}
          <Button type="submit" size="lg" disabled={guardando}>
            {guardando ? textos.general.guardando : textos.general.guardar}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
