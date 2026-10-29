"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Aviso, Campo, Casilla, Selector } from "@/components/formulario";
import { guardarCategoria } from "@/server/acciones/catalogo";
import type { DatosCategoria } from "@/lib/esquemas/catalogo";
import { textosCatalogo } from "@/lib/textos";

const t = textosCatalogo.categorias;
const IVA: Record<string, string> = { "15": "15%", "0": "0%", exento: "Exento" };

type Categoria = {
  id: string;
  nombre: string;
  padreId: string | null;
  color: string;
  tarifaIva: string | null;
  margenObjetivo: string | null;
  activa: boolean;
  ruta: string;
  nivel: number;
  ivaEfectivo: string;
  margenEfectivo: string;
};

export function ArbolCategorias({ categorias }: { categorias: Categoria[] }) {
  const [editando, setEditando] = useState<DatosCategoria | null>(null);

  const nueva = (padreId = ""): DatosCategoria => ({
    nombre: "",
    padreId,
    color: categorias.find((c) => c.id === padreId)?.color ?? "#64748b",
    tarifaIva: "",
    margenObjetivo: "",
    activa: true,
  });

  return (
    <>
      <Button className="justify-self-start" onClick={() => setEditando(nueva())}>
        <Plus className="size-5" aria-hidden /> {t.nueva}
      </Button>

      <ul className="grid gap-1">
        {categorias.map((c) => (
          <li
            key={c.id}
            className="flex flex-wrap items-center gap-3 rounded-lg border p-3"
            style={{ marginLeft: `${c.nivel * 1.5}rem` }}
          >
            <span className="size-4 shrink-0 rounded-full" style={{ background: c.color }} aria-hidden />
            <span className={c.nivel === 0 ? "text-lg font-semibold" : "text-base"}>{c.nombre}</span>
            {!c.activa && <Badge variant="secondary">Desactivada</Badge>}
            <span className="text-sm text-muted-foreground">
              IVA {IVA[c.ivaEfectivo]}
              {!c.tarifaIva && c.nivel > 0 && ` (${t.heredado.toLowerCase()})`} · margen {c.margenEfectivo}%
              {!c.margenObjetivo && c.nivel > 0 && ` (${t.heredado.toLowerCase()})`}
            </span>
            <span className="ml-auto flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  setEditando({
                    id: c.id,
                    nombre: c.nombre,
                    padreId: c.padreId ?? "",
                    color: c.color,
                    tarifaIva: (c.tarifaIva ?? "") as DatosCategoria["tarifaIva"],
                    margenObjetivo: c.margenObjetivo ?? "",
                    activa: c.activa,
                  })
                }
              >
                <Pencil className="size-4" aria-hidden /> {t.editar}
              </Button>
              {c.nivel === 0 && (
                <Button size="sm" variant="ghost" onClick={() => setEditando(nueva(c.id))}>
                  <Plus className="size-4" aria-hidden /> {t.subcategoria}
                </Button>
              )}
            </span>
          </li>
        ))}
      </ul>

      {editando && <DialogoCategoria valores={editando} categorias={categorias} onCerrar={() => setEditando(null)} />}
    </>
  );
}

function DialogoCategoria({
  valores,
  categorias,
  onCerrar,
}: {
  valores: DatosCategoria;
  categorias: Categoria[];
  onCerrar: () => void;
}) {
  const router = useRouter();
  const [datos, setDatos] = useState(valores);
  const [error, setError] = useState<string>();
  const [guardando, iniciar] = useTransition();
  const cambiar = (c: Partial<DatosCategoria>) => setDatos({ ...datos, ...c });
  // No se puede elegir como madre a sí misma ni a sus hijas.
  const madres = categorias.filter((c) => c.nivel === 0 && c.id !== datos.id);

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="text-base sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">{datos.id ? t.editar : t.nueva}</DialogTitle>
        </DialogHeader>
        {error && <Aviso tipo="error">{error}</Aviso>}
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            iniciar(async () => {
              const r = await guardarCategoria(datos);
              if (!r.ok) return setError(Object.values(r.campos ?? {})[0] ?? r.mensaje);
              toast.success(r.mensaje);
              onCerrar();
              router.refresh();
            });
          }}
        >
          <Campo id="cat-nombre" etiqueta={t.nombre}>
            <Input id="cat-nombre" value={datos.nombre} onChange={(e) => cambiar({ nombre: e.target.value })} autoFocus />
          </Campo>
          <Campo id="cat-madre" etiqueta={t.madre}>
            <Selector id="cat-madre" value={datos.padreId} onChange={(e) => cambiar({ padreId: e.target.value })}>
              <option value="">{t.ninguna}</option>
              {madres.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </Selector>
          </Campo>
          <div className="grid grid-cols-[auto_1fr_1fr] gap-3">
            <Campo id="cat-color" etiqueta={t.color}>
              <input
                id="cat-color"
                type="color"
                value={datos.color}
                onChange={(e) => cambiar({ color: e.target.value })}
                className="h-12 w-16 cursor-pointer rounded-lg border"
              />
            </Campo>
            <Campo id="cat-iva" etiqueta={t.iva}>
              <Selector id="cat-iva" value={datos.tarifaIva} onChange={(e) => cambiar({ tarifaIva: e.target.value as DatosCategoria["tarifaIva"] })}>
                <option value="">{t.heredado}</option>
                <option value="15">15%</option>
                <option value="0">0%</option>
                <option value="exento">Exento</option>
              </Selector>
            </Campo>
            <Campo id="cat-margen" etiqueta={t.margen}>
              <Input
                id="cat-margen"
                inputMode="decimal"
                placeholder={t.heredado}
                value={datos.margenObjetivo}
                onChange={(e) => cambiar({ margenObjetivo: e.target.value })}
              />
            </Campo>
          </div>
          <label className="flex items-center gap-3">
            <Casilla checked={datos.activa} onChange={(e) => cambiar({ activa: e.target.checked })} /> {t.activa}
          </label>
          <Button type="submit" size="lg" disabled={guardando}>
            {guardando ? "Guardando…" : "Guardar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
