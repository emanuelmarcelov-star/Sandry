"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Aviso, Campo, Selector } from "@/components/formulario";
import { esquemaInvitar, type DatosInvitar } from "@/lib/esquemas/usuarios";
import { invitarUsuario } from "@/server/acciones/usuarios";
import { textos } from "@/lib/textos";

const t = textos.usuarios;

export function DialogoInvitar({ roles }: { roles: { id: string; nombre: string }[] }) {
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState<string>();
  const [enviando, iniciar] = useTransition();
  const { register, handleSubmit, formState, reset } = useForm<DatosInvitar>({
    resolver: zodResolver(esquemaInvitar),
    defaultValues: { nombreCompleto: "", correo: "", rol: "cajera" },
  });
  const e = formState.errors;

  const enviar = handleSubmit((datos) =>
    iniciar(async () => {
      setError(undefined);
      const r = await invitarUsuario(datos);
      if (!r.ok) return setError(r.mensaje);
      toast.success(r.mensaje);
      reset();
      setAbierto(false);
    }),
  );

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger render={<Button />}>
        <Send className="size-5" aria-hidden />
        {t.invitar}
      </DialogTrigger>
      <DialogContent className="text-base sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">{t.invitar}</DialogTitle>
        </DialogHeader>
        {error && <Aviso tipo="error">{error}</Aviso>}
        <form onSubmit={enviar} className="grid gap-4" noValidate>
          <Campo id="inv-nombre" etiqueta={textos.acceso.nombreCompleto} error={e.nombreCompleto?.message}>
            <Input id="inv-nombre" {...register("nombreCompleto")} />
          </Campo>
          <Campo id="inv-correo" etiqueta={textos.acceso.correo} error={e.correo?.message}>
            <Input id="inv-correo" type="email" inputMode="email" {...register("correo")} />
          </Campo>
          <Campo id="inv-rol" etiqueta={t.rol} error={e.rol?.message}>
            <Selector id="inv-rol" {...register("rol")}>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.nombre}</option>
              ))}
            </Selector>
          </Campo>
          <Button type="submit" size="lg" disabled={enviando}>
            {enviando ? textos.acceso.enviando : t.enviarInvitacion}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
