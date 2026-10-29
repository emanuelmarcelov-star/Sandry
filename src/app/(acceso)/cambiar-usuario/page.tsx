import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { personasDelDispositivo } from "@/server/acciones/pin";
import { SelectorPin } from "./selector-pin";
import { textos } from "@/lib/textos";

const t = textos.pin;

export default function CambiarUsuario() {
  return (
    <div className="grid gap-6">
      <div className="grid gap-2 text-center">
        <h1 className="text-3xl font-bold">{t.titulo}</h1>
        <p className="text-base text-muted-foreground">{t.ayuda}</p>
      </div>
      <Suspense fallback={<p className="text-center">{textos.general.cargando}</p>}>
        <Personas />
      </Suspense>
      <Link className="text-center text-base font-medium text-primary underline" href="/entrar">
        {t.otraPersona}
      </Link>
    </div>
  );
}

async function Personas() {
  await connection();
  const personas = await personasDelDispositivo();
  if (!personas.length) return <p className="text-center text-lg">{t.nadie}</p>;
  return <SelectorPin personas={personas} />;
}
