"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Barcode, Camera, Plus, Search, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Aviso, Campo, Casilla, Selector } from "@/components/formulario";
import { esquemaProducto, type DatosProducto } from "@/lib/esquemas/catalogo";
import { margenSobreCosto, precioSugerido, UNIDADES, type UnidadBase } from "@/lib/catalogo";
import { dec, formatoDolares, leerNumero } from "@/lib/dinero";
import { achicarFoto } from "@/lib/imagen";
import { textosCatalogo } from "@/lib/textos";
import {
  buscarEnOpenFoodFacts,
  generarCodigoInterno,
  guardarFotoDesdeOpenFoodFacts,
  guardarProducto,
  subirFotoProducto,
  sugerirPlu,
  type DatosOpenFoodFacts,
} from "@/server/acciones/catalogo";
import { cn } from "cn";

const t = textosCatalogo.formulario;

export type ValoresIniciales = DatosProducto & { stockActual: string };
type CategoriaOpcion = { id: string; nombre: string; nivel: number; iva: string; margen: string };

const NUEVO: DatosProducto = {
  nombre: "",
  marca: "",
  categoriaId: "",
  plu: "",
  sinonimos: "",
  unidadBase: "unidad",
  tarifaIva: "15",
  stockMinimo: "",
  manejaCaducidad: false,
  retornable: false,
  soloMayores: false,
  ubicacion: "",
  activo: true,
  fotoRuta: "",
  costoUnitario: "",
  stockInicial: "",
  presentaciones: [
    { nombre: "Unidad", factor: "1", precioVenta: "", paraVenta: true, paraCompra: true, esBase: true, codigos: "" },
  ],
};

