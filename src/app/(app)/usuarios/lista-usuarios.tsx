"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Mail, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Selector } from "@/components/formulario";
import {
  aprobarUsuario,
  cambiarCorreoUsuario,
  cambiarEstado,
  cambiarRol,
  resetearPin,
} from "@/server/acciones/usuarios";
import type { Resultado } from "@/lib/errores";
import { formatoFecha } from "@/lib/dinero";
import { textos } from "@/lib/textos";

const t = textos.usuarios;

export type Persona = {
  id: string;
  nombre: string;
  correo: string;
  telefono: string;
  cedula: string | null;
  rol: string | null;
  estado: "pendiente" | "activo" | "desactivado";
  creadoEn: string;
  soyYo: boolean;
};
type Rol = { id: string; nombre: string };

export function ListaUsuarios({ personas, roles }: { personas: Persona[]; roles: Rol[] }) {
  const grupos = [
    { titulo: t.pendientes, lista: personas.filter((p) => p.estado === "pendiente") },
    { titulo: t.activos, lista: personas.filter((p) => p.estado === "activo") },
    { titulo: t.desactivados, lista: personas.filter((p) => p.estado === "desactivado") },
  ];
  return (
    <div className="grid gap-8">
      {grupos.map(({ titulo, lista }) => (
        <section key={titulo} className="grid gap-3">
          <h2 className="text-xl font-semibold">
            {titulo} <span className="text-muted-foreground">({lista.length})</span>
          </h2>
          {lista.length === 0 ? (
            <p className="text-muted-foreground">{t.ninguno}</p>
          ) : (
            lista.map((p) => <TarjetaPersona key={p.id} persona={p} roles={roles} />)
          )}
        </section>
      ))}
    </div>
  );
}

function TarjetaPersona({ persona: p, roles }: { persona: Persona; roles: Rol[] }) {
  const [rol, setRol] = useState(p.rol ?? "cajera");
  const [editandoCorreo, setEditandoCorreo] = useState(false);
  const [correo, setCorreo] = useState(p.correo);
  const [ocupado, iniciar] = useTransition();
  const nombreRol = roles.find((r) => r.id === p.rol)?.nombre;

  function ejecutar(accion: () => Promise<Resultado>, alTerminar?: () => void) {
    iniciar(async () => {
      const r = await accion();
      if (r.ok) {
        toast.success(r.mensaje);
        alTerminar?.();
      } else toast.error(r.mensaje);
    });
  }

  return (
    <article className="grid gap-3 rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="grid gap-1">
          <p className="text-lg font-semibold">
            {p.nombre} {p.soyYo && <span className="font-normal text-muted-foreground">{t.tu}</span>}
          </p>
          <p className="flex items-center gap-2 text-muted-foreground">
            <Mail className="size-4" aria-hidden /> {p.correo}
          </p>
          {p.telefono && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <Phone className="size-4" aria-hidden /> {p.telefono}
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            {t.registrada} {formatoFecha(p.creadoEn)}
          </p>
        </div>
        {nombreRol && <Badge className="text-sm">{nombreRol}</Badge>}
      </div>

      {editandoCorreo && (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            ejecutar(() => cambiarCorreoUsuario(p.id, correo), () => setEditandoCorreo(false));
          }}
        >
          <Input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} className="min-w-56 flex-1" aria-label={t.cambiarCorreo} />
          <Button type="submit" disabled={ocupado}>{textos.general.guardar}</Button>
          <Button type="button" variant="ghost" onClick={() => setEditandoCorreo(false)}>{textos.general.cancelar}</Button>
        </form>
      )}

      {!p.soyYo && (
        <div className="flex flex-wrap items-center gap-2">
          {p.estado !== "desactivado" && (
            <>
              <Selector value={rol} onChange={(e) => setRol(e.target.value)} aria-label={t.rol} className="w-auto min-w-52">
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.nombre}</option>
                ))}
              </Selector>
              {p.estado === "pendiente" ? (
                <Button disabled={ocupado} onClick={() => ejecutar(() => aprobarUsuario(p.id, rol))}>{t.aprobar}</Button>
              ) : (
                rol !== p.rol && (
                  <Button disabled={ocupado} onClick={() => ejecutar(() => cambiarRol(p.id, rol))}>{textos.general.guardar}</Button>
                )
              )}
            </>
          )}
          {p.estado === "activo" && (
            <Button variant="outline" disabled={ocupado} onClick={() => ejecutar(() => resetearPin(p.id))}>{t.resetearPin}</Button>
          )}
          {!editandoCorreo && (
            <Button variant="outline" disabled={ocupado} onClick={() => setEditandoCorreo(true)}>{t.cambiarCorreo}</Button>
          )}
          {p.estado === "desactivado" ? (
            <Button variant="outline" disabled={ocupado} onClick={() => ejecutar(() => cambiarEstado(p.id, true))}>{t.reactivar}</Button>
          ) : (
            <Button
              variant="destructive"
              disabled={ocupado}
              onClick={() => window.confirm(t.confirmarDesactivar) && ejecutar(() => cambiarEstado(p.id, false))}
            >
              {t.desactivar}
            </Button>
          )}
        </div>
      )}
    </article>
  );
}
