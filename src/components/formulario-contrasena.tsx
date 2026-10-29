"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Aviso, Campo } from "@/components/formulario";
import { esquemaNuevaContrasena, type DatosNuevaContrasena } from "@/lib/esquemas/usuarios";
import { cambiarContrasena } from "@/server/acciones/acceso";
import { textos } from "@/lib/textos";

const t = textos.acceso;

/** Crear o cambiar la contraseña (enlace del correo, invitación o "Mi cuenta"). */
export function FormularioContrasena({ alTerminar }: { alTerminar?: React.ReactNode }) {
  const [aviso, setAviso] = useState<{ tipo: "error" | "exito"; texto: string }>();
  const [enviando, iniciar] = useTransition();
  const { register, handleSubmit, formState, reset } = useForm<DatosNuevaContrasena>({
    resolver: zodResolver(esquemaNuevaContrasena),
    defaultValues: { contrasena: "", confirmacion: "" },
  });
  const e = formState.errors;

  const enviar = handleSubmit((datos) =>
    iniciar(async () => {
      const r = await cambiarContrasena(datos);
      setAviso(r.ok ? { tipo: "exito", texto: r.mensaje ?? "" } : { tipo: "error", texto: r.mensaje });
      if (r.ok) reset();
    }),
  );

  return (
    <div className="grid gap-4">
      {aviso && <Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso>}
      {aviso?.tipo === "exito" && alTerminar}
      <form onSubmit={enviar} className="grid gap-4" noValidate>
        <Campo id="contrasena" etiqueta={t.contrasenaNueva} ayuda="Al menos 8 caracteres." error={e.contrasena?.message}>
          <Input id="contrasena" type="password" autoComplete="new-password" {...register("contrasena")} />
        </Campo>
        <Campo id="confirmacion" etiqueta={t.confirmarContrasena} error={e.confirmacion?.message}>
          <Input id="confirmacion" type="password" autoComplete="new-password" {...register("confirmacion")} />
        </Campo>
        <Button type="submit" size="lg" disabled={enviando}>
          {enviando ? textos.general.guardando : textos.general.guardar}
        </Button>
      </form>
    </div>
  );
}
