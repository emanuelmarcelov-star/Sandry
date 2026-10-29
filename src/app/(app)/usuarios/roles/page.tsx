import { Suspense } from "react";
import { clienteServidor } from "@/lib/supabase/servidor";
import { requerirPermiso } from "@/server/sesion";
import { textos } from "@/lib/textos";
import { MatrizPermisos } from "./matriz-permisos";

export default function Roles() {
  return (
    <Suspense fallback={<p className="text-lg">{textos.general.cargando}</p>}>
      <Contenido />
    </Suspense>
  );
}

async function Contenido() {
  await requerirPermiso("usuarios.gestionar");
  const supabase = await clienteServidor();
  const [{ data: roles }, { data: permisos }, { data: asignados }] = await Promise.all([
    supabase.from("roles").select("id, nombre, descripcion, es_administradora").order("orden"),
    supabase.from("permisos").select("codigo, grupo, descripcion").order("orden"),
    supabase.from("rol_permisos").select("rol_id, permiso"),
  ]);

  const porRol: Record<string, string[]> = {};
  for (const fila of asignados ?? []) (porRol[fila.rol_id] ??= []).push(fila.permiso);

  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <h1 className="text-3xl font-bold">{textos.roles.titulo}</h1>
        <p className="text-lg text-muted-foreground">{textos.roles.ayuda}</p>
      </div>
      <MatrizPermisos
        roles={(roles ?? []).map((r) => ({
          id: r.id,
          nombre: r.nombre,
          descripcion: r.descripcion,
          esAdministradora: r.es_administradora,
          permisos: porRol[r.id] ?? [],
        }))}
        permisos={permisos ?? []}
      />
    </div>
  );
}
