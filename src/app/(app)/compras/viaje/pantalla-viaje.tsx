"use client";

import { useCallback, useEffect, useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Car, CheckCircle2, CircleDashed, Fuel, ListChecks, ShoppingBag, Truck } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Aviso, Campo, Casilla, Selector } from "@/components/formulario";
import { FormularioCompra } from "@/components/compras/formulario-compra";
import { cantidadConUnidad, type UnidadBase } from "@/lib/catalogo";
import { totalCompra, type ProductoLigero } from "@/lib/compras";
import { encolar, enviarPendientes, pendientes, quitar, suscribir, type Operacion } from "@/lib/cola";
import { borrarBorrador, guardarBorrador, leerBorrador } from "@/lib/borradores";
import { formatoDolares, leerNumero } from "@/lib/dinero";
import { textos, textosCompras } from "@/lib/textos";
import {
  iniciarViaje,
  marcarListaViaje,
  registrarCompra,
  registrarGasto,
  type DatosGasto,
} from "@/server/acciones/abastecimiento";
import type { DatosCompra } from "@/lib/compras";
import { cn } from "cn";

const t = textosCompras.viaje;

type ItemLista = { productoId: string; nombre: string; unidadBase: string; cantidad: string | null; tachado: boolean };
export type EstadoViaje = {
  id: string;
  inicio: string;
  lista: ItemLista[];
  compras: { id: string; lugar: string; total: string }[];
  gastos: { id: string; categoria: string; monto: string }[];
};
type Datos = {
  productos: ProductoLigero[];
  proveedores: { id: string; nombre: string }[];
  cuentas: { id: string; nombre: string; tipo: string }[];
  categorias: { id: string; nombre: string; esTransporte: boolean }[];
};

const CLAVE_VIAJE = "viaje";
const CLAVE_DATOS = "viaje-datos";

/** Envía una operación pendiente al servidor. */
async function enviar(op: Operacion): Promise<{ ok: true } | { ok: false; mensaje: string }> {
  const d = op.datos as Record<string, unknown>;
  const r =
    op.tipo === "iniciar_viaje"
      ? await iniciarViaje(String(d.id), d.lista as { productoId: string; cantidad: string | null }[])
      : op.tipo === "compra"
        ? await registrarCompra(d as unknown as DatosCompra)
        : op.tipo === "gasto"
          ? await registrarGasto(d as unknown as DatosGasto)
          : await marcarListaViaje(String(d.viajeId), String(d.productoId), Boolean(d.tachado));
  return r.ok ? { ok: true } : { ok: false, mensaje: r.mensaje };
}

const sinPendientes: Operacion[] = [];
function usePendientes(): Operacion[] {
  return useSyncExternalStore(suscribir, pendientesCacheados, () => sinPendientes);
}
let cache: { json: string; lista: Operacion[] } = { json: "[]", lista: sinPendientes };
function pendientesCacheados(): Operacion[] {
  const lista = pendientes();
  const json = JSON.stringify(lista);
  if (json !== cache.json) cache = { json, lista };
  return cache.lista;
}

/**
 * El viaje de compras en el celular. Todo se guarda primero en el dispositivo y
 * se envía cuando hay señal; nada se pierde si se va la conexión.
 */
