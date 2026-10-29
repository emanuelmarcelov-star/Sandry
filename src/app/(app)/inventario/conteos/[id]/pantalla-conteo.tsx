"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Aviso, Campo, Casilla } from "@/components/formulario";
import { cantidadConUnidad, type UnidadBase } from "@/lib/catalogo";
import { buscarLocal, type ProductoLigero } from "@/lib/compras";
import { dec, leerNumero } from "@/lib/dinero";
import { textosInventario } from "@/lib/textos";
import { anotarConteo, anularConteo, aprobarConteo, enviarConteo } from "@/server/acciones/abastecimiento";
import { cn } from "cn";

const t = textosInventario.conteos;

type Linea = { productoId: string; nombre: string; unidadBase: string; sistema: string; contado: string };

/**
 * Contar en el celular: se escanea o busca, se escribe cuánto hay y se guarda
 * solo. Quien cuenta no ve lo que dice la app (para contar sin influencia);
 * la administradora ve las diferencias y aprueba.
 */
export function PantallaConteo({
  conteo,
  lineas: iniciales,
  productos,
  puedeContar,
  puedeAprobar,
}: {
  conteo: { id: string; nombre: string; estado: string };
  lineas: Linea[];
  productos: ProductoLigero[];
  puedeContar: boolean;
  puedeAprobar: boolean;
}) {
  const router = useRouter();
  const [lineas, setLineas] = useState(iniciales);
  const [guardados, setGuardados] = useState<Set<string>>(new Set(iniciales.filter((l) => l.contado).map((l) => l.productoId)));
  const [texto, setTexto] = useState("");
  const [soloFaltan, setSoloFaltan] = useState(false);
  const [error, setError] = useState<string>();
  const [ocupado, iniciar] = useTransition();
  const abierto = conteo.estado === "abierto";
  const contando = abierto && puedeContar;
  const contados = lineas.filter((l) => l.contado.trim() !== "").length;

  const diferencias = useMemo(
    () =>
      lineas
        .filter((l) => l.contado.trim() !== "" && leerNumero(l.contado) && !dec(l.sistema).eq(leerNumero(l.contado)!))
        .map((l) => ({ ...l, diferencia: leerNumero(l.contado)!.minus(l.sistema) })),
    [lineas],
  );
  const [aprobar, setAprobar] = useState<Set<string> | null>(null);
  const elegidos = aprobar ?? new Set(diferencias.map((d) => d.productoId));

  async function guardarLinea(productoId: string, valor: string) {
    const r = await anotarConteo(conteo.id, productoId, valor);
    if (!r.ok) return void toast.error(r.mensaje);
    setGuardados((s) => {
      const nuevo = new Set(s);
      if (valor.trim()) nuevo.add(productoId);
      else nuevo.delete(productoId);
      return nuevo;
    });
  }

  function irA(producto: ProductoLigero) {
    if (!lineas.some((l) => l.productoId === producto.id)) {
      setLineas((ls) => [{ productoId: producto.id, nombre: producto.nombre, unidadBase: producto.unidadBase, sistema: producto.stock, contado: "" }, ...ls]);
    }
    setTexto("");
    setSoloFaltan(false);
    window.setTimeout(() => document.getElementById(`contar-${producto.id}`)?.focus(), 50);
  }

  const resultados = buscarLocal(productos, texto, 6);
  const visibles = soloFaltan ? lineas.filter((l) => !l.contado.trim()) : lineas;

  return (
    <div className="grid max-w-2xl gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-3xl font-bold">{conteo.nombre}</h1>
        <Badge variant="outline">{t.estados[conteo.estado]}</Badge>
      </div>
      {error && <Aviso tipo="error">{error}</Aviso>}

      {contando && (
        <>
          <Campo id="conteo-buscar" etiqueta={t.buscar}>
            <Input
              id="conteo-buscar"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && resultados[0]) {
                  e.preventDefault();
                  irA(resultados[0].producto);
                }
              }}
              autoComplete="off"
            />
          </Campo>
          {texto.trim() && (
            <ul className="grid gap-1 rounded-lg border p-1">
              {resultados.map(({ producto }) => (
                <li key={producto.id}>
                  <button type="button" className="w-full rounded-md px-3 py-3 text-left text-base hover:bg-muted" onClick={() => irA(producto)}>
                    {producto.nombre}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-lg font-medium">{t.contados(contados, lineas.length)}</span>
            <label className="flex items-center gap-2">
              <Casilla checked={soloFaltan} onChange={(e) => setSoloFaltan(e.target.checked)} /> {t.soloFaltan}
            </label>
          </div>
          <ul className="grid gap-2">
            {visibles.map((l) => (
              <li key={l.productoId} className="flex items-center gap-3 rounded-xl border p-3">
                <label htmlFor={`contar-${l.productoId}`} className="flex-1 text-base font-medium">
                  {l.nombre}
                </label>
                <Input
                  id={`contar-${l.productoId}`}
                  className="w-28 text-right"
                  inputMode="decimal"
                  value={l.contado}
                  onChange={(e) => setLineas((ls) => ls.map((x) => (x.productoId === l.productoId ? { ...x, contado: e.target.value } : x)))}
                  onBlur={(e) => void guardarLinea(l.productoId, e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                />
                <Check className={cn("size-5 shrink-0", guardados.has(l.productoId) ? "text-green-600" : "invisible")} aria-hidden />
              </li>
            ))}
          </ul>
          <Button
            size="lg"
            disabled={ocupado || !contados}
            onClick={() =>
              iniciar(async () => {
                // Guarda lo último que se escribió antes de enviar.
                for (const l of lineas) if (l.contado.trim() && !guardados.has(l.productoId)) await guardarLinea(l.productoId, l.contado);
                const r = await enviarConteo(conteo.id);
                if (!r.ok) return setError(r.mensaje);
                toast.success(t.enviado);
                router.refresh();
              })
            }
          >
            <Send className="size-5" aria-hidden /> {t.enviar}
          </Button>
        </>
      )}

      {puedeAprobar && (conteo.estado === "por_aprobar" || (abierto && !puedeContar)) && (
        <section className="grid gap-3">
          <h2 className="text-xl font-semibold">{t.diferencias}</h2>
          {!diferencias.length ? (
            <p className="text-muted-foreground">{t.sinDiferencias}</p>
          ) : (
            <ul className="grid gap-2">
              {diferencias.map((d) => {
                const u = d.unidadBase as UnidadBase;
                return (
                  <li key={d.productoId}>
                    <label className="flex items-center gap-3 rounded-xl border p-3">
                      <Casilla
                        checked={elegidos.has(d.productoId)}
                        onChange={(e) => {
                          const s = new Set(elegidos);
                          if (e.target.checked) s.add(d.productoId);
                          else s.delete(d.productoId);
                          setAprobar(s);
                        }}
                      />
                      <span className="flex-1 font-medium">{d.nombre}</span>
                      <span className="text-sm text-muted-foreground">
                        {t.sistema} {cantidadConUnidad(d.sistema, u)} · {t.contado} {cantidadConUnidad(d.contado, u)}
                      </span>
                      <strong className={d.diferencia.isNegative() ? "text-destructive" : "text-green-700 dark:text-green-400"}>
                        {d.diferencia.isNegative() ? "−" : "+"}
                        {d.diferencia.abs().toString()}
                      </strong>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              size="lg"
              disabled={ocupado}
              onClick={() =>
                iniciar(async () => {
                  const r = await aprobarConteo(conteo.id, [...elegidos]);
                  if (!r.ok) return setError(r.mensaje);
                  toast.success(t.aprobado(r.datos!.cambios));
                  router.refresh();
                })
              }
            >
              {t.aprobar}
            </Button>
            <Button
              size="lg"
              variant="ghost"
              className="text-destructive"
              disabled={ocupado}
              onClick={() =>
                iniciar(async () => {
                  const r = await anularConteo(conteo.id);
                  if (!r.ok) return setError(r.mensaje);
                  toast.success(t.anulado);
                  router.push("/inventario/conteos");
                })
              }
            >
              {t.anular}
            </Button>
          </div>
        </section>
      )}
      {!abierto && conteo.estado !== "por_aprobar" && <p className="text-lg">{t.estados[conteo.estado]}</p>}
    </div>
  );
}
