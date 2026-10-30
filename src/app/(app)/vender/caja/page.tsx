import { Suspense } from "react";
import { clienteServidor } from "@/lib/supabase/servidor";
import { textos, textosVentas } from "@/lib/textos";
import { puede, requerirPermiso } from "@/server/sesion";
import { resumenCaja } from "@/server/ventas";
import { PantallaCaja } from "./pantalla-caja";

export default function Caja() {
  return (
    <div className="grid max-w-xl gap-4">
      <h1 className="text-3xl font-bold">{textosVentas.caja.titulo}</h1>
      <Suspense fallback={<p className="text-lg">{textos.general.cargando}</p>}>
        <Contenido />
      </Suspense>
    </div>
  );
}

async function Contenido() {
  const yo = await requerirPermiso("caja.abrir_cerrar");
  const abierta = await resumenCaja();
  let ultima = null;
  if (!abierta) {
    const supabase = await clienteServidor();
    const { data } = await supabase.from("cajas").select("id").order("abierta_en", { ascending: false }).limit(1);
    if (data?.[0]) ultima = await resumenCaja(data[0].id);
  }
  return <PantallaCaja abierta={abierta?.estado === "abierta" ? abierta : null} ultima={ultima} puedeReabrir={puede(yo, "caja.reabrir")} />;
}
