import Link from "next/link";
import { FormularioContrasena } from "@/components/formulario-contrasena";
import { buttonVariants } from "@/components/ui/button";
import { textos } from "@/lib/textos";

/** Se llega desde el enlace de "Olvidé mi contraseña" o de una invitación. */
export default function CambiarContrasena() {
  return (
    <div className="grid gap-6">
      <h1 className="text-center text-3xl font-bold">{textos.acceso.tituloNuevaContrasena}</h1>
      <FormularioContrasena
        alTerminar={
          <Link href="/" className={buttonVariants({ size: "lg" })}>
            {textos.acceso.irAlInicio}
          </Link>
        }
      />
    </div>
  );
}
