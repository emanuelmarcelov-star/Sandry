"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Phone, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Aviso, Campo, Casilla, Selector } from "@/components/formulario";
import { textos, textosCompras } from "@/lib/textos";
import { guardarProveedor, type DatosProveedor } from "@/server/acciones/abastecimiento";
import type { Proveedor } from "@/server/abastecimiento";
import { cn } from "cn";

const t = textosCompras.proveedores;

const vacio: DatosProveedor = {
  nombre: "", tipo: "distribuidor", ruc: "", contacto: "", telefono: "", direccion: "", diasVisita: [], condiciones: "", notas: "", activo: true,
};

export function ListaProveedores({ proveedores }: { proveedores: Proveedor[] }) {
  const [editando, setEditando] = useState<DatosProveedor | null>(null);
  return (
    <div className="grid gap-4">
      <Button className="justify-self-start" onClick={() => setEditando(vacio)}>
        <Plus className="size-5" aria-hidden /> {t.nuevo}
      </Button>
      {proveedores.length === 0 ? (
        <p className="text-lg">{t.vacio}</p>
      ) : (
        <ul className="grid gap-2">
          {proveedores.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setEditando({ ...p })}
                className={cn("grid w-full gap-1 rounded-xl border p-4 text-left hover:bg-muted", !p.activo && "opacity-60")}
              >
                <span className="flex flex-wrap items-center gap-2 text-lg font-semibold">
                  {p.nombre}
                  <Badge variant="outline">{t.tipos[p.tipo]?.split(" (")[0]}</Badge>
                </span>
                <span className="flex flex-wrap gap-x-4 text-sm text-muted-foreground">
                  {p.contacto && <span>{p.contacto}</span>}
                  {p.telefono && (
                    <span className="flex items-center gap-1">
                      <Phone className="size-3" aria-hidden /> {p.telefono}
                    </span>
                  )}
                  {p.diasVisita.length > 0 && (
                    <span>
                      {t.visita}: {p.diasVisita.map((d) => t.diasSemana[d - 1]).join(", ")}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {editando && <DialogoProveedor inicial={editando} onCerrar={() => setEditando(null)} />}
    </div>
  );
}

function DialogoProveedor({ inicial, onCerrar }: { inicial: DatosProveedor; onCerrar: () => void }) {
  const router = useRouter();
  const [d, setD] = useState(inicial);
  const [error, setError] = useState<string>();
  const [guardando, iniciar] = useTransition();
  const cambiar = (c: Partial<DatosProveedor>) => setD({ ...d, ...c });

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto text-base sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">{d.id ? t.editar : t.nuevo}</DialogTitle>
        </DialogHeader>
        {error && <Aviso tipo="error">{error}</Aviso>}
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            iniciar(async () => {
              const r = await guardarProveedor(d);
              if (!r.ok) return setError(r.mensaje);
              toast.success(t.guardado);
              onCerrar();
              router.refresh();
            });
          }}
        >
          <Campo id="prov-nombre" etiqueta={t.nombre}>
            <Input id="prov-nombre" value={d.nombre} onChange={(e) => cambiar({ nombre: e.target.value })} autoFocus />
          </Campo>
          <Campo id="prov-tipo" etiqueta={t.tipo}>
            <Selector id="prov-tipo" value={d.tipo} onChange={(e) => cambiar({ tipo: e.target.value })}>
              {Object.entries(t.tipos).map(([clave, nombre]) => (
                <option key={clave} value={clave}>
                  {nombre}
                </option>
              ))}
            </Selector>
          </Campo>
          <Campo id="prov-telefono" etiqueta={t.telefono} opcional>
            <Input id="prov-telefono" inputMode="tel" value={d.telefono} onChange={(e) => cambiar({ telefono: e.target.value })} />
          </Campo>
          <Campo id="prov-contacto" etiqueta={t.contacto} opcional>
            <Input id="prov-contacto" value={d.contacto} onChange={(e) => cambiar({ contacto: e.target.value })} />
          </Campo>
          {d.tipo === "distribuidor" && (
            <fieldset className="grid gap-2">
              <legend className="text-base font-medium">{t.dias}</legend>
              <div className="flex flex-wrap gap-2">
                {t.diasSemana.map((nombre, i) => {
                  const dia = i + 1;
                  const marcado = d.diasVisita.includes(dia);
                  return (
                    <button
                      key={nombre}
                      type="button"
                      aria-pressed={marcado}
                      onClick={() => cambiar({ diasVisita: marcado ? d.diasVisita.filter((x) => x !== dia) : [...d.diasVisita, dia].sort() })}
                      className={cn("h-11 w-14 rounded-lg border", marcado ? "border-primary bg-primary text-primary-foreground" : "bg-background")}
                    >
                      {nombre}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}
          <Campo id="prov-condiciones" etiqueta={t.condiciones} opcional>
            <Input id="prov-condiciones" value={d.condiciones} onChange={(e) => cambiar({ condiciones: e.target.value })} placeholder="Ej.: crédito 15 días" />
          </Campo>
          <Campo id="prov-ruc" etiqueta={t.ruc} opcional>
            <Input id="prov-ruc" inputMode="numeric" value={d.ruc} onChange={(e) => cambiar({ ruc: e.target.value })} />
          </Campo>
          <Campo id="prov-direccion" etiqueta={t.direccion} opcional>
            <Input id="prov-direccion" value={d.direccion} onChange={(e) => cambiar({ direccion: e.target.value })} />
          </Campo>
          <Campo id="prov-notas" etiqueta={t.notas} opcional>
            <Input id="prov-notas" value={d.notas} onChange={(e) => cambiar({ notas: e.target.value })} />
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
