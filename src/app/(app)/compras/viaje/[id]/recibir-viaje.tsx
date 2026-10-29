"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Aviso, Campo } from "@/components/formulario";
import { BuscarProducto, TarjetaLinea } from "@/components/compras/formulario-compra";
import { AvisosCosto } from "@/components/compras/avisos-costo";
import { costoTotalLinea, lineaVacia, type LineaCompra, type ProductoLigero } from "@/lib/compras";
import { borrarBorrador, leerBorrador } from "@/lib/borradores";
import { dec, formatoDolares } from "@/lib/dinero";
import { textos, textosCompras } from "@/lib/textos";
import { detallarCompra, recibirViaje, type AvisoCosto } from "@/server/acciones/abastecimiento";
import type { CompraDetalle } from "@/server/abastecimiento";

const t = textosCompras.viaje;

/** Al llegar a la tienda: detallar lo que falta, revisar qué llegó y confirmar. */
export function RecibirViaje({
  viajeId,
  compras,
  productos,
  puedeCrearProducto,
}: {
  viajeId: string;
  compras: CompraDetalle[];
  productos: ProductoLigero[];
  puedeCrearProducto: boolean;
}) {
  const router = useRouter();
  const porRecibir = compras.filter((c) => c.estado === "por_recibir");
  const sinDetalle = porRecibir.filter((c) => c.lineas.length === 0);
  const lineas = porRecibir.flatMap((c) => c.lineas.map((l) => ({ ...l, lugar: c.lugar })));
  const [valores, setValores] = useState(() =>
    Object.fromEntries(lineas.map((l) => [l.id, { recibido: l.cantidad, danados: dec(l.danados).isZero() ? "" : l.danados }])),
  );
  const [avisos, setAvisos] = useState<AvisoCosto[] | null>(null);
  const [error, setError] = useState<string>();
  const [guardando, iniciar] = useTransition();

  if (avisos) {
    return (
      <div className="grid gap-4">
        <Aviso tipo="exito">{t.recibido}</Aviso>
        <AvisosCosto avisos={avisos} />
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      {sinDetalle.map((c) => (
        <DetallarCompra key={c.id} compra={c} productos={productos} puedeCrearProducto={puedeCrearProducto} onListo={() => router.refresh()} />
      ))}

      {lineas.length > 0 && (
        <section className="grid gap-3">
          <p className="text-muted-foreground">{t.recibirAyuda}</p>
          {lineas.map((l) => (
            <div key={l.id} className="grid gap-2 rounded-xl border p-4">
              <div className="flex flex-wrap justify-between gap-2">
                <span className="text-lg font-semibold">{l.producto}</span>
                <span className="text-sm text-muted-foreground">{l.lugar}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {t.pedido}: {l.cantidad} × {l.presentacion}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Campo id={`llego-${l.id}`} etiqueta={`${t.llego} (${l.presentacion})`}>
                  <Input
                    id={`llego-${l.id}`}
                    inputMode="decimal"
                    value={valores[l.id].recibido}
                    onChange={(e) => setValores({ ...valores, [l.id]: { ...valores[l.id], recibido: e.target.value } })}
                  />
                </Campo>
                <Campo id={`danados-${l.id}`} etiqueta={textosCompras.formulario.danados(l.unidadBase)} opcional>
                  <Input
                    id={`danados-${l.id}`}
                    inputMode="decimal"
                    value={valores[l.id].danados}
                    onChange={(e) => setValores({ ...valores, [l.id]: { ...valores[l.id], danados: e.target.value } })}
                  />
                </Campo>
              </div>
            </div>
          ))}
        </section>
      )}

      {error && <Aviso tipo="error">{error}</Aviso>}
      <Button
        size="lg"
        className="h-14 text-lg"
        disabled={guardando || sinDetalle.length > 0}
        onClick={() =>
          iniciar(async () => {
            setError(undefined);
            const r = await recibirViaje(
              viajeId,
              lineas.map((l) => ({ lineaId: l.id, recibido: valores[l.id].recibido, danados: valores[l.id].danados })),
            );
            if (!r.ok) return setError(r.mensaje);
            if (leerBorrador<{ id: string }>("viaje")?.datos.id === viajeId) borrarBorrador("viaje");
            toast.success(t.recibido);
            setAvisos(r.datos!.avisos);
            router.refresh();
          })
        }
      >
        <Truck className="size-6" aria-hidden /> {guardando ? textos.general.guardando : t.confirmar}
      </Button>
    </div>
  );
}

function DetallarCompra({
  compra,
  productos,
  puedeCrearProducto,
  onListo,
}: {
  compra: CompraDetalle;
  productos: ProductoLigero[];
  puedeCrearProducto: boolean;
  onListo: () => void;
}) {
  const [lista, setLista] = useState(productos);
  const [lineas, setLineas] = useState<LineaCompra[]>([]);
  const [error, setError] = useState<string>();
  const [guardando, iniciar] = useTransition();
  const porId = new Map(lista.map((p) => [p.id, p]));
  const suma = lineas.reduce((s, l) => s.plus(costoTotalLinea(l)), dec(0));
  const lugar = compra.lugar || textosCompras.lista.sinLugar;

  return (
    <section className="grid gap-3 rounded-xl border border-amber-500/50 p-4">
      <h2 className="text-xl font-semibold">{t.falta(lugar)}</h2>
      <p className="text-muted-foreground">
        {t.pagado(lugar)}: <strong>{formatoDolares(compra.total)}</strong> · {textosCompras.formulario.total}: {formatoDolares(suma)}
      </p>
      <BuscarProducto
        productos={lista}
        puedeCrear={puedeCrearProducto}
        onElegir={(p, presentacionId) => setLineas([lineaVacia(p, presentacionId), ...lineas])}
        onCreado={(p) => {
          setLista([...lista, p]);
          setLineas([lineaVacia(p), ...lineas]);
        }}
      />
      {lineas.map((l) => {
        const p = porId.get(l.productoId);
        return p ? (
          <TarjetaLinea
            key={l.clave}
            linea={l}
            producto={p}
            onCambiar={(c) => setLineas(lineas.map((x) => (x.clave === l.clave ? { ...x, ...c } : x)))}
            onQuitar={() => setLineas(lineas.filter((x) => x.clave !== l.clave))}
          />
        ) : null;
      })}
      {error && <Aviso tipo="error">{error}</Aviso>}
      <Button
        disabled={guardando || !lineas.length}
        onClick={() =>
          iniciar(async () => {
            const r = await detallarCompra(compra.id, lineas);
            if (!r.ok) return setError(r.mensaje);
            toast.success(r.mensaje);
            onListo();
          })
        }
      >
        {guardando ? textos.general.guardando : t.detallar}
      </Button>
    </section>
  );
}
