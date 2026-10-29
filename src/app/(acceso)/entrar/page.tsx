import { Suspense } from "react";
import { FormularioEntrar } from "./formulario-entrar";

export default function Entrar() {
  return (
    <Suspense>
      <FormularioEntrar />
    </Suspense>
  );
}
