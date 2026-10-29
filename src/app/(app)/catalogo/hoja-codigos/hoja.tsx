"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ImageOff, Printer, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Casilla } from "@/components/formulario";
import { CodigoBarras } from "@/components/codigo-barras";
import { formatoDolares } from "@/lib/dinero";
import { textosCatalogo } from "@/lib/textos";
import { asignarCodigosInternos } from "@/server/acciones/catalogo";

const t = textosCatalogo.hoja;

type Producto = {
  id: string;
  nombre: string;
  presentacion: string;
  plu: string | null;
  precio: string | null;
  codigo: string | null;
  foto: string | null;
};

export function HojaCodigos({ productos, todos }: { productos: Producto[]; todos: boolean }) {
  const router = useRouter();
  const [ocupado, iniciar] = useTransition();
  const sinCodigo = productos.filter((p) => !p.codigo);

  return (
    <>
      <style>{`@page { size: A4; margin: 10mm; }`}</style>
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <label className="flex items-center gap-2 text-base">
          <Casilla
            checked={!todos}
            onChange={(e) => router.replace(e.target.checked ? "/catalogo/hoja-codigos" : "/catalogo/hoja-codigos?todos=1")}
          />
          {t.soloSinCodigo}
        </label>
        {sinCodigo.length > 0 && (
          <Button
            variant="outline"
            disabled={ocupado}
            onClick={() =>
              iniciar(async () => {
                const r = await asignarCodigosInternos(sinCodigo.map((p) => p.id));
                if (!r.ok) return void toast.error(r.mensaje);
                toast.success(`Listo: ${sinCodigo.length} código(s) generados.`);
                router.refresh();
              })
            }
          >
            <Wand2 className="size-5" aria-hidden /> {t.generar} ({sinCodigo.length})
          </Button>
        )}
        <Button onClick={() => window.print()} disabled={!productos.length || ocupado}>
          <Printer className="size-5" aria-hidden /> {t.imprimir}
        </Button>
      </div>

      {productos.length === 0 ? (
        <p className="text-lg text-muted-foreground print:hidden">No hay productos para esta hoja.</p>
      ) : (
        <div className="zona-impresion grid grid-cols-2 gap-2 bg-white p-2 text-black sm:grid-cols-3">
          <p className="col-span-full text-center text-[14pt] font-bold">Hoja de códigos — Sandry</p>
          {productos.map((p) => (
            <div key={p.id} className="flex break-inside-avoid items-center gap-2 rounded border border-gray-300 p-2">
              {p.foto ? (
                // eslint-disable-next-line @next/next/no-img-element -- foto del producto para reconocerlo en la hoja
                <img src={p.foto} alt="" className="size-[16mm] shrink-0 object-contain" />
              ) : (
                <span className="flex size-[16mm] shrink-0 items-center justify-center bg-gray-100">
                  <ImageOff className="size-6 text-gray-400" aria-hidden />
                </span>
              )}
              <div className="grid min-w-0 flex-1 gap-1">
                <p className="truncate text-[10pt] leading-tight font-bold">{p.nombre}</p>
                <p className="text-[8pt] text-gray-600">
                  {p.plu && `Cód. ${p.plu} · `}
                  {p.precio && formatoDolares(p.precio)}
                </p>
                <div className="h-[12mm]">
                  {p.codigo ? <CodigoBarras codigo={p.codigo} alto={8} className="block h-full" /> : <p className="text-[8pt] text-red-600">Sin código</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