export function FormularioProducto({
  valores,
  categorias,
  redondeo,
  puedeCambiarPrecios,
  puedeVerCostos,
  urlFotos,
}: {
  valores: ValoresIniciales | null;
  categorias: CategoriaOpcion[];
  redondeo: string;
  puedeCambiarPrecios: boolean;
  puedeVerCostos: boolean;
  urlFotos: string;
}) {
  const router = useRouter();
  const nuevo = !valores?.id;
  const [error, setError] = useState<string>();
  const [guardando, iniciar] = useTransition();
  const [buscandoDatos, iniciarBusqueda] = useTransition();
  const [sugerencia, setSugerencia] = useState<DatosOpenFoodFacts | null>(null);
  const [subiendoFoto, setSubiendoFoto] = useState(false);

  const formulario = useForm<DatosProducto>({
    resolver: zodResolver(esquemaProducto),
    defaultValues: valores ?? NUEVO,
  });
  const { register, control, handleSubmit, formState, setValue, getValues } = formulario;
  const { fields, append, remove } = useFieldArray({ control, name: "presentaciones" });
  const e = formState.errors;

  const [categoriaId, unidadBase, fotoRuta, costoTexto] = useWatch({
    control,
    name: ["categoriaId", "unidadBase", "fotoRuta", "costoUnitario"],
  });
  const categoria = categorias.find((c) => c.id === categoriaId);
  const unidad = UNIDADES[unidadBase as UnidadBase];
  const costoBase = leerNumero(costoTexto ?? "");

  function cambiarCategoria(id: string) {
    setValue("categoriaId", id);
    const c = categorias.find((x) => x.id === id);
    if (c && nuevo) setValue("tarifaIva", c.iva as DatosProducto["tarifaIva"]);
  }

  function cambiarUnidad(u: UnidadBase) {
    setValue("unidadBase", u);
    const ps = getValues("presentaciones");
    const i = ps.findIndex((p) => p.esBase);
    const nombresBase = Object.values(UNIDADES).map((x) => x.presentacionBase);
    if (i >= 0 && nombresBase.includes(ps[i].nombre)) setValue(`presentaciones.${i}.nombre`, UNIDADES[u].presentacionBase);
  }

  async function elegirFoto(archivo: File | undefined) {
    if (!archivo) return;
    setSubiendoFoto(true);
    const datos = new FormData();
    datos.set("foto", await achicarFoto(archivo));
    const r = await subirFotoProducto(datos);
    setSubiendoFoto(false);
    if (r.ok) setValue("fotoRuta", r.datos!.ruta, { shouldDirty: true });
    else toast.error(r.mensaje);
  }

  function buscarDatos() {
    const base = getValues("presentaciones").find((p) => p.esBase);
    const codigo = base?.codigos.split(/[\s,;]+/).find(Boolean) ?? "";
    if (!codigo) return toast.error("Primero escanea o escribe el código de barras de la unidad.");
    iniciarBusqueda(async () => {
      const r = await buscarEnOpenFoodFacts(codigo);
      if (!r.ok) return void toast.error(r.mensaje);
      const d = r.datos!;
      if (!getValues("nombre") && d.nombre) setValue("nombre", d.nombre);
      if (!getValues("marca") && d.marca) setValue("marca", d.marca);
      setSugerencia(d);
      toast.success("Encontrado. Revisa los datos.");
    });
  }

  async function usarFotoSugerida() {
    if (!sugerencia?.foto) return;
    setSubiendoFoto(true);
    const r = await guardarFotoDesdeOpenFoodFacts(sugerencia.foto);
    setSubiendoFoto(false);
    if (r.ok) {
      setValue("fotoRuta", r.datos!.ruta, { shouldDirty: true });
      setSugerencia({ ...sugerencia, foto: null });
    } else toast.error(r.mensaje);
  }

  const enviar = (otro: boolean) =>
    handleSubmit((datos) =>
      iniciar(async () => {
        setError(undefined);
        const r = await guardarProducto(datos);
        if (!r.ok) {
          setError(r.mensaje);
          window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }
        toast.success(r.mensaje);
        router.push(otro ? "/catalogo/nuevo?otro=1" : "/catalogo");
        router.refresh();
      }),
    )();

  return (
    <form onSubmit={(ev) => (ev.preventDefault(), enviar(false))} className="grid max-w-3xl gap-8" noValidate>
      {error && <Aviso tipo="error">{error}</Aviso>}
      {Object.keys(e).length > 0 && <Aviso tipo="error">Revisa los datos marcados en rojo.</Aviso>}

      {/* ------------------------------------------------ datos */}
      <section className="grid gap-4">
        <h2 className="text-xl font-semibold">{t.datos}</h2>

        <div className="flex flex-wrap items-start gap-4">
          <div className="grid justify-items-center gap-2">
            {fotoRuta ? (
              // eslint-disable-next-line @next/next/no-img-element -- foto pública del producto
              <img src={urlFotos + fotoRuta} alt="" className="size-28 rounded-xl border bg-white object-contain" />
            ) : (
              <span className="flex size-28 items-center justify-center rounded-xl border border-dashed text-muted-foreground">
                <Camera className="size-8" aria-hidden />
              </span>
            )}
            <label className="cursor-pointer text-sm font-medium text-primary underline">
              {subiendoFoto ? "Subiendo…" : t.foto}
              <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(ev) => elegirFoto(ev.target.files?.[0])} />
            </label>
            {fotoRuta && (
              <button type="button" className="text-sm text-muted-foreground underline" onClick={() => setValue("fotoRuta", "")}>
                {t.quitarFoto}
              </button>
            )}
          </div>
          <div className="grid min-w-60 flex-1 gap-4">
            <Campo id="nombre" etiqueta={t.nombre} error={e.nombre?.message}>
              <Input id="nombre" autoFocus={nuevo} aria-invalid={!!e.nombre} {...register("nombre")} />
            </Campo>
            <Campo id="marca" etiqueta={t.marca} opcional>
              <Input id="marca" {...register("marca")} />
            </Campo>
          </div>
        </div>

        {sugerencia?.foto && (
          <Aviso tipo="info">
            <div className="flex flex-wrap items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- vista previa de Open Food Facts */}
              <img src={sugerencia.foto} alt="" className="size-16 rounded bg-white object-contain" />
              <Button type="button" size="sm" onClick={usarFotoSugerida} disabled={subiendoFoto}>
                {t.usarFoto}
              </Button>
            </div>
          </Aviso>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo id="categoriaId" etiqueta={t.categoria}>
            <Selector id="categoriaId" value={categoriaId} onChange={(ev) => cambiarCategoria(ev.target.value)}>
              <option value="">{t.sinCategoria}</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </Selector>
          </Campo>
          <Campo id="unidadBase" etiqueta={t.unidadBase} ayuda={t.ayudaUnidad}>
            <Selector id="unidadBase" value={unidadBase} onChange={(ev) => cambiarUnidad(ev.target.value as UnidadBase)}>
              {Object.entries(UNIDADES).map(([clave, u]) => (
                <option key={clave} value={clave}>
                  {u.nombre}
                </option>
              ))}
            </Selector>
          </Campo>
          <Campo id="plu" etiqueta={t.plu} ayuda={t.ayudaPlu} opcional error={e.plu?.message}>
            <div className="flex gap-2">
              <Input id="plu" inputMode="numeric" maxLength={4} className="w-28" {...register("plu")} />
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  const plu = await sugerirPlu();
                  if (plu) setValue("plu", plu, { shouldDirty: true });
                }}
              >
                {t.sugerir}
              </Button>
            </div>
          </Campo>
          <Campo id="sinonimos" etiqueta={t.sinonimos} ayuda={t.ayudaSinonimos} opcional>
            <Input id="sinonimos" {...register("sinonimos")} />
          </Campo>
          <Campo id="ubicacion" etiqueta={t.ubicacion} ayuda={t.ayudaUbicacion} opcional>
            <Input id="ubicacion" {...register("ubicacion")} />
          </Campo>
          <Campo id="stockMinimo" etiqueta={`${t.stockMinimo} (${unidad.nombre.toLowerCase()})`} opcional error={e.stockMinimo?.message}>
            <Input id="stockMinimo" inputMode="decimal" {...register("stockMinimo")} />
          </Campo>
        </div>

        <div className="grid gap-3">
          <label className="flex items-center gap-3 text-base">
            <Casilla {...register("manejaCaducidad")} /> {t.caducidad}
          </label>
          <label className="flex items-center gap-3 text-base">
            <Casilla {...register("retornable")} /> {t.retornable}
          </label>
          <label className="flex items-center gap-3 text-base">
            <Casilla {...register("soloMayores")} /> {t.mayores}
          </label>
          <label className="flex items-center gap-3 text-base">
            <Casilla {...register("activo")} /> {t.activo}
          </label>
        </div>
      </section>

      {/* ------------------------------------------------ costo y stock */}
      {(puedeVerCostos || nuevo || valores) && (
        <section className="grid gap-4 sm:grid-cols-2">
          {puedeVerCostos && (
            <Campo
              id="costoUnitario"
              etiqueta={`${t.costo} ${unidad.nombre.toLowerCase()}`}
              ayuda={t.ayudaCosto}
              opcional
              error={e.costoUnitario?.message}
            >
              <Input id="costoUnitario" inputMode="decimal" placeholder="0.00" {...register("costoUnitario")} />
            </Campo>
          )}
          {nuevo ? (
            <Campo id="stockInicial" etiqueta={`${t.stockInicial} (${unidad.nombre.toLowerCase()})`} ayuda={t.ayudaStockInicial} opcional>
              <Input id="stockInicial" inputMode="decimal" {...register("stockInicial")} />
            </Campo>
          ) : null}
        </section>
      )}

      {/* ------------------------------------------------ presentaciones */}
      <section className="grid gap-4">
        <div className="grid gap-1">
          <h2 className="text-xl font-semibold">{t.presentaciones}</h2>
          <p className="text-muted-foreground">{t.ayudaPresentaciones}</p>
          {e.presentaciones?.root?.message && <p className="font-medium text-destructive">{e.presentaciones.root.message}</p>}
        </div>

        {fields.map((campo, i) => (
          <FilaPresentacion
            key={campo.id}
            indice={i}
            control={control}
            register={register}
            errores={e.presentaciones?.[i]}
            costoBase={costoBase}
            margenObjetivo={categoria?.margen ?? "25"}
            redondeo={redondeo}
            puedeCambiarPrecios={puedeCambiarPrecios}
            onQuitar={() => remove(i)}
            onCodigoInterno={async () => {
              const r = await generarCodigoInterno();
              if (!r.ok) return toast.error(r.mensaje);
              const actuales = getValues(`presentaciones.${i}.codigos`);
              setValue(`presentaciones.${i}.codigos`, [actuales, r.datos!.codigo].filter(Boolean).join(", "), { shouldDirty: true });
            }}
            onUsarPrecio={(precio) => setValue(`presentaciones.${i}.precioVenta`, precio, { shouldDirty: true })}
            onBuscarDatos={campo.esBase ? buscarDatos : undefined}
            buscandoDatos={buscandoDatos}
          />
        ))}

        <Button
          type="button"
          variant="outline"
          className="justify-self-start"
          onClick={() =>
            append({ nombre: "", factor: "", precioVenta: "", paraVenta: true, paraCompra: true, esBase: false, codigos: "" })
          }
        >
          <Plus className="size-5" aria-hidden /> {t.agregarPresentacion}
        </Button>
      </section>

      <div className="sticky bottom-0 -mx-4 flex flex-wrap gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur">
        <Button type="submit" size="lg" disabled={guardando}>
          {guardando ? textosCatalogo.importar.guardando : t.guardar}
        </Button>
        {nuevo && (
          <Button type="button" size="lg" variant="outline" disabled={guardando} onClick={() => enviar(true)}>
            Guardar y crear otro
          </Button>
        )}
      </div>
    </form>
  );
}

