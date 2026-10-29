"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CircleAlert, CircleCheck, Download, Upload } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Aviso, Casilla } from "@/components/formulario";
import { COLUMNAS_PRODUCTOS, revisarFilas, type ClaveColumna, type ContextoImportacion, type FilaProducto } from "@/lib/excel/productos";
import { confirmarImportacion, leerExcelProductos } from "@/server/acciones/catalogo";
import { textosCatalogo } from "@/lib/textos";
import { cn } from "cn";

const t = textosCatalogo.importar;

/** Columnas que se pueden corregir en la vista previa (las demás se ven igual). */
const EDITABLES: ClaveColumna[] = [
  "codigoBarras", "plu", "nombre", "marca", "categoria", "subcategoria", "unidadBase",
  "presentacion", "factor", "precioCompra", "precioVenta", "iva", "stockInicial", "stockMinimo",
];

export function Importador() {
  const router = useRouter();
  const [filas, setFilas] = useState<FilaProducto[]>([]);
  const [contexto, setContexto] = useState<ContextoImportacion | null>(null);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [crearCategorias, setCrearCategorias] = useState(true);
  const [unir, setUnir] = useState<Set<number>>(new Set());
  const [soloErrores, setSoloErrores] = useState(false);
  const [error, setError] = useState<string>();
  const [leyendo, iniciarLectura] = useTransition();
  const [guardando, iniciarGuardado] = useTransition();

  // La revisión se vuelve a hacer cada vez que se corrige una celda.
  const revision = useMemo(() => (contexto ? revisarFilas(filas, contexto) : null), [filas, contexto]);
  const porFila = new Map(revision?.filas.map((r) => [r.fila, r]));
  const conErrores = revision?.filas.filter((r) => r.errores.length).length ?? 0;
  const listas = revision?.filas.filter((r) => !r.vacia && !r.errores.length).length ?? 0;

  function leer(archivo: File | undefined) {
    if (!archivo) return;
    setError(undefined);
    iniciarLectura(async () => {
      const datos = new FormData();
      datos.set("archivo", archivo);
      const r = await leerExcelProductos(datos);
      if (!r.ok) {
        setError(r.mensaje);
        setFilas([]);
        return;
      }
      setFilas(r.datos!.filas);
      setContexto(r.datos!.contexto);
      setAvisos(r.datos!.avisos);
      setUnir(new Set());
    });
  }

  function corregir(fila: number, clave: ClaveColumna, valor: string) {
    setFilas((actual) => actual.map((f) => (f.fila === fila ? { ...f, [clave]: valor } : f)));
  }

  function guardar() {
    setError(undefined);
    iniciarGuardado(async () => {
      const r = await confirmarImportacion({ filas, crearCategorias, unirParecidos: Array.from(unir) });
      if (!r.ok) return setError(r.mensaje);
      toast.success(r.mensaje);
      router.push("/catalogo");
      router.refresh();
    });
  }

  const visibles = filas.filter((f) => !soloErrores || porFila.get(f.fila)?.errores.length);

  return (
    <div className="grid gap-8">
      <section className="grid gap-2">
        <h2 className="text-xl font-semibold">{t.paso1}</h2>
        <p className="text-muted-foreground">{t.paso1Ayuda}</p>
        {/* Enlace normal (no <Link>): es la descarga de un archivo que arma el servidor. */}
        <a href="/catalogo/importar/plantilla" download className={cn(buttonVariants({ variant: "outline" }), "justify-self-start")}>
          <Download className="size-5" aria-hidden /> {t.descargar}
        </a>
      </section>

      <section className="grid gap-2">
        <h2 className="text-xl font-semibold">{t.paso2}</h2>
        <label className={cn(buttonVariants(), "cursor-pointer justify-self-start")}>
          <Upload className="size-5" aria-hidden /> {leyendo ? t.leyendo : t.elegir}
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            onChange={(e) => {
              leer(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
      </section>

      {error && <Aviso tipo="error">{error}</Aviso>}

      {revision && filas.length > 0 && (
        <section className="grid gap-4">
          <h2 className="text-xl font-semibold">{t.paso3}</h2>
          {avisos.map((a) => (
            <Aviso key={a} tipo="info">
              {a}
            </Aviso>
          ))}
          <div className="flex flex-wrap items-center gap-3 text-lg">
            <span className="flex items-center gap-1 text-green-700 dark:text-green-400">
              <CircleCheck className="size-5" aria-hidden /> {t.filasOk(listas)}
            </span>
            {conErrores > 0 && (
              <span className="flex items-center gap-1 font-semibold text-destructive">
                <CircleAlert className="size-5" aria-hidden /> {t.filasError(conErrores)}
              </span>
            )}
            <label className="ml-auto flex items-center gap-2 text-base">
              <Casilla checked={soloErrores} onChange={(e) => setSoloErrores(e.target.checked)} /> {t.soloErrores}
            </label>
          </div>

          {revision.categoriasNuevas.length > 0 && (
            <Aviso tipo="info">
              <p>Categorías que no existen todavía: {revision.categoriasNuevas.join(", ")}.</p>
              <label className="mt-2 flex items-center gap-2">
                <Casilla checked={crearCategorias} onChange={(e) => setCrearCategorias(e.target.checked)} /> {t.crearCategorias}
              </label>
            </Aviso>
          )}

          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left">
                <tr>
                  <th className="p-2">Fila</th>
                  <th className="p-2">Estado</th>
                  {COLUMNAS_PRODUCTOS.filter((c) => EDITABLES.includes(c.clave)).map((c) => (
                    <th key={c.clave} className="p-2 whitespace-nowrap">
                      {c.titulo}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibles.map((f) => {
                  const r = porFila.get(f.fila);
                  if (!r || r.vacia) return null;
                  const mal = r.errores.length > 0;
                  return (
                    <tr key={f.fila} className={cn("border-t align-top", mal ? "bg-destructive/10" : "bg-green-600/5")}>
                      <td className="p-2 font-mono">{f.fila}</td>
                      <td className="min-w-56 p-2">
                        {r.coincidencia.tipo === "nuevo" ? (
                          <Badge variant="secondary">{t.nuevo}</Badge>
                        ) : r.coincidencia.tipo === "parecido" ? (
                          <label className="flex items-center gap-2">
                            <Casilla
                              checked={unir.has(f.fila)}
                              onChange={(e) => {
                                const nuevo = new Set(unir);
                                if (e.target.checked) nuevo.add(f.fila);
                                else nuevo.delete(f.fila);
                                setUnir(nuevo);
                              }}
                            />
                            {t.esElMismo}: {r.coincidencia.nombre}
                          </label>
                        ) : (
                          <Badge>
                            {t.actualiza}: {r.coincidencia.nombre}
                          </Badge>
                        )}
                        {r.errores.map((x) => (
                          <p key={x} className="mt-1 font-medium text-destructive">
                            {x}
                          </p>
                        ))}
                        {r.avisos
                          .filter((x) => !x.startsWith("¿Es") && !x.startsWith("Parece"))
                          .map((x) => (
                            <p key={x} className="mt-1 text-amber-700 dark:text-amber-400">
                              {x}
                            </p>
                          ))}
                      </td>
                      {EDITABLES.map((clave) => (
                        <td key={clave} className="p-1">
                          <input
                            value={f[clave]}
                            onChange={(e) => corregir(f.fila, clave, e.target.value)}
                            aria-label={`${COLUMNAS_PRODUCTOS.find((c) => c.clave === clave)?.titulo} fila ${f.fila}`}
                            className="h-9 w-full min-w-24 rounded border bg-background px-2 text-sm"
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Button size="lg" className="justify-self-start" onClick={guardar} disabled={guardando || conErrores > 0 || listas === 0}>
            {guardando ? t.guardando : `${t.confirmar} (${listas})`}
          </Button>
        </section>
      )}
    </div>
  );
}
