"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Aviso, Campo, Selector } from "@/components/formulario";
import { textos, textosInventario } from "@/lib/textos";
import { iniciarConteo } from "@/server/acciones/abastecimiento";

const t = textosInventario.conteos;

export function NuevoConteo({ categorias }: { categorias: { id: string; nombre: string }[] }) {
  const router = useRouter();
  const [categoriaId, setCategoriaId] = useState("");
  const [error, setError] = useState<string>();
  const [empezando, iniciar] = useTransition();
  return (
    <form
      className="grid gap-3 rounded-xl border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        iniciar(async () => {
          const r = await iniciarConteo("", categoriaId);
          if (!r.ok) return setError(r.mensaje);
          router.push(`/inventario/conteos/${r.datos!.id}`);
        });
      }}
    >
      {error && <Aviso tipo="error">{error}</Aviso>}
      <Campo id="conteo-categoria" etiqueta={t.categoria}>
        <Selector id="conteo-categoria" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
          <option value="">{t.todo}</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </Selector>
      </Campo>
      <Button type="submit" size="lg" disabled={empezando}>
        <ClipboardList className="size-5" aria-hidden /> {empezando ? textos.general.cargando : t.nuevo}
      </Button>
    </form>
  );
}
