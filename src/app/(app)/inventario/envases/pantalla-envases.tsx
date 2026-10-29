"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Aviso, Campo, Selector } from "@/components/formulario";
import { dec, formatoDolares } from "@/lib/dinero";
import { textos, textosInventario } from "@/lib/textos";
import { guardarEnvase, registrarEnvases } from "@/server/acciones/abastecimiento";

const t = textosInventario.envases;

type Envase = {
  id: string;
  nombre: string;
  garantia: string;
  proveedor: string;
  activo: boolean;
  vacios: number;
  debidos: number;
  garantias: number;
};

export function PantallaEnvases({
  envases,
  cuentas,
  proveedores,
  puedeGestionar,
  puedeRegistrar,
}: {
  envases: Envase[];
  cuentas: { id: string; nombre: string }[];
  proveedores: { id: string; nombre: string }[];
  puedeGestionar: boolean;
  puedeRegistrar: boolean;
}) {
  const [nuevo, setNuevo] = useState(false);
  const [moviendo, setMoviendo] = useState<Envase | null>(null);
  return (
    <div className="grid gap-4">
      {puedeGestionar && (
        <Button className="justify-self-start" onClick={() => setNuevo(true)}>
          <Plus className="size-5" aria-hidden /> {t.nuevo}
        </Button>
      )}
      {envases.length === 0 ? (
        <p className="text-lg">{t.vacio}</p>
      ) : (
        <ul className="grid gap-3">
          {envases.map((e) => (
            <li key={e.id} className="grid gap-3 rounded-xl border p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold">{e.nombre}</h2>
                <span className="text-sm text-muted-foreground">
                  {e.proveedor}
                  {dec(e.garantia).gt(0) && ` · ${t.garantia}: ${formatoDolares(e.garantia)}`}
                </span>
              </div>
              <dl className="grid grid-cols-3 gap-2 text-center">
                {(
                  [
                    [t.vacios, e.vacios],
                    [t.debidos, e.debidos],
                    [t.garantias, e.garantias],
                  ] as const
                ).map(([etiqueta, valor]) => (
                  <div key={etiqueta} className="rounded-lg bg-muted p-2">
                    <dt className="text-xs text-muted-foreground">{etiqueta}</dt>
                    <dd className="text-2xl font-bold">{valor}</dd>
                  </div>
                ))}
              </dl>
              {puedeRegistrar && (
                <Button variant="outline" onClick={() => setMoviendo(e)}>
                  {t.movimiento}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {nuevo && <DialogoEnvase proveedores={proveedores} onCerrar={() => setNuevo(false)} />}
      {moviendo && <DialogoMovimiento envase={moviendo} cuentas={cuentas} onCerrar={() => setMoviendo(null)} />}
    </div>
  );
}

function DialogoEnvase({ proveedores, onCerrar }: { proveedores: { id: string; nombre: string }[]; onCerrar: () => void }) {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [garantia, setGarantia] = useState("");
  const [proveedorId, setProveedorId] = useState("");
  const [error, setError] = useState<string>();
  const [guardando, iniciar] = useTransition();
  return (
    <Dialog open onOpenChange={(a) => !a && onCerrar()}>
      <DialogContent className="text-base sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">{t.nuevo}</DialogTitle>
        </DialogHeader>
        {error && <Aviso tipo="error">{error}</Aviso>}
        <form
          className="grid gap-4"
          onSubmit={(ev) => {
            ev.preventDefault();
            iniciar(async () => {
              const r = await guardarEnvase({ nombre, garantia, proveedorId, activo: true });
              if (!r.ok) return setError(r.mensaje);
              toast.success(r.mensaje);
              onCerrar();
              router.refresh();
            });
          }}
        >
          <Campo id="envase-nombre" etiqueta={t.nombre}>
            <Input id="envase-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Botella Coca-Cola 1 L" autoFocus />
          </Campo>
          <Campo id="envase-garantia" etiqueta={t.garantia} opcional>
            <Input id="envase-garantia" inputMode="decimal" value={garantia} onChange={(e) => setGarantia(e.target.value)} placeholder="$0.25" />
          </Campo>
          <Campo id="envase-proveedor" etiqueta={t.proveedor} opcional>
            <Selector id="envase-proveedor" value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
              <option value="">—</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </Selector>
          </Campo>
          <Button type="submit" size="lg" disabled={guardando}>
            {guardando ? textos.general.guardando : textos.general.guardar}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DialogoMovimiento({ envase, cuentas, onCerrar }: { envase: Envase; cuentas: { id: string; nombre: string }[]; onCerrar: () => void }) {
  const router = useRouter();
  const [tipo, setTipo] = useState("llegaron_llenos");
  const [cantidad, setCantidad] = useState("");
  const [cuentaId, setCuentaId] = useState("");
  const [error, setError] = useState<string>();
  const [guardando, iniciar] = useTransition();
  const conDinero = (tipo === "garantia_cobrada" || tipo === "garantia_devuelta") && dec(envase.garantia).gt(0);
  return (
    <Dialog open onOpenChange={(a) => !a && onCerrar()}>
      <DialogContent className="text-base sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">{envase.nombre}</DialogTitle>
        </DialogHeader>
        {error && <Aviso tipo="error">{error}</Aviso>}
        <form
          className="grid gap-4"
          onSubmit={(ev) => {
            ev.preventDefault();
            iniciar(async () => {
              const r = await registrarEnvases({ envaseId: envase.id, tipo, cantidad, cuentaId, nota: "" });
              if (!r.ok) return setError(r.mensaje);
              toast.success(t.guardado);
              onCerrar();
              router.refresh();
            });
          }}
        >
          <div className="grid gap-2">
            {Object.entries(t.tipos).map(([clave, texto]) => (
              <label key={clave} className="flex items-center gap-3 rounded-lg border p-3">
                <input type="radio" name="tipo-envase" value={clave} checked={tipo === clave} onChange={() => setTipo(clave)} className="size-5 accent-primary" />
                {texto}
              </label>
            ))}
          </div>
          <Campo id="envase-cantidad" etiqueta={t.cantidad}>
            <Input id="envase-cantidad" inputMode="numeric" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
          </Campo>
          {conDinero && (
            <Campo id="envase-cuenta" etiqueta={t.cuenta}>
              <Selector id="envase-cuenta" value={cuentaId} onChange={(e) => setCuentaId(e.target.value)}>
                <option value="">—</option>
                {cuentas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </Selector>
            </Campo>
          )}
          <Button type="submit" size="lg" disabled={guardando || !cantidad.trim()}>
            {guardando ? textos.general.guardando : textos.general.guardar}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
