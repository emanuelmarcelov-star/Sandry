"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, CircleDollarSign, Minus, Pause, Plus, Printer, Repeat, Search, ShoppingCart, Trash2, Undo2, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Aviso, Campo, Selector } from "@/components/formulario";
import { SoloCliente } from "@/components/solo-cliente";
import { EscanerCamara } from "@/components/ventas/escaner-camara";
import { pitido, useLectorGlobal } from "@/components/ventas/lector";
import { buscarLocal } from "@/lib/compras";
import { cantidadConUnidad } from "@/lib/catalogo";
import { borrarBorrador, guardarBorrador, leerBorrador } from "@/lib/borradores";
import { dec, formatoDolares, leerNumero } from "@/lib/dinero";
import {
  agregar,
  agregarVarios,
  cantidadPorMonto,
  carritoVacio,
  leerCodigoBalanza,
  totales,
  totalLinea,
  type Carrito,
  type PagoVenta,
  type ProductoVenta,
} from "@/lib/ventas";
import { textos, textosVentas } from "@/lib/textos";
import { abrirCaja, crearProductoPendiente, registrarVenta, type VentaRegistrada } from "@/server/acciones/ventas";
import type { AjustesVenta, ClienteResumen, FormaPago } from "@/server/ventas";
import { DialogoCobro } from "./dialogo-cobro";
import { cn } from "cn";

const t = textosVentas.pos;

type Props = {
  productos: ProductoVenta[];
  categorias: { id: string; nombre: string }[];
  favoritos: string[];
  formas: FormaPago[];
  clientes: ClienteResumen[];
  ajustes: AjustesVenta;
  cajaAbierta: boolean;
  puedeAbrirCaja: boolean;
  puedeCrearProducto: boolean;
};

export function PantallaVenta(props: Props) {
  // El carrito vive en el dispositivo (si se cierra la pantalla no se pierde).
  return (
    <SoloCliente mientras={<p className="text-lg">{textos.general.cargando}</p>}>
      <Venta {...props} />
    </SoloCliente>
  );
}

const CLAVE_CARRITO = "carrito";
const CLAVE_ESPERA = "ventas-espera";
const CLAVE_ULTIMA = "ultima-venta";

function horaEnRango(desde: string | null, hasta: string | null): boolean {
  if (!desde || !hasta) return true;
  const ahora = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Guayaquil", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
  return desde <= hasta ? ahora >= desde && ahora <= hasta : ahora >= desde || ahora <= hasta;
}

