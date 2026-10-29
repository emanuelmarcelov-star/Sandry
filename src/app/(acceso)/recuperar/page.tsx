"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Aviso, Campo } from "@/components/formulario";
import { esquemaRecuperar } from "@/lib/esquemas/usuarios";
import { enviarRecuperacion } from "@/server/acciones/acceso";
import { textos } from "@/lib/textos";

const t = textos.acceso;

export default function Recuperar() {
  const [aviso, setAviso] = useState<{ tipo: "error" | "exito"; texto: string }>();
  const [enviando, iniciar] = useTransition();
  const { register, handleSubmit, formState } = useForm<{ correo: string }>({
    resolver: zodResolver(esquemaRecuperar),
    defaultValues: { correo: "" },
  });

  const enviar = handleSubmit((datos) =>
    iniciar(async () => {
      const r = await enviarRecuperacion(datos);
      setAviso(r.ok ? { tipo: "exito", texto: r.mensaje ?? "" } : { tipo: "error", texto: r.mensaje });
    }),
  );

  return (
    <div className="grid gap-6">
      <div className="grid gap-2 text-center">
        <h1 className="text-3xl font-bold">{t.tituloRecuperar}</h1>
        <p className="text-base text-muted-foreground">{t.ayudaRecuperar}</p>
      </div>
      {aviso && <Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso>}
      <form onSubmit={enviar} className="grid gap-4" noValidate>
        <Campo id="correo" etiqueta={t.correo} error={formState.errors.correo?.message}>
          <Input id="correo" type="email" autoComplete="email" inputMode="email" {...register("correo")} />
        </Campo>
        <Button type="submit" size="lg" disabled={enviando}>
          {enviando ? t.enviando : t.enviarEnlace}
        </Button>
      </form>
      <Link className="text-center text-base font-medium text-primary underline" href="/entrar">
        {textos.general.volver}
      </Link>
    </div>
  );
}
