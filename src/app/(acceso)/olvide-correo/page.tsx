"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Aviso, Campo } from "@/components/formulario";
import { esquemaOlvideCorreo } from "@/lib/esquemas/usuarios";
import { olvideCorreo } from "@/server/acciones/acceso";
import { textos } from "@/lib/textos";

const t = textos.acceso;

export default function OlvideCorreo() {
  const [correo, setCorreo] = useState<string>();
  const [error, setError] = useState<string>();
  const [enviando, iniciar] = useTransition();
  const { register, handleSubmit, formState } = useForm<{ dato: string }>({
    resolver: zodResolver(esquemaOlvideCorreo),
    defaultValues: { dato: "" },
  });

  const enviar = handleSubmit((datos) =>
    iniciar(async () => {
      setError(undefined);
      setCorreo(undefined);
      const r = await olvideCorreo(datos);
      if (r.ok) setCorreo(r.datos?.correo);
      else setError(r.mensaje);
    }),
  );

  return (
    <div className="grid gap-6">
      <div className="grid gap-2 text-center">
        <h1 className="text-3xl font-bold">{t.tituloOlvideCorreo}</h1>
        <p className="text-base text-muted-foreground">{t.ayudaOlvideCorreo}</p>
      </div>
      {error && <Aviso tipo="error">{error}</Aviso>}
      {correo && (
        <Aviso tipo="exito">
          {t.tuCorreoEs} <strong className="text-lg">{correo}</strong>
        </Aviso>
      )}
      <form onSubmit={enviar} className="grid gap-4" noValidate>
        <Campo id="dato" etiqueta={t.telefonoOCedula} error={formState.errors.dato?.message}>
          <Input id="dato" inputMode="numeric" {...register("dato")} />
        </Campo>
        <Button type="submit" size="lg" disabled={enviando}>
          {t.buscar}
        </Button>
      </form>
      <Link className="text-center text-base font-medium text-primary underline" href="/entrar">
        {textos.general.volver}
      </Link>
    </div>
  );
}
