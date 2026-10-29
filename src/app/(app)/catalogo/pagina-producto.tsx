import { notFound } from "next/navigation";
import { clienteServidor } from "@/lib/supabase/servidor";
import { formatoDolares, formatoFecha } from "@/lib/dinero";
import { cantidadConUnidad } from "@/lib/catalogo";
import { ZONA_HORARIA } from "@/lib/dinero";
import { AjusteStock } from "./ajuste-stock";

function horaEcuador(fecha: string) {
  return new Intl.DateTimeFormat("es-EC", { timeZone: ZONA_HORARIA, hour: "2-digit", minute: "2-digit" }).format(new Date(fecha));
}
import { textosCatalogo } from "@/lib/textos";
import { puede, requerirPermiso } from "@/server/sesion";
import { categoriasEnArbol, listarCategorias, obtenerProducto, valoresEfectivos } from "@/server/catalogo";
import { FormularioProducto, type ValoresIniciales } from "./formulario-producto";

const t = textosCatalogo.formulario;

/** Pantalla de crear (sin id) o editar (con id) un producto. */
export async function PaginaProducto({ id }: { id?: string }) {
  const yo = await requerirPermiso("productos.editar");
  const supabase = await clienteServidor();
  const [categorias, producto, { data: ajustes }] = await Promise.all([
    listarCategorias(),
    id ? obtenerProducto(id, yo) : Promise.resolve(null),
    supabase.from("ajustes").select("redondeo_precio").maybeSingle(),
  ]);
  if (id && !producto) notFound();

  const efectivos = valoresEfectivos(categorias);
  const arbol = categoriasEnArbol(categorias).filter((c) => c.activa || c.id === producto?.categoriaId);
  const verCostos = puede(yo, "costos.ver");

  const valores: ValoresIniciales | null = producto
    ? {
        id: producto.id,
        nombre: producto.nombre,
        marca: producto.marca,
        categoriaId: producto.categoriaId ?? "",
        plu: producto.plu ?? "",
        sinonimos: producto.sinonimos.join(", "),
        unidadBase: producto.unidadBase,
        tarifaIva: producto.tarifaIva,
        stockMinimo: producto.stockMinimo === "0" ? "" : producto.stockMinimo,
        manejaCaducidad: producto.manejaCaducidad,
        retornable: producto.retornable,
        soloMayores: producto.soloMayores,
        ubicacion: producto.ubicacion,
        activo: producto.activo,
        fotoRuta: producto.fotoRuta ?? "",
        costoUnitario: producto.costo && Number(producto.costo) > 0 ? producto.costo : "",
        stockInicial: "",
        presentaciones: producto.presentaciones.map((p) => ({
          id: p.id,
          nombre: p.nombre,
          factor: p.factor,
          precioVenta: p.precioVenta ?? "",
          paraVenta: p.paraVenta,
          paraCompra: p.paraCompra,
          esBase: p.esBase,
          codigos: p.codigos.join(", "),
        })),
        stockActual: producto.stock,
      }
    : null;

  // Últimos movimientos del kardex (solo quien ve costos puede leerlo).
  let movimientos: { fecha: string; texto: string; saldo: string }[] = [];
  if (producto && verCostos) {
    const { data } = await supabase
      .from("movimientos_stock")
      .select("fecha, tipo, cantidad, saldo, nota")
      .eq("producto_id", producto.id)
      .order("fecha", { ascending: false })
      .limit(8);
    movimientos = (data ?? []).map((m) => {
      const cantidad = Number(m.cantidad);
      const signo = cantidad > 0 ? "+" : "−";
      const tipo = textosCatalogo.stock.tipos[m.tipo] ?? m.tipo;
      return {
        fecha: `${formatoFecha(m.fecha)} ${horaEcuador(m.fecha)}`,
        texto: `${tipo}: ${signo}${cantidadConUnidad(Math.abs(cantidad), producto.unidadBase)}${m.nota ? ` · ${m.nota}` : ""}`,
        saldo: cantidadConUnidad(String(m.saldo), producto.unidadBase),
      };
    });
  }

  let historial: { fecha: string; texto: string }[] = [];
  if (producto && (puede(yo, "precios.cambiar") || verCostos)) {
    const { data } = await supabase
      .from("historial_precios")
      .select("fecha, tipo, antes, despues, presentaciones(nombre)")
      .eq("producto_id", producto.id)
      .order("fecha", { ascending: false })
      .limit(30);
    historial = (data ?? []).map((h) => {
      const pres = (h.presentaciones as unknown as { nombre: string } | null)?.nombre;
      const quien = h.tipo === "costo" ? "Costo" : `Precio ${pres ?? ""}`;
      const antes = h.antes === null ? "—" : formatoDolares(String(h.antes));
      const despues = h.despues === null ? "—" : formatoDolares(String(h.despues));
      return { fecha: formatoFecha(h.fecha), texto: `${quien}: ${antes} → ${despues}` };
    });
  }

  return (
    <div className="grid gap-8">
      <h1 className="text-3xl font-bold">{producto ? t.tituloEditar : t.tituloNuevo}</h1>
      {producto && (puede(yo, "compras.registrar") || puede(yo, "inventario.ajustar")) && (
        <AjusteStock
          productoId={producto.id}
          stock={producto.stock}
          unidad={producto.unidadBase}
          presentaciones={producto.presentaciones.map((p) => ({
            nombre: p.nombre,
            factor: p.factor,
            paraCompra: p.paraCompra,
            esBase: p.esBase,
          }))}
          puedeSumar={puede(yo, "compras.registrar")}
          puedeAjustar={puede(yo, "inventario.ajustar")}
          movimientos={movimientos}
        />
      )}
      <FormularioProducto
        valores={valores}
        categorias={arbol.map((c) => ({
          id: c.id,
          nombre: c.ruta,
          nivel: c.nivel,
          iva: efectivos[c.id].tarifaIva,
          margen: efectivos[c.id].margen,
        }))}
        redondeo={String(ajustes?.redondeo_precio ?? "0.05")}
        puedeCambiarPrecios={puede(yo, "precios.cambiar")}
        puedeVerCostos={verCostos}
        urlFotos={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/fotos-productos/`}
      />
      {producto && historial.length > 0 && (
        <section className="grid max-w-3xl gap-2">
          <h2 className="text-xl font-semibold">{t.historial}</h2>
          <ul className="grid gap-1 text-base">
            {historial.map((h, i) => (
              <li key={i} className="flex gap-3">
                <span className="w-24 shrink-0 text-muted-foreground">{h.fecha}</span>
                <span>{h.texto}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