function Venta({ productos: iniciales, categorias, favoritos, formas, clientes, ajustes, cajaAbierta, puedeAbrirCaja, puedeCrearProducto }: Props) {
  const router = useRouter();
  const [productos, setProductos] = useState(iniciales);
  const [carrito, setCarritoEstado] = useState<Carrito>(() => leerBorrador<Carrito>(CLAVE_CARRITO)?.datos ?? carritoVacio());
  const [espera, setEsperaEstado] = useState<Carrito[]>(() => leerBorrador<Carrito[]>(CLAVE_ESPERA)?.datos ?? []);
  const [texto, setTexto] = useState("");
  const [cantidadSiguiente, setCantidadSiguiente] = useState<string | null>(null);
  const [categoria, setCategoria] = useState<string | null>(null);
  const [consultar, setConsultar] = useState(false);
  const [camara, setCamara] = useState(false);
  const [elegir, setElegir] = useState<ProductoVenta | null>(null);
  const [peso, setPeso] = useState<{ producto: ProductoVenta; presentacionId: string } | null>(null);
  const [varios, setVarios] = useState(false);
  const [noEncontrado, setNoEncontrado] = useState<string | null>(null);
  const [cobro, setCobro] = useState<{ id: string; pidePin: boolean; error?: string } | null>(null);
  const [resultado, setResultado] = useState<(VentaRegistrada & { texto: string; telefono: string }) | null>(null);
  const [verCarrito, setVerCarrito] = useState(false);
  const buscador = useRef<HTMLInputElement>(null);
  const porId = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos]);

  const setCarrito = useCallback((c: Carrito) => {
    setCarritoEstado(c);
    if (c.lineas.length || c.clienteId) guardarBorrador(CLAVE_CARRITO, c);
    else borrarBorrador(CLAVE_CARRITO);
  }, []);
  const setEspera = (lista: Carrito[]) => {
    setEsperaEstado(lista);
    guardarBorrador(CLAVE_ESPERA, lista);
  };

  const { total } = totales(carrito);

  // ------------------------------------------------------------------ agregar

  const agregarProducto = useCallback(
    (p: ProductoVenta, presentacionId?: string, cantidad?: string, desdeLector = false) => {
      const opciones = p.presentaciones.filter((x) => x.paraVenta);
      if (!presentacionId && !desdeLector && opciones.length > 1 && !consultar) return setElegir(p);
      const pres = p.presentaciones.find((x) => x.id === presentacionId) ?? opciones.find((x) => x.esBase) ?? opciones[0] ?? p.presentaciones[0];
      if (consultar) {
        pitido();
        return void toast.info(
          opciones.map((x) => `${x.esBase ? p.nombre : `${p.nombre} (${x.nombre})`}: ${x.precio ? formatoDolares(x.precio) : "—"}`).join(" · "),
          { duration: 6000 },
        );
      }
      if (!pres.precio) {
        pitido(false);
        return void toast.error(t.sinPrecio(p.nombre));
      }
      // Por libra o kilo: se pregunta cuánto (o por cuánto dinero).
      if (!cantidad && !cantidadSiguiente && p.unidadBase !== "unidad" && pres.esBase) return setPeso({ producto: p, presentacionId: pres.id });

      const cuanto = cantidad ?? cantidadSiguiente ?? "1";
      setCantidadSiguiente(null);
      const nuevo = agregar(carrito, p, pres.id, cuanto);
      const enCarrito = nuevo.lineas
        .filter((l) => l.productoId === p.id)
        .reduce((s, l) => s.plus(dec(l.cantidad).times(l.factor)), dec(0));
      if (enCarrito.gt(p.stock)) {
        if (ajustes.ventaSinStock === "bloquear") {
          pitido(false);
          return void toast.error(t.sinStock(p.nombre));
        }
        toast.warning(t.sinStock(p.nombre));
      }
      if (p.soloMayores) {
        toast.warning(t.mayores(p.nombre));
        if (!horaEnRango(ajustes.alcoholDesde, ajustes.alcoholHasta)) toast.warning(t.horarioAlcohol(ajustes.alcoholDesde!, ajustes.alcoholHasta!));
      }
      pitido();
      setCarrito(nuevo);
    },
    [ajustes, cantidadSiguiente, carrito, consultar, setCarrito],
  );

  /** Lo que llega del lector, la cámara o el buscador cuando es un código. */
  const leerCodigo = useCallback(
    (codigo: string): boolean => {
      const limpio = codigo.trim();
      for (const p of productos) {
        const pres = p.presentaciones.find((x) => x.codigos.includes(limpio));
        if (pres) {
          agregarProducto(p, pres.id, undefined, true);
          return true;
        }
      }
      const balanza = leerCodigoBalanza(limpio);
      if (balanza) {
        const p = productos.find((x) => x.plu === balanza.plu);
        const base = p?.presentaciones.find((x) => x.esBase);
        if (p && base?.precio) {
          agregarProducto(p, base.id, cantidadPorMonto(balanza.precio, base.precio) ?? "1", true);
          return true;
        }
      }
      if (/^\d{6,}$/.test(limpio)) {
        pitido(false);
        setNoEncontrado(limpio);
        return true;
      }
      return false;
    },
    [agregarProducto, productos],
  );

  useLectorGlobal(leerCodigo, !cobro && !camara && !resultado);

  const resultados = useMemo(() => buscarLocal(productos, texto.replace(/^\d+(?:[.,]\d+)?\*/, ""), 8), [productos, texto]);

  function enviarBusqueda() {
    const m = texto.match(/^(\d+(?:[.,]\d+)?)\*(.*)$/);
    const cantidad = m ? (leerNumero(m[1])?.toString() ?? null) : null;
    const resto = (m ? m[2] : texto).trim();
    if (m && !resto) {
      setCantidadSiguiente(cantidad);
      setTexto("");
      return;
    }
    if (cantidad) setCantidadSiguiente(cantidad);
    if (!resto) return;
    const r = buscarLocal(productos, resto, 1);
    if (r[0]) agregarProducto(r[0].producto, r[0].presentacionId, cantidad ?? undefined, Boolean(r[0].presentacionId));
    else if (!leerCodigo(resto)) {
      pitido(false);
      toast.error(textosVentas.pos.vacio);
    }
    setTexto("");
  }

  // ------------------------------------------------------------------ atajos de teclado

  useEffect(() => {
    const atajos = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        buscador.current?.focus();
      } else if (e.key === "F4" && carrito.lineas.length && !cobro) {
        e.preventDefault();
        setCobro({ id: crypto.randomUUID(), pidePin: false });
      } else if (e.key === "F8" && carrito.lineas.length) {
        e.preventDefault();
        setEspera([...espera, carrito]);
        setCarrito(carritoVacio());
      }
    };
    window.addEventListener("keydown", atajos);
    return () => window.removeEventListener("keydown", atajos);
  });

  // ------------------------------------------------------------------ cobrar

  async function confirmar(pagos: PagoVenta[], pin: string) {
    if (!cobro) return;
    const r = await registrarVenta(cobro.id, carrito, pagos, pin || undefined);
    if (!r.ok) {
      setCobro({ ...cobro, pidePin: cobro.pidePin || Boolean(r.pin), error: r.mensaje });
      pitido(false);
      return;
    }
    const v = r.datos!;
    for (const p of v.sinStock) toast.warning(t.sinStock(p));
    const cliente = clientes.find((c) => c.id === carrito.clienteId);
    const resumen = [
      `${ajustes.tienda} — Venta #${v.numero}`,
      ...carrito.lineas.map((l) => `${l.cantidad} × ${l.descripcion}: ${formatoDolares(totalLinea(l))}`),
      `Total: ${formatoDolares(total)}`,
      ajustes.ticketMensaje,
    ].join("\n");
    guardarBorrador(CLAVE_ULTIMA, carrito);
    setCarrito(carritoVacio());
    setCobro(null);
    setVerCarrito(false);
    setResultado({ ...v, texto: resumen, telefono: cliente?.telefono ?? "" });
    router.refresh();
  }

  if (!cajaAbierta) return <AbrirCaja puede={puedeAbrirCaja} />;

  const visibles = categoria
    ? productos.filter((p) => p.categoriaId === categoria)
    : (favoritos.map((id) => porId.get(id)).filter(Boolean) as ProductoVenta[]).concat(favoritos.length ? [] : productos.slice(0, 24));

  const panelCarrito = (
    <PanelCarrito
      carrito={carrito}
      clientes={clientes}
      onCambiar={setCarrito}
      onCobrar={() => setCobro({ id: crypto.randomUUID(), pidePin: false })}
    />
  );

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_22rem] md:items-start">
      <section className="grid gap-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              ref={buscador}
              aria-label={t.buscar}
              placeholder={t.buscar}
              className="pl-10"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  enviarBusqueda();
                }
              }}
              autoComplete="off"
              enterKeyHint="search"
            />
          </div>
          <Button variant="outline" size="lg" onClick={() => setCamara(true)} aria-label={t.escanear}>
            <Camera className="size-5" aria-hidden /> <span className="hidden sm:inline">{t.escanear}</span>
          </Button>
        </div>
        {cantidadSiguiente && (
          <p className="text-base font-medium">
            × {cantidadSiguiente} <button className="ml-2 text-sm underline" onClick={() => setCantidadSiguiente(null)}>{textos.general.cancelar}</button>
          </p>
        )}
        {consultar && <Aviso tipo="info">{t.consultando}</Aviso>}

        {texto.trim() ? (
          <ul className="grid gap-1 rounded-lg border p-1">
            {resultados.map(({ producto, presentacionId }) => (
              <li key={producto.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-3 text-left text-base hover:bg-muted"
                  onClick={() => {
                    agregarProducto(producto, presentacionId);
                    setTexto("");
                    buscador.current?.focus();
                  }}
                >
                  <span className="font-medium">{producto.nombre}</span>
                  <span className="text-sm text-muted-foreground">
                    {formatoDolares(producto.presentaciones.find((x) => x.esBase)?.precio ?? 0)} · {cantidadConUnidad(producto.stock, producto.unidadBase)}
                  </span>
                </button>
              </li>
            ))}
            {!resultados.length && <li className="px-3 py-2 text-muted-foreground">{textosVentas.pos.vacio}</li>}
          </ul>
        ) : (
          <>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              <Chip activo={!categoria} onClick={() => setCategoria(null)}>
                {t.favoritos}
              </Chip>
              {categorias.map((c) => (
                <Chip key={c.id} activo={categoria === c.id} onClick={() => setCategoria(c.id)}>
                  {c.nombre}
                </Chip>
              ))}
            </div>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {visibles.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => agregarProducto(p)}
                    className="flex h-full min-h-24 w-full flex-col items-center justify-center gap-1 rounded-xl border bg-card p-2 text-center hover:bg-muted"
                  >
                    {p.fotoRuta && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.fotoRuta} alt="" className="size-12 rounded object-cover" loading="lazy" />
                    )}
                    <span className="line-clamp-2 text-sm font-medium">{p.nombre}</span>
                    <span className="text-sm text-muted-foreground">{formatoDolares(p.presentaciones.find((x) => x.esBase)?.precio ?? 0)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setVarios(true)}>
            <CircleDollarSign className="size-5" aria-hidden /> {t.varios}
          </Button>
          <Button variant={consultar ? "default" : "outline"} onClick={() => setConsultar(!consultar)} aria-pressed={consultar}>
            <Search className="size-5" aria-hidden /> {t.consultar}
          </Button>
          <Button
            variant="outline"
            disabled={!carrito.lineas.length}
            onClick={() => {
              setEspera([...espera, carrito]);
              setCarrito(carritoVacio());
            }}
          >
            <Pause className="size-5" aria-hidden /> {t.espera}
          </Button>
          {espera.map((c, i) => (
            <Button
              key={i}
              variant="secondary"
              onClick={() => {
                const resto = espera.filter((_, j) => j !== i);
                setEspera(carrito.lineas.length ? [...resto, carrito] : resto);
                setCarrito(c);
              }}
            >
              {t.retomar} {formatoDolares(totales(c).total)}
            </Button>
          ))}
          <Button
            variant="ghost"
            onClick={() => {
              const ultima = leerBorrador<Carrito>(CLAVE_ULTIMA)?.datos;
              if (ultima) setCarrito({ ...ultima, lineas: ultima.lineas.map((l) => ({ ...l, clave: `${l.clave}:r${Date.now()}` })) });
            }}
          >
            <Repeat className="size-5" aria-hidden /> {t.repetir}
          </Button>
        </div>
      </section>

      {/* PC: el carrito al lado. Celular: barra abajo que abre el carrito. */}
      <aside className="sticky top-20 hidden md:block">{panelCarrito}</aside>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 p-3 backdrop-blur md:hidden">
        <Button size="lg" className="h-14 w-full justify-between text-lg" onClick={() => setVerCarrito(true)} disabled={!carrito.lineas.length}>
          <span className="flex items-center gap-2">
            <ShoppingCart className="size-6" aria-hidden /> {t.carrito} ({carrito.lineas.length})
          </span>
          <span className="font-bold">{formatoDolares(total)}</span>
        </Button>
      </div>
      <div className="h-20 md:hidden" aria-hidden />
      {verCarrito && (
        <Dialog open onOpenChange={setVerCarrito}>
          <DialogContent className="max-h-[95vh] overflow-y-auto text-base sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-xl">{t.carrito}</DialogTitle>
            </DialogHeader>
            {panelCarrito}
          </DialogContent>
        </Dialog>
      )}

      {camara && <EscanerCamara titulo={t.escanear} onCodigo={(c) => void leerCodigo(c)} onCerrar={() => setCamara(false)} />}
      {elegir && (
        <ElegirPresentacion
          producto={elegir}
          onElegir={(id) => {
            setElegir(null);
            agregarProducto(elegir, id);
          }}
          onCerrar={() => setElegir(null)}
        />
      )}
      {peso && (
        <DialogoPeso
          producto={peso.producto}
          precio={peso.producto.presentaciones.find((x) => x.id === peso.presentacionId)?.precio ?? "0"}
          onListo={(cantidad) => {
            const { producto, presentacionId } = peso;
            setPeso(null);
            agregarProducto(producto, presentacionId, cantidad);
          }}
          onCerrar={() => setPeso(null)}
        />
      )}
      {varios && (
        <DialogoVarios
          onListo={(monto, detalle) => {
            setVarios(false);
            setCarrito(agregarVarios(carrito, monto, detalle));
            pitido();
          }}
          onCerrar={() => setVarios(false)}
        />
      )}
      {noEncontrado && (
        <DialogoNoEncontrado
          codigo={noEncontrado}
          puedeCrear={puedeCrearProducto}
          onPendiente={(p) => {
            setNoEncontrado(null);
            setProductos([...productos, p]);
            setCarrito(agregar(carrito, p, p.presentaciones[0].id));
            pitido();
          }}
          onCerrar={() => setNoEncontrado(null)}
        />
      )}
      {cobro && (
        <DialogoCobro
          total={total}
          formas={formas}
          clientes={clientes}
          clienteId={carrito.clienteId}
          ajustes={ajustes}
          pidePin={cobro.pidePin}
          error={cobro.error}
          onCliente={(id) => setCarrito({ ...carrito, clienteId: id })}
          onConfirmar={confirmar}
          onCerrar={() => setCobro(null)}
        />
      )}
      {resultado && <Resultado venta={resultado} onNueva={() => setResultado(null)} />}
    </div>
  );
}

