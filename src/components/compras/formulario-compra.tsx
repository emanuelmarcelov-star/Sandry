"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Camera, ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Aviso, Campo, Casilla, Selector } from "@/components/formulario";
import { SoloCliente } from "@/components/solo-cliente";
import { cantidadConUnidad, UNIDADES } from "@/lib/catalogo";
import {
  buscarLocal,
  costoTotalLinea,
  costoUnitarioLinea,
  lineaVacia,
  revisarCompra,
  totalCompra,
  type DatosCompra,
  type LineaCompra,
  type ProductoLigero,
} from "@/lib/compras";
import { dec, formatoDolares, leerNumero } from "@/lib/dinero";
import { borrarBorrador, guardarBorrador, leerBorrador } from "@/lib/borradores";
import { achicarFoto } from "@/lib/imagen";
import { textos, textosCompras } from "@/lib/textos";
import { crearProductoRapido, guardarProveedor, subirRecibo } from "@/server/acciones/abastecimiento";
import { cn } from "cn";

const t = textosCompras.formulario;

export type LineaPedida = { productoId: string; presentacionId: string; cantidad: string; producto: string; presentacion: string };

function compraNueva(viajeId?: string, inicial?: Partial<DatosCompra>): DatosCompra {
  return {
    id: crypto.randomUUID(),
    proveedorId: "",
    viajeId,
    pago: "contado",
    cuentaId: "",
    vence: "",
    conFactura: false,
    numeroFactura: "",
    nota: "",
    soloTotal: false,
    total: "",
    lineas: [],
    fotoRuta: null,
    ...inicial,
  };
}

/**
 * Formulario de compra. Sirve para la compra suelta, el distribuidor que llega
 * a la tienda y cada lugar del viaje. Lo que se escribe se guarda en el
 * dispositivo mientras tanto (si se cierra o se va la señal, no se pierde).
 */
export function FormularioCompra(props: PropsFormulario) {
  // Arranca con el borrador guardado en el dispositivo, así que solo se dibuja en el navegador.
  return (
    <SoloCliente mientras={<p className="text-lg">{textos.general.cargando}</p>}>
      <Formulario {...props} />
    </SoloCliente>
  );
}

type PropsFormulario = Parameters<typeof Formulario>[0];

