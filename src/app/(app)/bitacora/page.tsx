import { Suspense } from "react";
import { clienteServidor } from "@/lib/supabase/servidor";
import { requerirPermiso } from "@/server/sesion";
import { ZONA_HORARIA, formatoFecha } from "@/lib/dinero";
import { accionesBitacora, textos } from "@/lib/textos";

const t = textos.bitacora;

export default function Bitacora() {
  return (
    <Suspense fallback={<p className="text-lg">{textos.general.cargando}</p>}>
      <Contenido />
    </Suspense>
  );
}

function hora(fecha: string) {
  return new Intl.DateTimeFormat("es-EC", { timeZone: ZONA_HORARIA, hour: "2-digit", minute: "2-digit" }).format(
    new Date(fecha),
  );
}

async function Contenido() {
  await requerirPermiso("bitacora.ver");
  const supabase = await clienteServidor();
  const [{ data: eventos }, { data: perfiles }] = await Promise.all([
    supabase.from("bitacora").select("id, fecha, usuario_id, accion, entidad_id, detalle").order("fecha", { ascending: false }).limit(200),
    supabase.from("perfiles").select("id, nombre_completo"),
  ]);
  const nombres = new Map((perfiles ?? []).map((p) => [p.id, p.nombre_completo]));

  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <h1 className="text-3xl font-bold">{t.titulo}</h1>
        <p className="text-lg text-muted-foreground">{t.ayuda}</p>
      </div>
      {!eventos?.length ? (
        <p className="text-lg">{t.vacia}</p>
      ) : (
        <ol className="grid gap-2">
          {eventos.map((e) => {
            const sobre = e.entidad_id && nombres.get(e.entidad_id);
            const detalle = e.detalle && Object.keys(e.detalle as object).length ? JSON.stringify(e.detalle) : "";
            return (
              <li key={e.id} className="grid gap-1 rounded-lg border p-3 sm:grid-cols-[10rem_1fr]">
                <span className="text-muted-foreground">
                  {formatoFecha(e.fecha)} {hora(e.fecha)}
                </span>
                <span>
                  <strong>{(e.usuario_id && nombres.get(e.usuario_id)) || "—"}</strong>{" "}
                  {accionesBitacora[e.accion] ?? e.accion}
                  {sobre && sobre !== nombres.get(e.usuario_id ?? "") && <> · {sobre}</>}
                  {detalle && <span className="block break-all text-sm text-muted-foreground">{detalle}</span>}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
