"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Campo } from "@/components/formulario";
import { esquemaMiPerfil, type DatosMiPerfil } from "@/lib/esquemas/usuarios";
import { definirMiPin, guardarMiPerfil } from "@/server/acciones/cuenta";
import { textos } from "@/lib/textos";

const ta = textos.acceso;
const tc = textos.cuenta;

export function FormularioMiPerfil({ valores, foto }: { valores: DatosMiPerfil; foto: string | null }) {
  const [guardando, iniciar] = useTransition();
  const { register, handleSubmit, formState, setError } = useForm<DatosMiPerfil>({
    resolver: zodResolver(esquemaMiPerfil),
    defaultValues: valores,
  });
  const e = formState.errors;

  const enviar = handleSubmit((_, evento) =>
    iniciar(async () => {
      const r = await guardarMiPerfil(new FormData(evento?.target as HTMLFormElement));
      if (r.ok) return void toast.success(r.mensaje);
      toast.error(r.mensaje);
      for (const [campo, mensaje] of Object.entries(r.campos ?? {})) {
        setError(campo as keyof DatosMiPerfil, { message: mensaje });
      }
    }),
  );

  return (
    <form onSubmit={enviar} className="grid gap-4" noValidate>
      <div className="flex items-center gap-4">
        {foto ? (
          // eslint-disable-next-line @next/next/no-img-element -- enlace temporal firmado, no optimizable
          <img src={foto} alt="" className="size-20 rounded-full object-cover" />
        ) : (
          <span className="flex size-20 items-center justify-center rounded-full bg-muted">
            <UserRound className="size-10 text-muted-foreground" aria-hidden />
          </span>
        )}
        <Campo id="foto" etiqueta={ta.foto} opcional>
          <Input id="foto" name="foto" type="file" accept="image/jpeg,image/png,image/webp" className="h-auto py-2 text-base" />
        </Campo>
      </div>
      <Campo id="nombreCompleto" etiqueta={ta.nombreCompleto} error={e.nombreCompleto?.message}>
        <Input id="nombreCompleto" {...register("nombreCompleto")} />
      </Campo>
      <Campo id="telefono" etiqueta={ta.telefono} error={e.telefono?.message}>
        <Input id="telefono" type="tel" inputMode="tel" {...register("telefono")} />
      </Campo>
      <Campo id="cedula" etiqueta={ta.cedula} opcional error={e.cedula?.message}>
        <Input id="cedula" inputMode="numeric" maxLength={10} {...register("cedula")} />
      </Campo>
      <Button type="submit" size="lg" disabled={guardando}>
        {guardando ? textos.general.guardando : textos.general.guardar}
      </Button>
    </form>
  );
}

export function FormularioPin() {
  const [pin, setPin] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [guardando, iniciar] = useTransition();
  const soloNumeros = (v: string) => v.replace(/\D/g, "").slice(0, 6);

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        iniciar(async () => {
          const r = await definirMiPin(pin, confirmacion);
          if (!r.ok) return void toast.error(r.mensaje);
          toast.success(r.mensaje);
          setPin("");
          setConfirmacion("");
        });
      }}
    >
      <Campo id="pin" etiqueta={tc.pin}>
        <Input id="pin" type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={(e) => setPin(soloNumeros(e.target.value))} />
      </Campo>
      <Campo id="pin-confirmacion" etiqueta={tc.confirmarPin}>
        <Input
          id="pin-confirmacion"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          value={confirmacion}
          onChange={(e) => setConfirmacion(soloNumeros(e.target.value))}
        />
      </Campo>
      <Button type="submit" size="lg" disabled={guardando || pin.length < 4}>
        {guardando ? textos.general.guardando : textos.general.guardar}
      </Button>
    </form>
  );
}