function Formulario({
  productos: productosIniciales,
  proveedores: proveedoresIniciales,
  cuentas,
  viajeId,
  claveBorrador,
  inicial,
  pedido,
  permitirSoloTotal = false,
  puedeCrearProducto = false,
  puedeCrearLugar = false,
  onGuardar,
}: {
  productos: ProductoLigero[];
  proveedores: { id: string; nombre: string }[];
  cuentas: { id: string; nombre: string; tipo: string }[];
  viajeId?: string;
  claveBorrador: string;
  inicial?: Partial<DatosCompra>;
  pedido?: LineaPedida[];
  permitirSoloTotal?: boolean;
  puedeCrearProducto?: boolean;
  puedeCrearLugar?: boolean;
  onGuardar: (datos: DatosCompra) => Promise<{ ok: boolean; mensaje?: string }>;
}) {
  const [productos, setProductos] = useState(productosIniciales);
  const [proveedores, setProveedores] = useState(proveedoresIniciales);
  // Recupera lo que se estaba llenando (si había algo).
  const [borrador] = useState(() => {
    const b = leerBorrador<DatosCompra>(claveBorrador);
    return b && (b.datos.lineas.length || b.datos.total) ? b.datos : null;
  });
  const [datos, setDatos] = useState<DatosCompra>(() => (borrador ? { ...borrador, viajeId } : compraNueva(viajeId, inicial)));
  const [recuperado, setRecuperado] = useState(borrador !== null);
  const [errores, setErrores] = useState<string[]>([]);
  const [guardando, iniciar] = useTransition();
  const porId = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos]);

  function cambiar(cambios: Partial<DatosCompra>) {
    setDatos((d) => {
      const nuevo = { ...d, ...cambios };
      guardarBorrador(claveBorrador, nuevo);
      return nuevo;
    });
  }
  const cambiarLinea = (clave: string, cambios: Partial<LineaCompra>) =>
    cambiar({ lineas: datos.lineas.map((l) => (l.clave === clave ? { ...l, ...cambios } : l)) });

  function agregar(producto: ProductoLigero, presentacionId?: string) {
    const nueva = lineaVacia(producto, presentacionId);
    const existente = datos.lineas.find((l) => l.productoId === producto.id && l.presentacionId === nueva.presentacionId);
    if (existente) {
      const n = (leerNumero(existente.cantidad) ?? dec(0)).plus(1).toString();
      cambiarLinea(existente.clave, { cantidad: n });
      toast.success(`${producto.nombre}: ${n}`);
    } else {
      if (producto.manejaCaducidad) nueva.vence = "";
      cambiar({ lineas: [nueva, ...datos.lineas] });
    }
  }

  function guardar() {
    const problemas = revisarCompra(datos, porId);
    setErrores(problemas);
    if (problemas.length) return;
    iniciar(async () => {
      const r = await onGuardar(datos);
      if (!r.ok) {
        setErrores([r.mensaje ?? "No se pudo guardar."]);
        return;
      }
      borrarBorrador(claveBorrador);
      setRecuperado(false);
      setDatos(compraNueva(viajeId, { proveedorId: datos.proveedorId, cuentaId: datos.cuentaId }));
    });
  }

  const total = totalCompra(datos);
  const cuenta = cuentas.find((c) => c.id === datos.cuentaId);

  return (
    <form
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        guardar();
      }}
    >
      {recuperado && (
        <Aviso tipo="info">
          <div className="flex flex-wrap items-center gap-3">
            <span>{t.borrador}</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                borrarBorrador(claveBorrador);
                setRecuperado(false);
                setDatos(compraNueva(viajeId, inicial));
              }}
            >
              {t.descartar}
            </Button>
          </div>
        </Aviso>
      )}

      <ElegirLugar
        valor={datos.proveedorId}
        proveedores={proveedores}
        puedeCrear={puedeCrearLugar}
        onCambiar={(id) => cambiar({ proveedorId: id })}
        onCreado={(p) => {
          setProveedores((lista) => [...lista, p].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")));
          cambiar({ proveedorId: p.id });
        }}
      />

      {permitirSoloTotal && (
        <label className="flex items-center gap-3 text-base">
          <Casilla checked={datos.soloTotal} onChange={(e) => cambiar({ soloTotal: e.target.checked })} />
          {t.soloTotal}
        </label>
      )}

      {datos.soloTotal ? (
        <Campo id="compra-total" etiqueta={t.total}>
          <Input id="compra-total" inputMode="decimal" value={datos.total} onChange={(e) => cambiar({ total: e.target.value })} placeholder="$0.00" />
        </Campo>
      ) : (
        <>
          <BuscarProducto
            productos={productos}
            puedeCrear={puedeCrearProducto}
            onElegir={agregar}
            onCreado={(p) => {
              setProductos((lista) => [...lista, p]);
              agregar(p);
            }}
          />
          <div className="grid gap-3">
            {datos.lineas.map((l) => {
              const p = porId.get(l.productoId);
              return p ? (
                <TarjetaLinea
                  key={l.clave}
                  linea={l}
                  producto={p}
                  onCambiar={(c) => cambiarLinea(l.clave, c)}
                  onQuitar={() => cambiar({ lineas: datos.lineas.filter((x) => x.clave !== l.clave) })}
                />
              ) : null;
            })}
          </div>
          {pedido && <CompararPedido pedido={pedido} lineas={datos.lineas} />}
        </>
      )}

      <fieldset className="grid gap-3 rounded-xl border p-4">
        <legend className="px-1 text-base font-semibold">{t.pago}</legend>
        <div className="grid grid-cols-2 gap-2">
          {(["contado", "credito"] as const).map((pago) => (
            <button
              key={pago}
              type="button"
              onClick={() => cambiar({ pago })}
              aria-pressed={datos.pago === pago}
              className={cn(
                "h-12 rounded-lg border text-base font-medium",
                datos.pago === pago ? "border-primary bg-primary text-primary-foreground" : "bg-background",
              )}
            >
              {pago === "contado" ? t.contado : t.credito}
            </button>
          ))}
        </div>
        {datos.pago === "contado" ? (
          <Campo id="compra-cuenta" etiqueta={t.cuenta}>
            <Selector id="compra-cuenta" value={datos.cuentaId} onChange={(e) => cambiar({ cuentaId: e.target.value })}>
              <option value="">—</option>
              {cuentas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </Selector>
          </Campo>
        ) : (
          <Campo id="compra-vence" etiqueta={t.venceCredito} opcional>
            <Input id="compra-vence" type="date" value={datos.vence} onChange={(e) => cambiar({ vence: e.target.value })} />
          </Campo>
        )}
        <label className="flex items-center gap-3 text-base">
          <Casilla checked={datos.conFactura} onChange={(e) => cambiar({ conFactura: e.target.checked })} />
          {t.conFactura}
        </label>
        {datos.conFactura ? (
          <Campo id="compra-factura" etiqueta={t.numeroFactura} opcional>
            <Input id="compra-factura" value={datos.numeroFactura} onChange={(e) => cambiar({ numeroFactura: e.target.value })} placeholder="001-001-000000123" />
          </Campo>
        ) : (
          <p className="text-sm text-muted-foreground">{t.avisoSinFactura}</p>
        )}
        <FotoRecibo ruta={datos.fotoRuta ?? null} onSubida={(ruta) => cambiar({ fotoRuta: ruta })} />
        <Campo id="compra-nota" etiqueta={t.nota} opcional>
          <Input id="compra-nota" value={datos.nota} onChange={(e) => cambiar({ nota: e.target.value })} />
        </Campo>
      </fieldset>

      {total.gt(500) && (datos.pago === "credito" || cuenta?.tipo === "caja" || cuenta?.tipo === "personal") && (
        <Aviso tipo="info">{t.avisoQuinientos}</Aviso>
      )}
      {errores.length > 0 && (
        <Aviso tipo="error">
          <ul className="grid gap-1">
            {errores.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </Aviso>
      )}

      <div className="sticky bottom-0 -mx-4 flex items-center justify-between gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur">
        <div>
          <p className="text-sm text-muted-foreground">{t.total}</p>
          <p className="text-2xl font-bold" data-testid="total-compra">
            {formatoDolares(total)}
          </p>
        </div>
        <Button type="submit" size="lg" disabled={guardando}>
          {guardando ? textos.general.guardando : t.guardar}
        </Button>
      </div>
    </form>
  );
}

// ------------------------------------------------------------------ piezas

function ElegirLugar({
  valor,
  proveedores,
  puedeCrear,
  onCambiar,
  onCreado,
}: {
  valor: string;
  proveedores: { id: string; nombre: string }[];
  puedeCrear: boolean;
  onCambiar: (id: string) => void;
  onCreado: (p: { id: string; nombre: string }) => void;
}) {
  const [nuevo, setNuevo] = useState<string | null>(null);
  const [creando, iniciar] = useTransition();
  if (nuevo !== null) {
    return (
      <div className="grid gap-2">
        <Campo id="lugar-nuevo" etiqueta={textosCompras.proveedores.nombre}>
          <Input id="lugar-nuevo" value={nuevo} onChange={(e) => setNuevo(e.target.value)} autoFocus />
        </Campo>
        <div className="flex gap-2">
          <Button
            type="button"
            disabled={creando || !nuevo.trim()}
            onClick={() =>
              iniciar(async () => {
                const r = await guardarProveedor({
                  nombre: nuevo, tipo: "otro", ruc: "", contacto: "", telefono: "", direccion: "", diasVisita: [], condiciones: "", notas: "", activo: true,
                });
                if (!r.ok) return void toast.error(r.mensaje);
                onCreado({ id: r.datos!.id, nombre: nuevo.trim() });
                setNuevo(null);
              })
            }
          >
            {textos.general.guardar}
          </Button>
          <Button type="button" variant="outline" onClick={() => setNuevo(null)}>
            {textos.general.cancelar}
          </Button>
        </div>
      </div>
    );
  }
  return (
    <Campo id="compra-lugar" etiqueta={t.lugar}>
      <div className="flex gap-2">
        <Selector id="compra-lugar" value={valor} onChange={(e) => onCambiar(e.target.value)}>
          <option value="">{t.sinLugar}</option>
          {proveedores.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </Selector>
        {puedeCrear && (
          <Button type="button" variant="outline" size="lg" onClick={() => setNuevo("")} aria-label={textosCompras.proveedores.nuevo}>
            <Plus className="size-5" aria-hidden />
          </Button>
        )}
      </div>
    </Campo>
  );
}

export function BuscarProducto({
  productos,
  puedeCrear,
  onElegir,
  onCreado,
}: {
  productos: ProductoLigero[];
  puedeCrear: boolean;
  onElegir: (p: ProductoLigero, presentacionId?: string) => void;
  onCreado: (p: ProductoLigero) => void;
}) {
  const [texto, setTexto] = useState("");
  const [creando, setCreando] = useState(false);
  const resultados = useMemo(() => buscarLocal(productos, texto), [productos, texto]);
  const entrada = useRef<HTMLInputElement>(null);

  function elegir(p: ProductoLigero, presentacionId?: string) {
    onElegir(p, presentacionId);
    setTexto("");
    entrada.current?.focus();
  }

  return (
    <div className="grid gap-2">
      <Campo id="compra-buscar" etiqueta={t.buscar}>
        <Input
          id="compra-buscar"
          ref={entrada}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            // El lector de códigos escribe el código y presiona Enter.
            if (e.key === "Enter") {
              e.preventDefault();
              if (resultados[0]) elegir(resultados[0].producto, resultados[0].presentacionId);
            }
          }}
          autoComplete="off"
          enterKeyHint="search"
        />
      </Campo>
      {texto.trim() && (
        <ul className="grid gap-1 rounded-lg border p-1">
          {resultados.map(({ producto, presentacionId }) => (
            <li key={producto.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-3 text-left text-base hover:bg-muted"
                onClick={() => elegir(producto, presentacionId)}
              >
                <span className="font-medium">{producto.nombre}</span>
                <span className="text-sm text-muted-foreground">{cantidadConUnidad(producto.stock, producto.unidadBase)}</span>
              </button>
            </li>
          ))}
          {!resultados.length && <li className="px-3 py-2 text-muted-foreground">{t.sinResultados}</li>}
          {puedeCrear && (
            <li>
              <button type="button" className="w-full rounded-md px-3 py-3 text-left text-base font-medium text-primary hover:bg-muted" onClick={() => setCreando(true)}>
                {t.productoNuevo}
              </button>
            </li>
          )}
        </ul>
      )}
      {creando && (
        <ProductoRapido
          nombreInicial={texto}
          onCancelar={() => setCreando(false)}
          onCreado={(p) => {
            setCreando(false);
            setTexto("");
            onCreado(p);
          }}
        />
      )}
    </div>
  );
}

function ProductoRapido({
  nombreInicial,
  onCancelar,
  onCreado,
}: {
  nombreInicial: string;
  onCancelar: () => void;
  onCreado: (p: ProductoLigero) => void;
}) {
  const [nombre, setNombre] = useState(nombreInicial);
  const [precio, setPrecio] = useState("");
  const [creando, iniciar] = useTransition();
  const sinSenal = typeof navigator !== "undefined" && !navigator.onLine;
  return (
    <div className="grid gap-3 rounded-xl border border-primary/40 p-4">
      {sinSenal && <Aviso tipo="info">{t.necesitaSenal}</Aviso>}
      <Campo id="nuevo-nombre" etiqueta={t.nombreNuevo}>
        <Input id="nuevo-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
      </Campo>
      <Campo id="nuevo-precio" etiqueta={t.precioNuevo} opcional>
        <Input id="nuevo-precio" inputMode="decimal" value={precio} onChange={(e) => setPrecio(e.target.value)} />
      </Campo>
      <div className="flex gap-2">
        <Button
          type="button"
          disabled={creando || !nombre.trim() || sinSenal}
          onClick={() =>
            iniciar(async () => {
              const r = await crearProductoRapido({ nombre, precioVenta: precio });
              if (!r.ok) return void toast.error(r.mensaje);
              onCreado(r.datos!.producto);
            })
          }
        >
          {t.crear}
        </Button>
        <Button type="button" variant="outline" onClick={onCancelar}>
          {textos.general.cancelar}
        </Button>
      </div>
    </div>
  );
}

export function TarjetaLinea({
  linea,
  producto,
  onCambiar,
  onQuitar,
}: {
  linea: LineaCompra;
  producto: ProductoLigero;
  onCambiar: (c: Partial<LineaCompra>) => void;
  onQuitar: () => void;
}) {
  const [mas, setMas] = useState(producto.manejaCaducidad || Boolean(linea.bonificacion || linea.danados || linea.vence));
  const opciones = producto.presentaciones.filter((p) => p.paraCompra || p.esBase);
  const pres = producto.presentaciones.find((p) => p.id === linea.presentacionId) ?? producto.presentaciones[0];
  const unitario = costoUnitarioLinea(linea, pres.factor);
  const id = linea.clave.replace(/[^a-z0-9]/gi, "");
  const unidad = UNIDADES[producto.unidadBase].nombre.toLowerCase();

  return (
    <article className="grid gap-3 rounded-xl border p-4" aria-label={producto.nombre}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-lg font-semibold">{producto.nombre}</h3>
        <Button type="button" variant="ghost" size="sm" onClick={onQuitar} aria-label={`${t.quitar} ${producto.nombre}`}>
          <Trash2 className="size-5" aria-hidden />
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {opciones.length > 1 && (
          <div className="col-span-2">
            <Campo id={`${id}-pres`} etiqueta={t.presentacion}>
              <Selector
                id={`${id}-pres`}
                value={linea.presentacionId}
                onChange={(e) => {
                  const nueva = producto.presentaciones.find((p) => p.id === e.target.value)!;
                  // El costo propuesto se ajusta a la nueva presentación.
                  const costo =
                    linea.costoEs === "unidad" && producto.costo && Number(producto.costo) > 0
                      ? dec(producto.costo).times(nueva.factor).toDecimalPlaces(2).toString()
                      : linea.costo;
                  onCambiar({ presentacionId: nueva.id, costo });
                }}
              >
                {opciones.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                    {!p.esBase && ` (${cantidadConUnidad(p.factor, producto.unidadBase)})`}
                  </option>
                ))}
              </Selector>
            </Campo>
          </div>
        )}
        <Campo id={`${id}-cantidad`} etiqueta={t.cantidad}>
          <Input id={`${id}-cantidad`} inputMode="decimal" value={linea.cantidad} onChange={(e) => onCambiar({ cantidad: e.target.value })} />
        </Campo>
        <Campo id={`${id}-costo`} etiqueta={linea.costoEs === "unidad" ? t.costoCada(pres.nombre) : t.costoLinea}>
          <Input id={`${id}-costo`} inputMode="decimal" value={linea.costo} onChange={(e) => onCambiar({ costo: e.target.value })} placeholder="$0.00" />
        </Campo>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <button
          type="button"
          className="text-primary underline"
          onClick={() => {
            const totalLinea = costoTotalLinea(linea);
            const cantidad = leerNumero(linea.cantidad);
            onCambiar(
              linea.costoEs === "unidad"
                ? { costoEs: "total", costo: totalLinea.gt(0) ? totalLinea.toDecimalPlaces(2).toString() : "" }
                : { costoEs: "unidad", costo: cantidad?.gt(0) && totalLinea.gt(0) ? totalLinea.dividedBy(cantidad).toDecimalPlaces(2).toString() : "" },
            );
          }}
        >
          {linea.costoEs === "unidad" ? t.usarTotal : t.usarUnidad}
        </button>
        <span className="text-muted-foreground">
          {formatoDolares(costoTotalLinea(linea))}
          {unitario && !pres.esBase && ` · ${t.porUnidad(formatoDolares(unitario), unidad)}`}
        </span>
      </div>
      <button type="button" className="flex items-center gap-1 text-sm font-medium text-muted-foreground" onClick={() => setMas(!mas)} aria-expanded={mas}>
        {mas ? <ChevronUp className="size-4" aria-hidden /> : <ChevronDown className="size-4" aria-hidden />} {t.mas}
      </button>
      {mas && (
        <div className="grid grid-cols-2 gap-3">
          <Campo id={`${id}-bonif`} etiqueta={t.bonificacion} opcional>
            <Input id={`${id}-bonif`} inputMode="decimal" value={linea.bonificacion} onChange={(e) => onCambiar({ bonificacion: e.target.value })} />
          </Campo>
          <Campo id={`${id}-danados`} etiqueta={t.danados(producto.unidadBase)} opcional>
            <Input id={`${id}-danados`} inputMode="decimal" value={linea.danados} onChange={(e) => onCambiar({ danados: e.target.value })} />
          </Campo>
          <div className="col-span-2">
            <Campo id={`${id}-vence`} etiqueta={t.vence} opcional>
              <Input id={`${id}-vence`} type="date" value={linea.vence} onChange={(e) => onCambiar({ vence: e.target.value })} />
            </Campo>
          </div>
        </div>
      )}
    </article>
  );
}

