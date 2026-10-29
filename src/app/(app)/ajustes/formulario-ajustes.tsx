"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Campo } from "@/components/formulario";
import { esquemaAjustes, type DatosAjustes, type SalidaAjustes } from "@/lib/esquemas/usuarios";
import { guardarAjustes } from "@/server/acciones/usuarios";
import { textos } from "@/lib/textos";

const t = textos.ajustes;

export function FormularioAjustes({ valores }: { valores: DatosAjustes }) {
  const [guardando, iniciar] = useTransition();
  const { register, handleSubmit, formState } = useForm<DatosAjustes, unknown, SalidaAjustes>({
    resolver: zodResolver(esquemaAjustes),
    defaultValues: valores,
  });
  const e = formState.errors;

  const enviar = handleSubmit((datos) =>
    iniciar(async () => {
      const r = await guardarAjustes(datos);
      if (r.ok) toast.success(r.mensaje);
      else toast.error(r.mensaje);
    }),
  );

  return (
    <form onSubmit={enviar} className="grid gap-4" noValidate>
      <Campo id="minutosInactividad" etiqueta={t.minutosInactividad} error={e.minutosInactividad?.message}>
        <Input id="minutosInactividad" inputMode="numeric" {...register("minutosInactividad")} />
      </Campo>
      <Campo id="descuentoMaximo" etiqueta={t.descuentoMaximo} error={e.descuentoMaximo?.message}>
        <Input id="descuentoMaximo" inputMode="decimal" {...register("descuentoMaximo")} />
      </Campo>
      <Campo id="redondeoPrecio" etiqueta={t.redondeoPrecio} ayuda={t.ayudaRedondeo} error={e.redondeoPrecio?.message}>
        <Input id="redondeoPrecio" inputMode="decimal" {...register("redondeoPrecio")} />
      </Campo>
      <Button type="submit" size="lg" disabled={guardando}>
        {guardando ? textos.general.guardando : textos.general.guardar}
      </Button>
    </form>
  );
}