function FilaPresentacion({
  indice: i,
  control,
  register,
  errores,
  costoBase,
  margenObjetivo,
  redondeo,
  puedeCambiarPrecios,
  onQuitar,
  onCodigoInterno,
  onUsarPrecio,
  onBuscarDatos,
  buscandoDatos,
}: {
  indice: number;
  control: Control<DatosProducto>;
  register: ReturnType<typeof useForm<DatosProducto>>["register"];
  errores?: { nombre?: { message?: string }; factor?: { message?: string }; precioVenta?: { message?: string } };
  costoBase: ReturnType<typeof leerNumero>;
  margenObjetivo: string;
  redondeo: string;
  puedeCambiarPrecios: boolean;
  onQuitar: () => void;
  onCodigoInterno: () => void;
  onUsarPrecio: (precio: string) => void;
  onBuscarDatos?: () => void;
  buscandoDatos: boolean;
}) {
  const [esBase, factorTexto, precioTexto] = useWatch({
    control,
    name: [`presentaciones.${i}.esBase`, `presentaciones.${i}.factor`, `presentaciones.${i}.precioVenta`],
  });
  const factor = esBase ? dec(1) : leerNumero(factorTexto ?? "");
  const precio = leerNumero(precioTexto ?? "");
  const costo = costoBase && factor ? costoBase.times(factor) : null;
  const margen = precio && costo ? margenSobreCosto(precio, costo) : null;
  const sugerido = costo && costo.gt(0) ? precioSugerido(costo, margenObjetivo, redondeo) : null;
  const perdida = margen !== null && margen.isNegative();
  const id = (campo: string) => `pres-${i}-${campo}`;

  return (
    <div className={cn("grid gap-3 rounded-xl border p-4", esBase && "border-primary/50 bg-primary/5")}>
      <div className="grid gap-3 sm:grid-cols-[1fr_7rem_9rem]">
        <Campo id={id("nombre")} etiqueta={esBase ? `${t.presentacion} (${t.base})` : t.presentacion} error={errores?.nombre?.message}>
          <Input id={id("nombre")} {...register(`presentaciones.${i}.nombre`)} placeholder="Jaba x12" />
        </Campo>
        <Campo id={id("factor")} etiqueta={t.factor} error={errores?.factor?.message}>
          <Input id={id("factor")} inputMode="decimal" disabled={esBase} {...register(`presentaciones.${i}.factor`)} />
        </Campo>
        <Campo id={id("precio")} etiqueta={t.precio} error={errores?.precioVenta?.message}>
          <Input
            id={id("precio")}
            inputMode="decimal"
            placeholder="0.00"
            disabled={!puedeCambiarPrecios}
            className={cn(perdida && "border-destructive text-destructive")}
            {...register(`presentaciones.${i}.precioVenta`)}
          />
        </Campo>
      </div>

      {costo && (
        <p className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 text-base", perdida && "font-semibold text-destructive")}>
          <span>Costo: {formatoDolares(costo)}</span>
          {margen !== null && precio && (
            <span>
              {t.margen}: {margen.toString()}% · {t.ganancia}: {formatoDolares(precio.minus(costo))}
              {perdida && ` · ${t.perdida}`}
            </span>
          )}
          {sugerido && puedeCambiarPrecios && (
            <span className="flex items-center gap-2 text-muted-foreground">
              {t.sugerido} ({margenObjetivo}%): {formatoDolares(sugerido)}
              <Button type="button" size="sm" variant="outline" onClick={() => onUsarPrecio(sugerido.toFixed(2))}>
                {t.usar}
              </Button>
            </span>
          )}
        </p>
      )}

      <Campo id={id("codigos")} etiqueta={t.codigos} ayuda={t.ayudaCodigos} opcional>
        <div className="flex flex-wrap gap-2">
          <Input id={id("codigos")} inputMode="numeric" className="min-w-48 flex-1 font-mono" {...register(`presentaciones.${i}.codigos`)} />
          <Button type="button" variant="outline" onClick={onCodigoInterno} title={t.generarCodigo}>
            <Barcode className="size-5" aria-hidden /> <span className="sr-only sm:not-sr-only">{t.generarCodigo}</span>
          </Button>
          {onBuscarDatos && (
            <Button type="button" variant="outline" onClick={onBuscarDatos} disabled={buscandoDatos}>
              {buscandoDatos ? <Wand2 className="size-5 animate-pulse" aria-hidden /> : <Search className="size-5" aria-hidden />}
              {buscandoDatos ? t.buscando : t.buscarDatos}
            </Button>
          )}
        </div>
      </Campo>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-base">
          <Casilla {...register(`presentaciones.${i}.paraVenta`)} /> {t.venta}
        </label>
        <label className="flex items-center gap-2 text-base">
          <Casilla {...register(`presentaciones.${i}.paraCompra`)} /> {t.compra}
        </label>
        {!esBase && (
          <Button type="button" variant="ghost" className="ml-auto text-destructive" onClick={onQuitar}>
            <Trash2 className="size-5" aria-hidden /> {t.quitar}
          </Button>
        )}
      </div>
    </div>
  );
}
