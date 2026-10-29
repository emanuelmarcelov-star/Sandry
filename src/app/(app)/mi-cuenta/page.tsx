import { Suspense } from "react";
import { clienteServidor } from "@/lib/supabase/servidor";
import { requerirUsuarioActivo } from "@/server/sesion";
import { enlaceFoto } from "@/server/fotos";
import { FormularioContrasena } from "@/components/formulario-contrasena";
import { textos } from "@/lib/textos";
import { FormularioMiPerfil, FormularioPin } from "./formularios";

const t = textos.cuenta;

export default function MiCuenta() {
  return (
    <Suspense fallback={<p className="text-lg">{textos.general.cargando}</p>}>
      <Contenido />
    </Suspense>
  );
}

async function Contenido() {
  const yo = await requerirUsuarioActivo();
  const supabase = await clienteServidor();
  const [{ data: perfil }, { data: tienePin }, foto] = await Promise.all([
    supabase.from("perfiles").select("nombre_completo, telefono, cedula").eq("id", yo.id).single(),
    supabase.rpc("tengo_pin"),
    enlaceFoto(supabase, yo.fotoRuta),
  ]);

  return (
    <div className="grid max-w-xl gap-10">
      <h1 className="text-3xl font-bold">{t.titulo}</h1>

      <section className="grid gap-4">
        <h2 className="text-xl font-semibold">{t.misDatos}</h2>
        <p className="text-muted-foreground">
          {yo.correo} · {yo.rol?.nombre}
        </p>
        <FormularioMiPerfil
          foto={foto}
          valores={{
            nombreCompleto: perfil?.nombre_completo ?? yo.nombre,
            telefono: perfil?.telefono ?? "",
            cedula: perfil?.cedula ?? "",
          }}
        />
      </section>

      <section className="grid gap-4">
        <h2 className="text-xl font-semibold">{t.miPin}</h2>
        <p className="text-muted-foreground">{t.ayudaPin}</p>
        {tienePin && <p className="font-medium">{t.tienesPin}</p>}
        <FormularioPin />
      </section>

      <section className="grid gap-4">
        <h2 className="text-xl font-semibold">{t.miContrasena}</h2>
        <FormularioContrasena />
      </section>
    </div>
  );
}
