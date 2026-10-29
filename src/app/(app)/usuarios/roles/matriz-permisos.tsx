"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Casilla } from "@/components/formulario";
import { guardarPermisosRol } from "@/server/acciones/usuarios";
import { textos } from "@/lib/textos";

type Rol = { id: string; nombre: string; descripcion: string; esAdministradora: boolean; permisos: string[] };
type Permiso = { codigo: string; grupo: string; descripcion: string };

/** Una tarjeta por rol con sus casillas de permisos, agrupadas. */
export function MatrizPermisos({ roles, permisos }: { roles: Rol[]; permisos: Permiso[] }) {
  const grupos = Array.from(new Set(permisos.map((p) => p.grupo)));
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {roles.map((rol) => (
        <TarjetaRol key={rol.id} rol={rol} permisos={permisos} grupos={grupos} />
      ))}
    </div>
  );
}

function TarjetaRol({ rol, permisos, grupos }: { rol: Rol; permisos: Permiso[]; grupos: string[] }) {
  const [marcados, setMarcados] = useState(new Set(rol.permisos));
  const [guardando, iniciar] = useTransition();
  const cambiado =
    marcados.size !== rol.permisos.length || rol.permisos.some((p) => !marcados.has(p));

  function alternar(codigo: string) {
    const nuevo = new Set(marcados);
    if (nuevo.has(codigo)) nuevo.delete(codigo);
    else nuevo.add(codigo);
    setMarcados(nuevo);
  }

  return (
    <section className="grid content-start gap-4 rounded-xl border p-4">
      <div>
        <h2 className="text-xl font-semibold">{rol.nombre}</h2>
        <p className="text-muted-foreground">{rol.descripcion}</p>
      </div>
      {grupos.map((grupo) => (
        <fieldset key={grupo} className="grid gap-2">
          <legend className="mb-1 font-semibold">{grupo}</legend>
          {permisos
            .filter((p) => p.grupo === grupo)
            .map((p) => (
              <label key={p.codigo} className="flex items-start gap-3 text-base">
                <Casilla
                  checked={rol.esAdministradora || marcados.has(p.codigo)}
                  disabled={rol.esAdministradora}
                  onChange={() => alternar(p.codigo)}
                />
                {p.descripcion}
              </label>
            ))}
        </fieldset>
      ))}
      {!rol.esAdministradora && (
        <Button
          disabled={!cambiado || guardando}
          onClick={() =>
            iniciar(async () => {
              const r = await guardarPermisosRol(rol.id, Array.from(marcados));
              if (r.ok) toast.success(r.mensaje);
              else toast.error(r.mensaje);
            })
          }
        >
          {guardando ? textos.general.guardando : textos.general.guardar}
        </Button>
      )}
    </section>
  );
}
