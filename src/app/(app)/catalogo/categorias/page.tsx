import { Suspense } from "react";
import { requerirPermiso } from "@/server/sesion";
import { categoriasEnArbol, listarCategorias, valoresEfectivos } from "@/server/catalogo";
import { textosCatalogo } from "@/lib/textos";
import { ArbolCategorias } from "./arbol";

const t = textosCatalogo.categorias;

export default function Categorias() {
  return (
    <Suspense fallback={<p className="text-lg">Cargando…</p>}>
      <Contenido />
    </Suspense>
  );
}

async function Contenido() {
  await requerirPermiso("productos.editar");
  const categorias = await listarCategorias();
  const efectivos = valoresEfectivos(categorias);
  return (
    <div className="grid gap-5">
      <div className="grid gap-1">
        <h1 className="text-3xl font-bold">{t.titulo}</h1>
        <p className="text-lg text-muted-foreground">{t.ayuda}</p>
      </div>
      <ArbolCategorias
        categorias={categoriasEnArbol(categorias).map((c) => ({
          ...c,
          ivaEfectivo: efectivos[c.id].tarifaIva,
          margenEfectivo: efectivos[c.id].margen,
        }))}
      />
    </div>
  );
}
