"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Aviso, Campo, Casilla, Selector } from "@/components/formulario";
import { formatoDolares, formatoFecha, hoyEcuador } from "@/lib/dinero";
import { textos, textosGastos } from "@/lib/textos";
import { anularGasto, guardarRecurrente, guardarVehiculo, registrarGastoNegocio, registrarIngreso } from "@/server/acciones/gastos";
import { cn } from "cn";

const t = textosGastos;

type Categoria = { id: string; nombre: string; grupo: string; esVehiculo: boolean };
type Pendiente = { id: string; descripcion: string; categoriaId: string; monto: string | null; dia: number; cuentaId: string | null; vence: string };
type Fijo = { id: string; categoriaId: string; descripcion: string; monto: string; dia: string; cuentaId: string; activo: boolean };
type Gasto = { id: string; fecha: string; monto: string; descripcion: string; personal: boolean; anulado: boolean; categoria: string; cuenta: string };

export function PantallaGastos({
  cuentas,
  categorias,
  vehiculos: vehiculosIniciales,
  pendientes,
  fijos,
  gastos,
}: {
  cuentas: { id: string; nombre: string }[];
  categorias: Categoria[];
  vehiculos: { id: string; nombre: string }[];
  pendientes: Pendiente[];
  fijos: Fijo[];
  gastos: Gasto[];
}) {
  const router = useRouter();
  const [pagando, setPagando] = useState<Pendiente | null>(null);
  const [configurando, setConfigurando] = useState<Fijo | null>(null);
  const [, iniciar] = useTransition();
  const hoy = hoyEcuador();

  return (
    <>
      <section className="grid gap-2">
        <h2 className="text-xl font-semibold">{t.fijos}</h2>
        {!pendientes.length ? (
          <p className="text-muted-foreground">{t.sinFijos}</p>
        ) : (
          <ul className="grid gap-2">
            {pendientes.map((p) => (
              <li key={p.id} className={cn("flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3", p.vence < hoy && "border-destructive/60")}>
                <span className="grid">
                  <span className="font-semibold">{p.descripcion}</span>
                  <span className={cn("text-sm", p.vence < hoy ? "font-semibold text-destructive" : "text-muted-foreground")}>
                    {p.vence < hoy ? t.vencido : t.vence(String(p.dia))} · {p.monto ? formatoDolares(p.monto) : t.sinMonto}
                  </span>
                </span>
                <span className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setConfigurando(fijos.find((f) => f.id === p.id) ?? null)}>
                    {t.configurar}
                  </Button>
                  <Button size="sm" onClick={() => setPagando(p)}>
                    {t.pagar}
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <FormularioGasto key={pagando?.id ?? "nuevo"} cuentas={cuentas} categorias={categorias} vehiculos={vehiculosIniciales} fijo={pagando} onListo={() => setPagando(null)} />

      <FormularioIngreso cuentas={cuentas} />

      <section className="grid gap-2">
        <h2 className="text-xl font-semibold">{t.ultimos}</h2>
        {!gastos.length ? (
          <p className="text-muted-foreground">{t.vacio}</p>
        ) : (
          <ul className="grid gap-1">
            {gastos.map((g) => (
              <li key={g.id} className={cn("flex flex-wrap items-center justify-between gap-2 border-b py-2", g.anulado && "opacity-50")}>
                <span className="grid">
                  <span className="font-medium">
                    {g.categoria}
                    {g.descripcion && ` · ${g.descripcion}`}
                    {g.personal && <Badge variant="secondary" className="ml-2">{t.personalEtiqueta}</Badge>}
                    {g.anulado && <Badge variant="outline" className="ml-2">{t.anulado}</Badge>}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {formatoFecha(g.fecha)} · {g.cuenta}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <span className={cn("font-semibold", g.anulado && "line-through")}>{formatoDolares(g.monto)}</span>
                  {!g.anulado && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() =>
                        iniciar(async () => {
                          const r = await anularGasto(g.id);
                          if (!r.ok) return void toast.error(r.mensaje);
                          toast.success(r.mensaje);
                          router.refresh();
                        })
                      }
                    >
                      {t.anular}
                    </Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {configurando && <DialogoFijo fijo={configurando} categorias={categorias} cuentas={cuentas} onCerrar={() => setConfigurando(null)} />}
    </>
  );
}

function FormularioGasto({
  cuentas,
  categorias,
  vehiculos: iniciales,
  fijo,
  onListo,
}: {
  cuentas: { id: string; nombre: string }[];
  categorias: Categoria[];
  vehiculos: { id: string; nombre: string }[];
  fijo: Pendiente | null;
  onListo: () => void;
}) {
  const router = useRouter();
  const [vehiculos, setVehiculos] = useState(iniciales);
  const [categoriaId, setCategoriaId] = useState(fijo?.categoriaId ?? "");
  const [monto, setMonto] = useState(fijo?.monto ? Number(fijo.monto).toFixed(2) : "");
  const [cuentaId, setCuentaId] = useState(fijo?.cuentaId ?? "");
  const [descripcion, setDescripcion] = useState(fijo?.descripcion ?? "");
  const [personal, setPersonal] = useState(false);
  const [vehiculoId, setVehiculoId] = useState(iniciales[0]?.id ?? "");
  const [galones, setGalones] = useState("");
  const [km, setKm] = useState("");
  const [nuevoCarro, setNuevoCarro] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [guardando, iniciar] = useTransition();
  const categoria = categorias.find((c) => c.id === categoriaId);
  const grupos = [...new Set(categorias.map((c) => c.grupo))];

  return (
    <form
      className="grid gap-4 rounded-xl border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!categoriaId) return setError("Elige qué fue el gasto.");
        if (!cuentaId) return setError("Elige de qué cuenta salió el dinero.");
        iniciar(async () => {
          const r = await registrarGastoNegocio({
            id: crypto.randomUUID(),
            categoriaId,
            monto,
            cuentaId,
            descripcion,
            personal: Boolean(categoria?.esVehiculo && personal),
            vehiculoId: categoria?.esVehiculo ? vehiculoId : "",
            galones: categoria?.esVehiculo ? galones : "",
            kilometraje: categoria?.esVehiculo ? km : "",
            recurrenteId: fijo?.id,
          });
          if (!r.ok) return setError(r.mensaje);
          toast.success(r.mensaje);
          setError(undefined);
          setMonto("");
          setDescripcion("");
          setGalones("");
          setKm("");
          onListo();
          router.refresh();
        });
      }}
    >
      <h2 className="text-xl font-semibold">{fijo ? `${t.pagar}: ${fijo.descripcion}` : t.nuevo}</h2>
      {error && <Aviso tipo="error">{error}</Aviso>}
      <Campo id="gasto-categoria" etiqueta={t.categoria}>
        <Selector id="gasto-categoria" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
          <option value="">—</option>
          {grupos.map((g) => (
            <optgroup key={g} label={g}>
              {categorias
                .filter((c) => c.grupo === g)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
            </optgroup>
          ))}
        </Selector>
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo id="gasto-monto" etiqueta={t.monto}>
          <Input id="gasto-monto" inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="$0.00" />
        </Campo>
        <Campo id="gasto-cuenta" etiqueta={t.cuenta}>
          <Selector id="gasto-cuenta" value={cuentaId} onChange={(e) => setCuentaId(e.target.value)}>
            <option value="">—</option>
            {cuentas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </Selector>
        </Campo>
      </div>

      {categoria?.esVehiculo && (
        <fieldset className="grid gap-3 rounded-lg bg-muted/50 p-3">
          <legend className="sr-only">{t.vehiculo}</legend>
          <p className="font-medium">{t.deQuien}</p>
          <div className="grid grid-cols-2 gap-2">
            {[false, true].map((p) => (
              <button
                key={String(p)}
                type="button"
                aria-pressed={personal === p}
                onClick={() => setPersonal(p)}
                className={cn("h-12 rounded-lg border text-base", personal === p ? "border-primary bg-primary text-primary-foreground" : "bg-background")}
              >
                {p ? t.personal : t.tienda}
              </button>
            ))}
          </div>
          {personal && <p className="text-sm text-muted-foreground">{t.personalAyuda}</p>}
          {nuevoCarro !== null ? (
            <div className="flex gap-2">
              <Input aria-label={t.nombreVehiculo} placeholder={t.nombreVehiculo} value={nuevoCarro} onChange={(e) => setNuevoCarro(e.target.value)} />
              <Button
                type="button"
                onClick={() =>
                  iniciar(async () => {
                    const r = await guardarVehiculo(nuevoCarro);
                    if (!r.ok) return setError(r.mensaje);
                    setVehiculos([...vehiculos, { id: r.datos!.id, nombre: nuevoCarro.trim() }]);
                    setVehiculoId(r.datos!.id);
                    setNuevoCarro(null);
                  })
                }
              >
                {textos.general.guardar}
              </Button>
            </div>
          ) : (
            <Campo id="gasto-carro" etiqueta={t.vehiculo} opcional>
              <div className="flex gap-2">
                <Selector id="gasto-carro" value={vehiculoId} onChange={(e) => setVehiculoId(e.target.value)}>
                  <option value="">—</option>
                  {vehiculos.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.nombre}
                    </option>
                  ))}
                </Selector>
                <Button type="button" variant="outline" onClick={() => setNuevoCarro("")}>
                  {t.nuevoVehiculo}
                </Button>
              </div>
            </Campo>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Campo id="gasto-galones" etiqueta={t.galones} opcional>
              <Input id="gasto-galones" inputMode="decimal" value={galones} onChange={(e) => setGalones(e.target.value)} />
            </Campo>
            <Campo id="gasto-km" etiqueta={t.kilometraje} opcional>
              <Input id="gasto-km" inputMode="numeric" value={km} onChange={(e) => setKm(e.target.value)} />
            </Campo>
          </div>
        </fieldset>
      )}

      <Campo id="gasto-detalle" etiqueta={t.descripcion} opcional>
        <Input id="gasto-detalle" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
      </Campo>
      <div className="flex gap-2">
        <Button type="submit" size="lg" disabled={guardando}>
          {guardando ? textos.general.guardando : t.guardar}
        </Button>
        {fijo && (
          <Button type="button" size="lg" variant="ghost" onClick={onListo}>
            {textos.general.cancelar}
          </Button>
        )}
      </div>
    </form>
  );
}

function FormularioIngreso({ cuentas }: { cuentas: { id: string; nombre: string }[] }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [monto, setMonto] = useState("");
  const [cuentaId, setCuentaId] = useState(cuentas[0]?.id ?? "");
  const [descripcion, setDescripcion] = useState("");
  const [error, setError] = useState<string>();
  const [guardando, iniciar] = useTransition();
  if (!abierto) {
    return (
      <Button variant="outline" className="justify-self-start" onClick={() => setAbierto(true)}>
        {t.ingreso}
      </Button>
    );
  }
  return (
    <form
      className="grid gap-3 rounded-xl border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        iniciar(async () => {
          const r = await registrarIngreso(monto, cuentaId, descripcion);
          if (!r.ok) return setError(r.mensaje);
          toast.success(r.mensaje);
          setAbierto(false);
          setMonto("");
          setDescripcion("");
          router.refresh();
        });
      }}
    >
      <h2 className="text-xl font-semibold">{t.ingreso}</h2>
      <p className="text-sm text-muted-foreground">{t.ingresoAyuda}</p>
      {error && <Aviso tipo="error">{error}</Aviso>}
      <Campo id="ingreso-de" etiqueta={t.ingresoDe}>
        <Input id="ingreso-de" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo id="ingreso-monto" etiqueta={t.monto}>
          <Input id="ingreso-monto" inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} />
        </Campo>
        <Campo id="ingreso-cuenta" etiqueta={t.ingresoA}>
          <Selector id="ingreso-cuenta" value={cuentaId} onChange={(e) => setCuentaId(e.target.value)}>
            {cuentas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </Selector>
        </Campo>
      </div>
      <Button type="submit" disabled={guardando}>
        {t.guardarIngreso}
      </Button>
    </form>
  );
}

function DialogoFijo({ fijo, categorias, cuentas, onCerrar }: { fijo: Fijo; categorias: Categoria[]; cuentas: { id: string; nombre: string }[]; onCerrar: () => void }) {
  const router = useRouter();
  const [d, setD] = useState(fijo);
  const [error, setError] = useState<string>();
  const [guardando, iniciar] = useTransition();
  return (
    <Dialog open onOpenChange={(a) => !a && onCerrar()}>
      <DialogContent className="text-base sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">{fijo.descripcion}</DialogTitle>
        </DialogHeader>
        {error && <Aviso tipo="error">{error}</Aviso>}
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            iniciar(async () => {
              const r = await guardarRecurrente(d);
              if (!r.ok) return setError(r.mensaje);
              toast.success(t.fijoGuardado);
              onCerrar();
              router.refresh();
            });
          }}
        >
          <Campo id="fijo-desc" etiqueta={t.descripcion}>
            <Input id="fijo-desc" value={d.descripcion} onChange={(e) => setD({ ...d, descripcion: e.target.value })} />
          </Campo>
          <Campo id="fijo-cat" etiqueta={t.categoria}>
            <Selector id="fijo-cat" value={d.categoriaId} onChange={(e) => setD({ ...d, categoriaId: e.target.value })}>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </Selector>
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo id="fijo-monto" etiqueta={t.monto}>
              <Input id="fijo-monto" inputMode="decimal" value={d.monto} onChange={(e) => setD({ ...d, monto: e.target.value })} />
            </Campo>
            <Campo id="fijo-dia" etiqueta={t.dia}>
              <Input id="fijo-dia" inputMode="numeric" value={d.dia} onChange={(e) => setD({ ...d, dia: e.target.value })} />
            </Campo>
          </div>
          <Campo id="fijo-cuenta" etiqueta={t.cuenta} opcional>
            <Selector id="fijo-cuenta" value={d.cuentaId} onChange={(e) => setD({ ...d, cuentaId: e.target.value })}>
              <option value="">—</option>
              {cuentas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </Selector>
          </Campo>
          <label className="flex items-center gap-3">
            <Casilla checked={d.activo} onChange={(e) => setD({ ...d, activo: e.target.checked })} /> {t.activo}
          </label>
          <Button type="submit" size="lg" disabled={guardando}>
            {guardando ? textos.general.guardando : textos.general.guardar}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
