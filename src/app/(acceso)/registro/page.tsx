"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Aviso, Campo } from "@/components/formulario";
import { esquemaRegistro, type DatosRegistro } from "@/lib/esquemas/usuarios";
import { registrarse } from "@/server/acciones/acceso";
import { textos } from "@/lib/textos";

const t = textos.acceso;

export default function Registro() {
  const [aviso, setAviso] = useState<{ tipo: "error" | "exito"; texto: string }>();
  const [enviando, iniciar] = useTransition();
  const { register, handleSubmit, formState, setError } = useForm<DatosRegistro>({
    resolver: zodResolver(esquemaRegistro),
    defaultValues: { nombreCompleto: "", correo: "", telefono: "", cedula: "", contrasena: "", confirmacion: "" },
  });
  const e = formState.errors;

  const enviar = handleSubmit((_, evento) =>
    iniciar(async () => {
      setAviso(undefined);
      const formulario = new FormData(evento?.target as HTMLFormElement);
      const r = await registrarse(formulario);
      if (!r) return;
      if (r.ok) {
        setAviso({ tipo: "exito", texto: r.mensaje ?? "" });
        return;
      }
      setAviso({ tipo: "error", texto: r.mensaje });
      for (const [campo, mensaje] of Object.entries(r.campos ?? {})) {
        setError(campo as keyof DatosRegistro, { message: mensaje });
      }
    }),
  );

  return (
    <div className="grid gap-6">
      <div className="grid gap-2 text-center">
        <h1 className="text-3xl font-bold">{t.tituloRegistro}</h1>
        <p className="text-base text-muted-foreground">{t.ayudaRegistro}</p>
      </div>
      {aviso && <Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso>}

      <form onSubmit={enviar} className="grid gap-4" noValidate encType="multipart/form-data">
        <Campo id="nombreCompleto" etiqueta={t.nombreCompleto} error={e.nombreCompleto?.message}>
          <Input id="nombreCompleto" autoComplete="name" aria-invalid={!!e.nombreCompleto} {...register("nombreCompleto")} />
        </Campo>
        <Campo id="correo" etiqueta={t.correo} error={e.correo?.message}>
          <Input id="correo" type="email" autoComplete="email" inputMode="email" aria-invalid={!!e.correo} {...register("correo")} />
        </Campo>
        <Campo id="telefono" etiqueta={t.telefono} error={e.telefono?.message}>
          <Input id="telefono" type="tel" autoComplete="tel" inputMode="tel" placeholder="0991234567" aria-invalid={!!e.telefono} {...register("telefono")} />
        </Campo>
        <Campo id="cedula" etiqueta={t.cedula} opcional error={e.cedula?.message}>
          <Input id="cedula" inputMode="numeric" maxLength={10} aria-invalid={!!e.cedula} {...register("cedula")} />
        </Campo>
        <Campo id="contrasena" etiqueta={t.contrasena} ayuda="Al menos 8 caracteres." error={e.contrasena?.message}>
          <Input id="contrasena" type="password" autoComplete="new-password" aria-invalid={!!e.contrasena} {...register("contrasena")} />
        </Campo>
        <Campo id="confirmacion" etiqueta={t.confirmarContrasena} error={e.confirmacion?.message}>
          <Input id="confirmacion" type="password" autoComplete="new-password" aria-invalid={!!e.confirmacion} {...register("confirmacion")} />
        </Campo>
        <Campo id="foto" etiqueta={t.foto} opcional ayuda="JPG, PNG o WEBP, hasta 2 MB.">
          <Input id="foto" name="foto" type="file" accept="image/jpeg,image/png,image/webp" className="h-auto py-2 text-base" />
        </Campo>
        <Button type="submit" size="lg" disabled={enviando}>
          {enviando ? t.creando : t.crearCuenta}
        </Button>
      </form>

      <p className="text-center text-base">
        {t.yaTengoCuenta}{" "}
        <Link className="font-medium text-primary underline" href="/entrar">{t.entrar}</Link>
      </p>
    </div>
  );
}
