"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Minus, Plus, Printer, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Aviso, Selector } from "@/components/formulario";
import { CodigoBarras } from "@/components/codigo-barras";
import { formatoDolares } from "@/lib/dinero";
import { textosCatalogo } from "@/lib/textos";
import { asignarCodigosInternos, buscarParaEtiquetas, marcarEtiquetasImpresas } from "@/server/acciones/catalogo";
import type { ItemEtiqueta } from "@/server/catalogo";
import { cn } from "cn";

const t = textosCatalogo.etiquetas;

/** Formatos de impresión (medidas en milímetros). */
const FORMATOS = {
  "a4-24": {
    nombre: "A4 · 24 etiquetas (70 × 37 mm)",
    pagina: "A4",
    margen: "4.5mm 0",
    columnas: 3,
    ancho: 70,
    alto: 36,
    hueco: 0,
    tipo: "etiqueta",
  },
  "a4-65": {
    nombre: "A4 · 65 etiquetas pequeñas (38 × 21 mm)",
    pagina: "A4",
    margen: "10.7mm 4.7mm",
    columnas: 5,
    ancho: 38.1,
    alto: 21.2,
    hueco: 2.5,
    tipo: "pequena",
  },
  termica: {
    nombre: "Impresora térmica · 50 × 25 mm",
    pagina: "50mm 25mm",
    margen: "0",
    columnas: 1,
    ancho: 50,
    alto: 25,
    hueco: 0,
    tipo: "etiqueta",
  },
  habladores: {
    nombre: "Habladores de percha · A4, 8 por hoja",
    pagina: "A4",
    margen: "10mm",
    columnas: 2,
    ancho: 95,
    alto: 68,
    hueco: 0,
    tipo: "hablador",
  },
} as const;
type Formato = keyof typeof FORMATOS;
type Fila = ItemEtiqueta & { cantidad: number };

