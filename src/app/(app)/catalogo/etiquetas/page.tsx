import { Suspense } from "react";
import { requerirPermiso } from "@/server/sesion";
import { etiquetasPendientes } from "@/server/catalogo";
import { textosCatalogo } from "@/lib/textos";
import { HojaEtiquetas } from "./hoja-etiquetas";

const t = textosCatalogo.etiquetas;

export default function Etiquetas() {
  return (
    <Suspense fallback={<p className="text-lg">Cargando…</p>}>
      <Contenido />
    </Suspense>
  );
}

async function Contenido() {
  const yo = await requerirPermiso("productos.editar");
  const pendientes = await etiquetasPendientes(yo);
  return (
    <div className="grid gap-5">
      <div className="grid gap-1 print:hidden">
        <h1 className="text-3xl font-bold">{t.titulo}</h1>
        <p className="text-lg text-muted-foreground">{t.ayuda}</p>
      </div>
      <HojaEtiquetas pendientes={pendientes} />
    </div>
  );
}
