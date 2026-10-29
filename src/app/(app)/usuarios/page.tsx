import { Suspense } from "react";
import { clienteServidor } from "@/lib/supabase/servidor";
import { requerirPermiso } from "@/server/sesion";
import { textos } from "@/lib/textos";
import { ListaUsuarios, type Persona } from "./lista-usuarios";
import { DialogoInvitar } from "./dialogo-invitar";

const t = textos.usuarios;

export default function Usuarios() {
  return (
    <Suspense fallback={<p className="text-lg">{textos.general.cargando}</p>}>
      <Contenido />
    </Suspense>
  );
}

async function Contenido() {
  const yo = await requerirPermiso("usuarios.gestionar");
  const supabase = await clienteServidor();
  const [{ data: perfiles }, { data: roles }] = await Promise.all([
    supabase
      .from("perfiles")
      .select("id, nombre_completo, correo, telefono, cedula, rol_id, estado, creado_en")
      .order("creado_en"),
    supabase.from("roles").select("id, nombre").order("orden"),
  ]);

  const personas: Persona[] = (perfiles ?? []).map((p) => ({
    id: p.id,
    nombre: p.nombre_completo,
    correo: p.correo,
    telefono: p.telefono,
    cedula: p.cedula,
    rol: p.rol_id,
    estado: p.estado,
    creadoEn: p.creado_en,
    soyYo: p.id === yo.id,
  }));
  const listaRoles = (roles ?? []).map((r) => ({ id: r.id, nombre: r.nombre }));

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">{t.titulo}</h1>
        <DialogoInvitar roles={listaRoles} />
      </div>
      <ListaUsuarios personas={personas} roles={listaRoles} />
    </div>
  );
}