function Chip({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={cn("h-10 shrink-0 rounded-full border px-4 text-sm font-medium whitespace-nowrap", activo ? "border-primary bg-primary text-primary-foreground" : "bg-background")}
    >
      {children}
    </button>
  );
}

function PanelCarrito({
  carrito,
  clientes,
  onCambiar,
  onCobrar,
}: {
  carrito: Carrito;
  clientes: ClienteResumen[];
  onCambiar: (c: Carrito) => void;
  onCobrar: () => void;
}) {
  const [conDescuento, setConDescuento] = useState(Boolean(carrito.descuento));
  const { subtotal, total } = totales(carrito);
  const cambiarCantidad = (clave: string, cantidad: string) =>
    onCambiar({ ...carrito, lineas: carrito.lineas.map((l) => (l.clave === clave ? { ...l, cantidad } : l)) });

  return (
    <section className="grid gap-3 rounded-xl border p-3" aria-label={t.carrito}>
      {carrito.lineas.length === 0 ? (
        <p className="py-6 text-center text-muted-foreground">{t.vacio}</p>
      ) : (
        <ul className="grid max-h-[50vh] gap-2 overflow-y-auto">
          {carrito.lineas.map((l) => {
            const n = leerNumero(l.cantidad) ?? dec(0);
            const paso = l.unidadBase === "unidad" ? dec(1) : dec("0.25");
            return (
              <li key={l.clave} className="grid gap-1 border-b pb-2" aria-label={l.descripcion}>
                <div className="flex justify-between gap-2">
                  <span className="font-medium">{l.descripcion}</span>
                  <span className="font-semibold">{formatoDolares(totalLinea(l))}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" aria-label="Uno menos" onClick={() => n.gt(paso) && cambiarCantidad(l.clave, n.minus(paso).toString())}>
                    <Minus className="size-4" aria-hidden />
                  </Button>
                  <Input
                    aria-label={`Cantidad de ${l.descripcion}`}
                    className="h-9 w-20 text-center text-base"
                    inputMode="decimal"
                    value={l.cantidad}
                    onChange={(e) => cambiarCantidad(l.clave, e.target.value)}
                  />
                  <Button variant="outline" size="sm" aria-label="Uno más" onClick={() => cambiarCantidad(l.clave, n.plus(paso).toString())}>
                    <Plus className="size-4" aria-hidden />
                  </Button>
                  <span className="flex-1 text-sm text-muted-foreground">× {formatoDolares(l.precio)}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Quitar ${l.descripcion}`}
                    onClick={() => onCambiar({ ...carrito, lineas: carrito.lineas.filter((x) => x.clave !== l.clave) })}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Campo id="carrito-cliente" etiqueta={t.cliente} opcional>
        <Selector id="carrito-cliente" value={carrito.clienteId ?? ""} onChange={(e) => onCambiar({ ...carrito, clienteId: e.target.value || null })}>
          <option value="">{t.sinCliente}</option>
          {clientes
            .filter((c) => c.activo)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
        </Selector>
      </Campo>

      {conDescuento ? (
        <Campo id="carrito-descuento" etiqueta={t.descuento}>
          <Input id="carrito-descuento" inputMode="decimal" value={carrito.descuento} onChange={(e) => onCambiar({ ...carrito, descuento: e.target.value })} placeholder="$0.00" />
        </Campo>
      ) : null}

      <div className="flex flex-wrap gap-1">
        <Button
          variant="ghost"
          size="sm"
          disabled={!carrito.lineas.length}
          onClick={() => onCambiar({ ...carrito, lineas: carrito.lineas.slice(0, -1) })}
        >
          <Undo2 className="size-4" aria-hidden /> {t.deshacer}
        </Button>
        {!conDescuento && (
          <Button variant="ghost" size="sm" onClick={() => setConDescuento(true)}>
            {t.descuento}
          </Button>
        )}
        <Button variant="ghost" size="sm" disabled={!carrito.lineas.length} onClick={() => onCambiar(carritoVacio())}>
          <X className="size-4" aria-hidden /> {t.vaciar}
        </Button>
      </div>

      {!subtotal.eq(total) && (
        <p className="flex justify-between text-muted-foreground">
          <span>{t.descuento}</span>
          <span>−{formatoDolares(subtotal.minus(total))}</span>
        </p>
      )}
      <p className="flex items-baseline justify-between">
        <span className="text-lg">{t.total}</span>
        <span className="text-3xl font-bold" data-testid="total-venta">
          {formatoDolares(total)}
        </span>
      </p>
      <Button size="lg" className="h-14 text-xl" disabled={!carrito.lineas.length || total.isNegative()} onClick={onCobrar}>
        {t.cobrar}
      </Button>
    </section>
  );
}

function ElegirPresentacion({ producto, onElegir, onCerrar }: { producto: ProductoVenta; onElegir: (id: string) => void; onCerrar: () => void }) {
  return (
    <Dialog open onOpenChange={(a) => !a && onCerrar()}>
      <DialogContent className="text-base sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {producto.nombre}: {t.elegir}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-2">
          {producto.presentaciones
            .filter((x) => x.paraVenta)
            .map((x) => (
              <Button key={x.id} variant="outline" size="lg" className="h-14 justify-between text-lg" onClick={() => onElegir(x.id)}>
                <span>{x.nombre}</span>
                <span className="font-bold">{x.precio ? formatoDolares(x.precio) : "—"}</span>
              </Button>
            ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DialogoPeso({ producto, precio, onListo, onCerrar }: { producto: ProductoVenta; precio: string; onListo: (cantidad: string) => void; onCerrar: () => void }) {
  const [cantidad, setCantidad] = useState("");
  const [monto, setMonto] = useState("");
  const porMonto = monto ? cantidadPorMonto(monto, precio) : null;
  const valor = porMonto ?? (leerNumero(cantidad)?.gt(0) ? leerNumero(cantidad)!.toString() : null);
  return (
    <Dialog open onOpenChange={(a) => !a && onCerrar()}>
      <DialogContent className="text-base sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {producto.nombre} · {formatoDolares(precio)}
          </DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (valor) onListo(valor);
          }}
        >
          <Campo id="peso-cantidad" etiqueta={t.libras(producto.unidadBase)}>
            <Input id="peso-cantidad" inputMode="decimal" value={cantidad} onChange={(e) => (setCantidad(e.target.value), setMonto(""))} autoFocus />
          </Campo>
          <Campo id="peso-monto" etiqueta={t.oMonto}>
            <Input id="peso-monto" inputMode="decimal" value={monto} onChange={(e) => (setMonto(e.target.value), setCantidad(""))} placeholder="$1.00" />
          </Campo>
          {porMonto && <p className="text-muted-foreground">= {cantidadConUnidad(porMonto, producto.unidadBase)}</p>}
          <Button type="submit" size="lg" disabled={!valor}>
            {t.agregar}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DialogoVarios({ onListo, onCerrar }: { onListo: (monto: string, detalle: string) => void; onCerrar: () => void }) {
  const [monto, setMonto] = useState("");
  const [detalle, setDetalle] = useState("");
  const valido = leerNumero(monto)?.gt(0);
  return (
    <Dialog open onOpenChange={(a) => !a && onCerrar()}>
      <DialogContent className="text-base sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-xl">{t.varios}</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (valido) onListo(monto, detalle);
          }}
        >
          <Campo id="varios-monto" etiqueta={t.montoVarios}>
            <Input id="varios-monto" inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} autoFocus />
          </Campo>
          <Campo id="varios-detalle" etiqueta={t.detalleVarios} opcional>
            <Input id="varios-detalle" value={detalle} onChange={(e) => setDetalle(e.target.value)} />
          </Campo>
          <Button type="submit" size="lg" disabled={!valido}>
            {t.agregar}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DialogoNoEncontrado({
  codigo,
  puedeCrear,
  onPendiente,
  onCerrar,
}: {
  codigo: string;
  puedeCrear: boolean;
  onPendiente: (p: ProductoVenta) => void;
  onCerrar: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [precio, setPrecio] = useState("");
  const [error, setError] = useState<string>();
  const [guardando, iniciar] = useTransition();
  return (
    <Dialog open onOpenChange={(a) => !a && onCerrar()}>
      <DialogContent className="text-base sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">{t.noEncontrado(codigo)}</DialogTitle>
        </DialogHeader>
        {puedeCrear && (
          <Link href={`/catalogo/nuevo?codigo=${encodeURIComponent(codigo)}`} target="_blank" className={buttonVariants({ size: "lg" })}>
            {t.crearProducto}
          </Link>
        )}
        <form
          className="grid gap-3 rounded-xl border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            iniciar(async () => {
              const r = await crearProductoPendiente(nombre, precio, codigo);
              if (!r.ok) return setError(r.mensaje);
              onPendiente({
                id: r.datos!.productoId,
                nombre: nombre.trim(),
                marca: "",
                sinonimos: [],
                plu: null,
                unidadBase: "unidad",
                stock: "0",
                categoriaId: null,
                soloMayores: false,
                fotoRuta: null,
                presentaciones: [{ id: r.datos!.presentacionId, nombre: "Unidad", factor: "1", precio: leerNumero(precio)!.toString(), esBase: true, paraVenta: true, codigos: [codigo] }],
              });
            });
          }}
        >
          <p className="font-semibold">{t.venderPendiente}</p>
          <p className="text-sm text-muted-foreground">{t.pendienteAyuda}</p>
          {error && <Aviso tipo="error">{error}</Aviso>}
          <Campo id="pend-nombre" etiqueta={t.nombre}>
            <Input id="pend-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
          </Campo>
          <Campo id="pend-precio" etiqueta={t.precio}>
            <Input id="pend-precio" inputMode="decimal" value={precio} onChange={(e) => setPrecio(e.target.value)} />
          </Campo>
          <Button type="submit" disabled={guardando || !nombre.trim() || !precio.trim()}>
            {guardando ? textos.general.guardando : t.agregar}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Resultado({ venta, onNueva }: { venta: VentaRegistrada & { texto: string; telefono: string }; onNueva: () => void }) {
  const tc = textosVentas.cobro;
  const cambio = dec(venta.cambio);
  let numero = venta.telefono.replace(/\D/g, "");
  if (numero.startsWith("0")) numero = `593${numero.slice(1)}`;
  return (
    <Dialog open onOpenChange={(a) => !a && onNueva()}>
      <DialogContent className="text-base sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">{tc.listo(venta.numero)}</DialogTitle>
        </DialogHeader>
        {cambio.gt(0) && (
          <div className="rounded-xl bg-green-600/10 p-4 text-center">
            <p>{tc.cambio}</p>
            <p className="text-6xl font-bold text-green-700 dark:text-green-400">{formatoDolares(cambio)}</p>
          </div>
        )}
        <div className="grid gap-2">
          <a href={`/vender/ventas/${venta.id}/ticket?imprimir=1`} target="_blank" rel="noopener" className={buttonVariants({ variant: "outline", size: "lg" })}>
            <Printer className="size-5" aria-hidden /> {tc.imprimir}
          </a>
          <a
            href={`https://wa.me/${numero}?text=${encodeURIComponent(venta.texto)}`}
            target="_blank"
            rel="noopener"
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            {tc.whatsapp}
          </a>
          <Button size="lg" className="h-14 text-xl" onClick={onNueva} autoFocus>
            {tc.nueva}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AbrirCaja({ puede }: { puede: boolean }) {
  const router = useRouter();
  const [fondo, setFondo] = useState("");
  const [error, setError] = useState<string>();
  const [abriendo, iniciar] = useTransition();
  return (
    <div className="grid max-w-md gap-4">
      <Aviso tipo="info">{t.cajaCerrada}</Aviso>
      {puede && (
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            iniciar(async () => {
              const r = await abrirCaja(fondo);
              if (!r.ok) return setError(r.mensaje);
              toast.success(r.mensaje);
              router.refresh();
            });
          }}
        >
          {error && <Aviso tipo="error">{error}</Aviso>}
          <Campo id="abrir-fondo" etiqueta={t.fondo}>
            <Input id="abrir-fondo" inputMode="decimal" value={fondo} onChange={(e) => setFondo(e.target.value)} placeholder="$0.00" autoFocus />
          </Campo>
          <Button type="submit" size="lg" disabled={abriendo}>
            {t.abrirCaja}
          </Button>
        </form>
      )}
    </div>
  );
}
