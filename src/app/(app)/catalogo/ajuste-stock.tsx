"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ClipboardCheck, PackageMinus, PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Aviso, Campo, Casilla, Selector } from "@/components/formulario";
import { cantidadConUnidad, costoReal, type UnidadBase } from "@/lib/catalogo";
import { formatoDolares, leerNumero } from "@/lib/dinero";
import { textos, textosCatalogo } from "@/lib/textos";
import { ajustarStock, type TipoAjuste } from "@/server/acciones/catalogo";

const t = textosCatalogo.stock;

type Presentacion = { nombre: string; factor: string; paraCompra: boolean; esBase: boolean };
type Modo = "sumar" | "corregir" | "sacar";

/** Botones para sumar, corregir o sacar stock desde la ficha del producto. */
export function AjusteStock({
  productoId,
  stock,
  unidad,
  presentaciones,
  compraConIva,
  ivaCompras,
  puedeSumar,
  puedeAjustar,
  puedeVerCostos,
  movimientos,
}: {
  productoId: string;
  stock: string;
  unidad: UnidadBase;
  presentaciones: Presentacion[];
  compraConIva: boolean;
  ivaCompras: string;
  puedeSumar: boolean;
  puedeAjustar: boolean;
  puedeVerCostos: boolean;
  movimientos: { fecha: string; texto: string; saldo: string }[];
}) {
  const [modo, setModo] = useState<Modo | null>(null);

  return (
    <section className="grid max-w-3xl gap-4 rounded-xl border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-semibold">{t.titulo}</h2>
        <span className="text-2xl font-bold">{cantidadConUnidad(stock, unidad)}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {puedeSumar && (
          <Button onClick={() => setModo("sumar")}>
            <PackagePlus className="size-5" aria-hidden /> {t.sumar}
          </Button>
        )}
        {puedeAjustar && (
          <>
            <Button variant="outline" onClick={() => setModo("corregir")}>
              <ClipboardCheck className="size-5" aria-hidden /> {t.corregir}
            </Button>
            <Button variant="outline" onClick={() => setModo("sacar")}>
              <PackageMinus className="size-5" aria-hidden /> {t.sacar}
            </Button>
          </>
        )}
      </div>
      {movimientos.length > 0 && (
        <div className="grid gap-1">
          <h3 className="font-semibold">{t.ultimos}</h3>
          <ul className="grid gap-1 text-base">
            {movimientos.map((m, i) => (
              <li key={i} className="flex flex-wrap gap-x-3">
                <span className="w-32 shrink-0 text-muted-foreground">{m.fecha}</span>
                <span className="flex-1">{m.texto}</span>
                <span className="text-muted-foreground">
                  {t.queda}: {m.saldo}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {modo && (
        <DialogoAjuste
          modo={modo}
          productoId={productoId}
          stock={stock}
          unidad={unidad}
          presentaciones={presentaciones}
          compraConIva={compraConIva}
          ivaCompras={ivaCompras}
          puedeVerCostos={puedeVerCostos}
          onCerrar={() => setModo(null)}
        />
      )}
    </section>
  );
}

function DialogoAjuste({
  modo,
  productoId,
  stock,
  unidad,
  presentaciones,
  compraConIva,
  ivaCompras,
  puedeVerCostos,
  onCerrar,
}: {
  modo: Modo;
  productoId: string;
  stock: string;
  unidad: UnidadBase;
  presentaciones: Presentacion[];
  compraConIva: boolean;
  ivaCompras: string;
  puedeVerCostos: boolean;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const opciones = modo === "sumar" ? presentaciones.filter((p) => p.paraCompra || p.esBase) : presentaciones;
  const base = presentaciones.find((p) => p.esBase)!;
  const [indice, setIndice] = useState(0);
  const [cantidad, setCantidad] = useState("");
  const [costo, setCosto] = useState("");
  const [conIva, setConIva] = useState(compraConIva);
  const [motivo, setMotivo] = useState<TipoAjuste>("merma");
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string>();
  const [guardando, iniciar] = useTransition();

  const presentacion = modo === "corregir" ? base : (opciones[indice] ?? base);
  const n = leerNumero(cantidad);
  const enBase = n ? n.times(presentacion.factor) : null;
  const costoN = leerNumero(costo);
  const costoRealPres = costoN ? costoReal(costoN, conIva, ivaCompras) : null;

  const titulo = modo === "sumar" ? t.sumar : modo === "corregir" ? t.corregir : t.sacar;

  function guardar() {
    setError(undefined);
    iniciar(async () => {
      const r = await ajustarStock({
        productoId,
        tipo: modo === "sumar" ? "compra" : modo === "corregir" ? "conteo" : motivo,
        cantidad,
        factor: presentacion.factor,
        costo,
        compraConIva: conIva,
        nota,
      });
      if (!r.ok) return setError(r.mensaje);
      toast.success(`${r.mensaje} ${t.ahoraHay} ${cantidadConUnidad(r.datos!.saldo, unidad)}.`);
      onCerrar();
      router.refresh();
    });
  }

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="text-base sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">{titulo}</DialogTitle>
        </DialogHeader>
        {error && <Aviso tipo="error">{error}</Aviso>}
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            guardar();
          }}
        >
          {modo === "sacar" && (
            <Campo id="aj-motivo" etiqueta={t.motivo}>
              <Selector id="aj-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value as TipoAjuste)}>
                {Object.entries(t.motivos).map(([clave, texto]) => (
                  <option key={clave} value={clave}>
                    {texto}
                  </option>
                ))}
              </Selector>
            </Campo>
          )}

          {modo !== "corregir" && opciones.length > 1 && (
            <Campo id="aj-presentacion" etiqueta={t.en}>
              <Selector id="aj-presentacion" value={indice} onChange={(e) => setIndice(Number(e.target.value))}>
                {opciones.map((p, i) => (
                  <option key={p.nombre} value={i}>
                    {p.nombre}
                    {!p.esBase && ` (${cantidadConUnidad(p.factor, unidad)})`}
                  </option>
                ))}
              </Selector>
            </Campo>
          )}

          <Campo
            id="aj-cantidad"
            etiqueta={modo === "corregir" ? t.cuantasHay(unidad) : t.cantidad}
            ayuda={modo === "corregir" ? `${t.sistemaDice} ${cantidadConUnidad(stock, unidad)}.` : undefined}
          >
            <Input id="aj-cantidad" inputMode="decimal" value={cantidad} onChange={(e) => setCantidad(e.target.value)} autoFocus />
          </Campo>
          {enBase && !presentacion.esBase && modo !== "corregir" && (
            <p className="text-muted-foreground">= {cantidadConUnidad(enBase, unidad)}</p>
          )}

          {modo === "sumar" && puedeVerCostos && (
            <Campo id="aj-costo" etiqueta={`${t.costoDe} ${presentacion.nombre.toLowerCase()}`} ayuda={t.ayudaCosto} opcional>
              <Input id="aj-costo" inputMode="decimal" placeholder="0.00" value={costo} onChange={(e) => setCosto(e.target.value)} />
              <label className="flex items-center gap-3">
                <Casilla checked={conIva} onChange={(e) => setConIva(e.target.checked)} />
                {textosCatalogo.formulario.compraConIva(ivaCompras)}
              </label>
              {costoRealPres && conIva && (
                <p className="font-medium">
                  {textosCatalogo.formulario.costoReal}: {formatoDolares(costoRealPres)}
                </p>
              )}
            </Campo>
          )}

          <Campo id="aj-nota" etiqueta={t.nota} opcional>
            <Input id="aj-nota" value={nota} onChange={(e) => setNota(e.target.value)} placeholder={t.ejemploNota[modo]} />
          </Campo>

          <Button type="submit" size="lg" disabled={guardando || !cantidad.trim()}>
            {guardando ? textos.general.guardando : textos.general.guardar}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