function CompararPedido({ pedido, lineas }: { pedido: LineaPedida[]; lineas: LineaCompra[] }) {
  const tp = textosCompras.pedidos;
  const filas = pedido
    .map((p) => {
      const llego = lineas
        .filter((l) => l.presentacionId === p.presentacionId)
        .reduce((s, l) => s.plus(leerNumero(l.cantidad) ?? 0), dec(0));
      return { ...p, llego, diferencia: llego.minus(p.cantidad) };
    })
    .filter((f) => !f.diferencia.isZero());
  if (!filas.length) return null;
  return (
    <Aviso tipo="info">
      <p className="font-semibold">{tp.comparar}</p>
      <ul className="mt-1 grid gap-1">
        {filas.map((f) => (
          <li key={f.presentacionId}>
            {f.producto} ({f.presentacion}): {tp.pidio} {f.cantidad}, {f.diferencia.isNegative() ? tp.faltan : tp.sobran}{" "}
            {f.diferencia.abs().toString()}
          </li>
        ))}
      </ul>
    </Aviso>
  );
}

function FotoRecibo({ ruta, onSubida }: { ruta: string | null; onSubida: (ruta: string | null) => void }) {
  const [subiendo, iniciar] = useTransition();
  const entrada = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        ref={entrada}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const archivo = e.target.files?.[0];
          if (!archivo) return;
          iniciar(async () => {
            try {
              const formulario = new FormData();
              formulario.set("foto", await achicarFoto(archivo, 1400));
              const r = await subirRecibo(formulario);
              if (!r.ok) return void toast.error(r.mensaje);
              onSubida(r.datos!.ruta);
            } catch {
              toast.error("Sin señal: la foto no se pudo subir. Guárdala y súbela después.");
            }
          });
        }}
      />
      <Button type="button" variant="outline" onClick={() => entrada.current?.click()} disabled={subiendo}>
        <Camera className="size-5" aria-hidden /> {subiendo ? textos.general.guardando : t.foto}
      </Button>
      {ruta && <span className="text-sm text-green-700 dark:text-green-400">✓</span>}
    </div>
  );
}
