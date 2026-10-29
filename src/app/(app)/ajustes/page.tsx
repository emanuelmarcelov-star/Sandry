import { Suspense } from "react";
import { clienteServidor } from "@/lib/supabase/servidor";
import { requerirPermiso } from "@/server/sesion";
import { textos } from "@/lib/textos";
import { FormularioAjustes } from "./formulario-ajustes";

export default function Ajustes() {
  return (
    <Suspense fallback={<p className="text-lg">{textos.general.cargando}</p>}>
      <Contenido />
    </Suspense>
  );
}

async function Contenido() {
  await requerirPermiso("ajustes.gestionar");
  const supabase = await clienteServidor();
  const { data } = await supabase.from("ajustes").select("minutos_inactividad, descuento_max_sin_autorizacion").maybeSingle();
  return (
    <div className="grid max-w-xl gap-6">
      <h1 className="text-3xl font-bold">{textos.ajustes.titulo}</h1>
      <FormularioAjustes
        valores={{
          minutosInactividad: String(data?.minutos_inactividad ?? 30),
          descuentoMaximo: String(data?.descuento_max_sin_autorizacion ?? 5),
        }}
      />
    </div>
  );
}
