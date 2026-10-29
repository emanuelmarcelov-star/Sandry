"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Aviso, Campo, Casilla } from "@/components/formulario";
import { esquemaEntrar, type DatosEntrar } from "@/lib/esquemas/usuarios";
import { entrar } from "@/server/acciones/acceso";
import { textos } from "@/lib/textos";

const t = textos.acceso;
const MOTIVOS: Record<string, string> = {
  inactividad: t.motivoInactividad,
  desactivada: t.motivoDesactivada,
  "enlace-vencido": t.enlaceVencido,
};

export function FormularioEntrar() {
  const parametros = useSearchParams();
  const motivo = MOTIVOS[parametros.get("motivo") ?? ""];
  const [error, setError] = useState<string>();
  const [enviando, iniciar] = useTransition();
  const { register, handleSubmit, formState } = useForm<DatosEntrar>({
    resolver: zodResolver(esquemaEntrar),
    defaultValues: { correo: "", contrasena: "", recordar: true },
  });
  const e = formState.errors;

  const enviar = handleSubmit((datos) =>
    iniciar(async () => {
      setError(undefined);
      const r = await entrar(datos, parametros.get("siguiente") ?? undefined);
      if (r && !r.ok) setError(r.mensaje);
    }),
  );

  return (
    <div className="grid gap-6">
      <h1 className="text-center text-3xl font-bold">{t.tituloEntrar}</h1>
      {motivo && <Aviso tipo="info">{motivo}</Aviso>}
      {error && <Aviso tipo="error">{error}</Aviso>}

      <form onSubmit={enviar} className="grid gap-4" noValidate>
        <Campo id="correo" etiqueta={t.correo} error={e.correo?.message}>
          <Input id="correo" type="email" autoComplete="email" inputMode="email" aria-invalid={!!e.correo} {...register("correo")} />
        </Campo>
        <Campo id="contrasena" etiqueta={t.contrasena} error={e.contrasena?.message}>
          <Input id="contrasena" type="password" autoComplete="current-password" aria-invalid={!!e.contrasena} {...register("contrasena")} />
        </Campo>
        <label className="flex items-center gap-3 text-base">
          <Casilla {...register("recordar")} />
          {t.recordarme}
        </label>
        <Button type="submit" size="lg" disabled={enviando}>
          {enviando ? t.entrando : t.entrar}
        </Button>
      </form>

      <div className="grid gap-3 text-center text-base">
        <Link className="font-medium text-primary underline" href="/recuperar">{t.olvideContrasena}</Link>
        <Link className="font-medium text-primary underline" href="/olvide-correo">{t.olvideCorreo}</Link>
        <Link className="inline-flex items-center justify-center gap-2 font-medium text-primary underline" href="/cambiar-usuario">
          <KeyRound className="size-5" aria-hidden />
          {t.cambiarConPin}
        </Link>
        <p>
          {t.noTengoCuenta}{" "}
          <Link className="font-medium text-primary underline" href="/registro">{t.registrarme}</Link>
        </p>
      </div>
    </div>
  );
}