export function HojaEtiquetas({ pendientes }: { pendientes: ItemEtiqueta[] }) {
  const router = useRouter();
  const [filas, setFilas] = useState<Fila[]>(() => pendientes.map((p) => ({ ...p, cantidad: 1 })));
  const [formato, setFormato] = useState<Formato>("a4-24");
  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState<ItemEtiqueta[]>([]);
  const [ocupado, iniciar] = useTransition();
  const f = FORMATOS[formato] ?? FORMATOS["a4-24"];

  useEffect(() => {
    const espera = setTimeout(async () => setResultados(texto.trim() ? await buscarParaEtiquetas(texto) : []), 300);
    return () => clearTimeout(espera);
  }, [texto]);

  function agregar(item: ItemEtiqueta) {
    setFilas((actual) =>
      actual.some((x) => x.presentacionId === item.presentacionId)
        ? actual.map((x) => (x.presentacionId === item.presentacionId ? { ...x, cantidad: x.cantidad + 1 } : x))
        : [...actual, { ...item, cantidad: 1 }],
    );
  }

  function imprimir() {
    const sinCodigo = filas.filter((x) => !x.codigo && x.esBase && !x.plu).map((x) => x.productoId);
    iniciar(async () => {
      if (sinCodigo.length) {
        const r = await asignarCodigosInternos(Array.from(new Set(sinCodigo)));
        if (!r.ok) return void toast.error(r.mensaje);
        setFilas((actual) => actual.map((x) => (!x.codigo && x.esBase ? { ...x, codigo: r.datos!.codigos[x.productoId] ?? null } : x)));
        await new Promise((ok) => setTimeout(ok, 150));
      }
      window.print();
    });
  }

  const etiquetas = filas.flatMap((x) => Array.from({ length: x.cantidad }, () => x));
  const pendientesIds = new Set(pendientes.map((p) => p.presentacionId));
  const impresasPendientes = filas.filter((x) => pendientesIds.has(x.presentacionId)).map((x) => x.presentacionId);

  return (
    <>
      <style>{`@page { size: ${f.pagina}; margin: ${f.margen}; }`}</style>

      <div className="grid gap-5 print:hidden">
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <label className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={t.agregar} aria-label={t.agregar} className="pl-10" />
          </label>
          <Selector value={formato} onChange={(e) => setFormato(e.target.value as Formato)} aria-label={t.formato} className="md:w-80">
            {Object.entries(FORMATOS).map(([clave, x]) => (
              <option key={clave} value={clave}>
                {x.nombre}
              </option>
            ))}
          </Selector>
        </div>

        {resultados.length > 0 && (
          <ul className="grid gap-1 rounded-xl border p-2">
            {resultados.map((r) => (
              <li key={r.presentacionId}>
                <button
                  type="button"
                  onClick={() => agregar(r)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left hover:bg-muted"
                >
                  <span>
                    {r.nombre} · <span className="text-muted-foreground">{r.presentacion}</span>
                  </span>
                  <span className="font-semibold">{r.precio ? formatoDolares(r.precio) : "—"}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {pendientes.length > 0 && (
          <Aviso tipo="info">
            {t.porReimprimir}: {pendientes.length}
          </Aviso>
        )}

        {filas.length === 0 ? (
          <p className="text-lg text-muted-foreground">{pendientes.length ? "" : `${t.ningunaPendiente} `}{t.vacia}</p>
        ) : (
          <ul className="grid gap-2">
            {filas.map((x) => (
              <li key={x.presentacionId} className="flex flex-wrap items-center gap-3 rounded-xl border p-3">
                <span className="min-w-40 flex-1">
                  <span className="font-semibold">{x.nombre}</span> · {x.presentacion}
                  {!x.codigo && x.esBase && !x.plu && <span className="block text-sm text-amber-600">{t.sinCodigoAviso}</span>}
                </span>
                <span className="font-bold">{x.precio ? formatoDolares(x.precio) : "—"}</span>
                <span className="flex items-center gap-1">
                  <Button size="icon" variant="outline" aria-label="Menos" onClick={() => setFilas(filas.map((y) => (y === x ? { ...y, cantidad: Math.max(1, y.cantidad - 1) } : y)))}>
                    <Minus className="size-4" />
                  </Button>
                  <span className="w-8 text-center text-lg">{x.cantidad}</span>
                  <Button size="icon" variant="outline" aria-label="Más" onClick={() => setFilas(filas.map((y) => (y === x ? { ...y, cantidad: y.cantidad + 1 } : y)))}>
                    <Plus className="size-4" />
                  </Button>
                </span>
                <Button size="icon" variant="ghost" aria-label="Quitar" onClick={() => setFilas(filas.filter((y) => y !== x))}>
                  <Trash2 className="size-5 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap gap-3">
          <Button size="lg" onClick={imprimir} disabled={!etiquetas.length || ocupado}>
            <Printer className="size-5" aria-hidden /> {t.imprimir} ({etiquetas.length})
          </Button>
          {impresasPendientes.length > 0 && (
            <Button
              size="lg"
              variant="outline"
              disabled={ocupado}
              onClick={() =>
                iniciar(async () => {
                  const r = await marcarEtiquetasImpresas(impresasPendientes);
                  if (r.ok) {
                    toast.success(r.mensaje);
                    router.refresh();
                  } else toast.error(r.mensaje);
                })
              }
            >
              {t.marcarImpresas}
            </Button>
          )}
        </div>

        {etiquetas.length > 0 && <p className="text-sm text-muted-foreground">Vista previa:</p>}
      </div>

      {/* Lo que se imprime (también se ve como vista previa, con su propio desplazamiento) */}
      {etiquetas.length > 0 && (
      <div className="-mx-4 overflow-x-auto px-4 print:m-0 print:overflow-visible print:p-0">
      <div
        className="zona-impresion grid w-max bg-white text-black"
        style={{
          gridTemplateColumns: `repeat(${f.columnas}, ${f.ancho}mm)`,
          gridAutoRows: `${f.alto}mm`,
          columnGap: `${f.hueco}mm`,
        }}
      >
        {etiquetas.map((x, i) => (
          <Etiqueta key={i} item={x} tipo={f.tipo} termica={formato === "termica"} />
        ))}
      </div>
      </div>
      )}
    </>
  );
}

function Etiqueta({ item, tipo, termica }: { item: Fila; tipo: string; termica: boolean }) {
  const nombre = item.esBase ? item.nombre : `${item.nombre} · ${item.presentacion}`;
  if (tipo === "hablador") {
    return (
      <div className="flex flex-col justify-between overflow-hidden border border-dashed border-gray-400 p-3">
        <p className="line-clamp-2 text-xl leading-tight font-bold">{nombre}</p>
        <p className="text-center text-6xl font-black">{item.precio ? formatoDolares(item.precio) : ""}</p>
        <div className="h-8">{item.codigo && <CodigoBarras codigo={item.codigo} alto={6} conTexto={false} />}</div>
      </div>
    );
  }
  const pequena = tipo === "pequena";
  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden px-[2mm] py-[1mm]",
        !termica && "border border-dashed border-gray-300",
        termica && "break-after-page",
      )}
    >
      <p className={cn("line-clamp-2 leading-tight font-semibold", pequena ? "text-[7pt]" : "text-[9pt]")}>{nombre}</p>
      <div className="flex min-h-0 flex-1 items-end justify-between gap-1">
        <div className="min-h-0 flex-1 self-stretch pt-[1mm]">
          {item.codigo ? (
            <CodigoBarras codigo={item.codigo} alto={pequena ? 6 : 9} className="block h-full" />
          ) : (
            item.plu && <p className="font-mono text-[10pt]">Cód. {item.plu}</p>
          )}
        </div>
        <p className={cn("shrink-0 font-black", pequena ? "text-[11pt]" : "text-[16pt]")}>
          {item.precio ? formatoDolares(item.precio) : ""}
        </p>
      </div>
    </div>
  );
}