export function PantallaViaje({
  datos: datosServidor,
  enCurso,
  sugerida,
  puedeCrearProducto,
  puedeCrearLugar,
}: {
  datos: Datos;
  enCurso: EstadoViaje | null;
  sugerida: ItemLista[];
  puedeCrearProducto: boolean;
  puedeCrearLugar: boolean;
}) {
  const [viaje, setViaje] = useState<EstadoViaje | null>(null);
  const [cargado, setCargado] = useState(false);
  const [vista, setVista] = useState<"lista" | "comprar" | "gasto">("lista");
  const [conLista, setConLista] = useState(sugerida.length > 0);
  const cola = usePendientes();
  const datos = datosServidor;

  const enviarAhora = useCallback(async () => {
    if (!navigator.onLine) return;
    const r = await enviarPendientes(enviar);
    if (r.enviados) toast.success(`${r.enviados} enviado(s).`);
  }, []);

  // Al abrir: guarda los productos en el celular y recupera el viaje.
  useEffect(() => {
    guardarBorrador(CLAVE_DATOS, datosServidor);
    const local = leerBorrador<EstadoViaje>(CLAVE_VIAJE)?.datos ?? null;
    const iniciaPendiente = local && pendientes().some((op) => op.tipo === "iniciar_viaje" && op.id === local.id);
    if (local && (iniciaPendiente || local.id === enCurso?.id)) setViaje(local);
    else if (enCurso) setViaje(enCurso);
    else if (local) borrarBorrador(CLAVE_VIAJE); // ya se recibió en otro dispositivo
    setCargado(true);
    void enviarAhora();
    const alVolver = () => void enviarAhora();
    window.addEventListener("online", alVolver);
    const reloj = window.setInterval(alVolver, 20_000);
    return () => {
      window.removeEventListener("online", alVolver);
      window.clearInterval(reloj);
    };
  }, [datosServidor, enCurso, enviarAhora]);

  function actualizar(cambio: (v: EstadoViaje) => EstadoViaje) {
    setViaje((v) => {
      if (!v) return v;
      const nuevo = cambio(v);
      guardarBorrador(CLAVE_VIAJE, nuevo);
      return nuevo;
    });
  }

  function empezar() {
    const nuevo: EstadoViaje = {
      id: crypto.randomUUID(),
      inicio: new Date().toISOString(),
      lista: conLista ? sugerida : [],
      compras: [],
      gastos: [],
    };
    guardarBorrador(CLAVE_VIAJE, nuevo);
    setViaje(nuevo);
    encolar({
      id: nuevo.id,
      tipo: "iniciar_viaje",
      datos: { id: nuevo.id, lista: nuevo.lista.map((l) => ({ productoId: l.productoId, cantidad: l.cantidad })) },
      descripcion: t.titulo,
    });
    void enviarAhora();
  }

  function tachar(productoId: string, tachado: boolean) {
    if (!viaje) return;
    actualizar((v) => ({ ...v, lista: v.lista.map((l) => (l.productoId === productoId ? { ...l, tachado } : l)) }));
    encolar({
      id: `tachar:${viaje.id}:${productoId}`,
      tipo: "tachar",
      datos: { viajeId: viaje.id, productoId, tachado },
      descripcion: "Lista",
    });
    void enviarAhora();
  }

  if (!cargado) return <p className="text-lg">{textos.general.cargando}</p>;

  if (!viaje) {
    return (
      <div className="grid max-w-xl gap-5">
        <p className="text-lg text-muted-foreground">{t.ayuda}</p>
        {sugerida.length > 0 && (
          <label className="flex items-center gap-3 text-lg">
            <Casilla checked={conLista} onChange={(e) => setConLista(e.target.checked)} />
            {t.conLista} ({sugerida.length})
          </label>
        )}
        <Button size="lg" className="h-16 text-xl" onClick={empezar}>
          <Car className="size-6" aria-hidden /> {t.iniciar}
        </Button>
      </div>
    );
  }

  const enCola = new Set(cola.map((op) => op.id));
  const pendientesViaje = cola.filter((op) => op.id === viaje.id || (op.datos as { viajeId?: string })?.viajeId === viaje.id || op.tipo === "iniciar_viaje");
  const comprado = viaje.compras.reduce((s, c) => s + Number(c.total), 0);
  const gastado = viaje.gastos.reduce((s, g) => s + Number(g.monto), 0);

  return (
    <div className="grid max-w-2xl gap-5">
      {pendientesViaje.length > 0 && (
        <Aviso tipo="info">
          <div className="grid gap-2">
            <span>{t.pendientes(pendientesViaje.length)}</span>
            {pendientesViaje.filter((op) => op.error).map((op) => (
              <span key={op.id} className="flex flex-wrap items-center gap-2 text-destructive">
                {op.descripcion}: {op.error}
                <Button size="sm" variant="outline" onClick={() => quitar(op.id)}>
                  {t.quitar}
                </Button>
              </span>
            ))}
            <Button size="sm" variant="outline" className="justify-self-start" onClick={() => void enviarAhora()}>
              {t.reintentar}
            </Button>
          </div>
        </Aviso>
      )}

      <div className="grid grid-cols-3 gap-2">
        {(
          [
            ["lista", t.lista, ListChecks],
            ["comprar", t.comprarAqui, ShoppingBag],
            ["gasto", t.gasto, Fuel],
          ] as const
        ).map(([clave, etiqueta, Icono]) => (
          <button
            key={clave}
            type="button"
            onClick={() => setVista(clave)}
            aria-pressed={vista === clave}
            className={cn(
              "flex min-h-20 flex-col items-center justify-center gap-1 rounded-xl border p-2 text-center text-sm font-medium",
              vista === clave ? "border-primary bg-primary text-primary-foreground" : "bg-background",
            )}
          >
            <Icono className="size-6" aria-hidden />
            {etiqueta}
          </button>
        ))}
      </div>

      {vista === "lista" && (
        <section className="grid gap-3">
          {viaje.lista.length === 0 ? (
            <p className="text-muted-foreground">{t.listaVacia}</p>
          ) : (
            <ul className="grid gap-1">
              {viaje.lista.map((l) => (
                <li key={l.productoId}>
                  <label className={cn("flex items-center gap-3 rounded-lg border p-3 text-lg", l.tachado && "text-muted-foreground line-through")}>
                    <Casilla checked={l.tachado} onChange={(e) => tachar(l.productoId, e.target.checked)} />
                    <span className="flex-1">{l.nombre}</span>
                    {l.cantidad && <span className="text-base">{cantidadConUnidad(l.cantidad, l.unidadBase as UnidadBase)}</span>}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {vista === "comprar" && (
        <FormularioCompra
          productos={datos.productos}
          proveedores={datos.proveedores}
          cuentas={datos.cuentas}
          viajeId={viaje.id}
          claveBorrador={`compra-viaje-${viaje.id}`}
          permitirSoloTotal
          puedeCrearProducto={puedeCrearProducto}
          puedeCrearLugar={puedeCrearLugar}
          onGuardar={async (compra) => {
            const lugar = datos.proveedores.find((p) => p.id === compra.proveedorId)?.nombre ?? textosCompras.lista.sinLugar;
            const total = totalCompra(compra).toString();
            encolar({ id: compra.id, tipo: "compra", datos: compra, descripcion: `${lugar} ${formatoDolares(total)}` });
            const comprados = new Set(compra.lineas.map((l) => l.productoId));
            actualizar((v) => ({
              ...v,
              compras: [...v.compras, { id: compra.id, lugar, total }],
              lista: v.lista.map((l) => (comprados.has(l.productoId) ? { ...l, tachado: true } : l)),
            }));
            for (const productoId of comprados) {
              if (viaje.lista.some((l) => l.productoId === productoId && !l.tachado)) {
                encolar({ id: `tachar:${viaje.id}:${productoId}`, tipo: "tachar", datos: { viajeId: viaje.id, productoId, tachado: true }, descripcion: "Lista" });
              }
            }
            toast.success(navigator.onLine ? textosCompras.formulario.guardada : textosCompras.formulario.guardadaSinSenal);
            void enviarAhora();
            setVista("lista");
            return { ok: true };
          }}
        />
      )}

      {vista === "gasto" && (
        <FormularioGasto
          categorias={datos.categorias}
          cuentas={datos.cuentas}
          onGuardar={(gasto, categoria) => {
            encolar({ id: gasto.id, tipo: "gasto", datos: { ...gasto, viajeId: viaje.id }, descripcion: `${categoria} ${formatoDolares(gasto.monto)}` });
            actualizar((v) => ({ ...v, gastos: [...v.gastos, { id: gasto.id, categoria, monto: leerNumero(gasto.monto)!.toString() }] }));
            toast.success(t.gastoGuardado);
            void enviarAhora();
            setVista("lista");
          }}
        />
      )}

      <section className="grid gap-2 rounded-xl border p-4">
        <h2 className="text-xl font-semibold">{t.resumen}</h2>
        {viaje.compras.length === 0 && viaje.gastos.length === 0 && <p className="text-muted-foreground">{t.sinCompras}</p>}
        <ul className="grid gap-1">
          {viaje.compras.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                {enCola.has(c.id) ? <CircleDashed className="size-4 text-amber-600" aria-label="Sin enviar" /> : <CheckCircle2 className="size-4 text-green-600" aria-label="Enviada" />}
                <Truck className="size-4 text-muted-foreground" aria-hidden /> {c.lugar}
              </span>
              <span className="font-medium">{formatoDolares(c.total)}</span>
            </li>
          ))}
          {viaje.gastos.map((g) => (
            <li key={g.id} className="flex items-center justify-between gap-2 text-muted-foreground">
              <span className="flex items-center gap-2">
                {enCola.has(g.id) ? <CircleDashed className="size-4 text-amber-600" aria-label="Sin enviar" /> : <CheckCircle2 className="size-4 text-green-600" aria-label="Enviado" />}
                <Fuel className="size-4" aria-hidden /> {g.categoria}
              </span>
              <span>{formatoDolares(g.monto)}</span>
            </li>
          ))}
        </ul>
        <div className="flex justify-between border-t pt-2 text-lg font-semibold">
          <span>{t.totalComprado}</span>
          <span>{formatoDolares(comprado)}</span>
        </div>
        {gastado > 0 && (
          <div className="flex justify-between text-base">
            <span>{t.totalGastos}</span>
            <span>{formatoDolares(gastado)}</span>
          </div>
        )}
      </section>

      {pendientesViaje.length > 0 ? (
        <p className="text-muted-foreground">{t.necesitaSenal}</p>
      ) : (
        <Link href={`/compras/viaje/${viaje.id}`} className={buttonVariants({ size: "lg", className: "h-14 text-lg" })}>
          <Truck className="size-6" aria-hidden /> {t.recibir}
        </Link>
      )}
    </div>
  );
}

function FormularioGasto({
  categorias,
  cuentas,
  onGuardar,
}: {
  categorias: { id: string; nombre: string; esTransporte: boolean }[];
  cuentas: { id: string; nombre: string }[];
  onGuardar: (gasto: Omit<DatosGasto, "viajeId">, categoria: string) => void;
}) {
  const delViaje = categorias.filter((c) => c.esTransporte);
  const [categoriaId, setCategoriaId] = useState(delViaje[0]?.id ?? "");
  const [monto, setMonto] = useState("");
  const [cuentaId, setCuentaId] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [error, setError] = useState<string>();
  const [, iniciar] = useTransition();
  return (
    <form
      className="grid gap-4 rounded-xl border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const n = leerNumero(monto);
        if (!n || n.lte(0)) return setError("Escribe un monto mayor que 0.");
        if (!cuentaId) return setError("Elige de qué cuenta salió el dinero.");
        setError(undefined);
        iniciar(() => {
          onGuardar({ id: crypto.randomUUID(), categoriaId, monto, cuentaId, descripcion }, categorias.find((c) => c.id === categoriaId)?.nombre ?? "");
        });
      }}
    >
      {error && <Aviso tipo="error">{error}</Aviso>}
      <div className="grid grid-cols-2 gap-2">
        {delViaje.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategoriaId(c.id)}
            aria-pressed={categoriaId === c.id}
            className={cn("h-12 rounded-lg border text-base", categoriaId === c.id ? "border-primary bg-primary text-primary-foreground" : "bg-background")}
          >
            {c.nombre}
          </button>
        ))}
      </div>
      <Campo id="gasto-monto" etiqueta={t.monto}>
        <Input id="gasto-monto" inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="$0.00" />
      </Campo>
      <Campo id="gasto-cuenta" etiqueta={textosCompras.formulario.cuenta}>
        <Selector id="gasto-cuenta" value={cuentaId} onChange={(e) => setCuentaId(e.target.value)}>
          <option value="">—</option>
          {cuentas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </Selector>
      </Campo>
      <Campo id="gasto-detalle" etiqueta={t.descripcion} opcional>
        <Input id="gasto-detalle" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
      </Campo>
      <Button type="submit" size="lg">
        {textos.general.guardar}
      </Button>
    </form>
  );
}

