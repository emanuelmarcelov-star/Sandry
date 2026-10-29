"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Casilla, Selector } from "@/components/formulario";
import { textosCatalogo } from "@/lib/textos";

const t = textosCatalogo.lista;

/** Buscador y filtros: actualizan la dirección y el servidor vuelve a buscar. */
export function FiltrosCatalogo({
  categorias,
  valores,
}: {
  categorias: { id: string; nombre: string; nivel: number }[];
  valores: { q: string; cat: string; inactivos: boolean };
}) {
  const router = useRouter();
  const ruta = usePathname();
  const [texto, setTexto] = useState(valores.q);
  const [, iniciar] = useTransition();

  function ir(cambios: Partial<{ q: string; cat: string; inactivos: boolean }>) {
    const v = { ...valores, q: texto, ...cambios };
    const p = new URLSearchParams();
    if (v.q) p.set("q", v.q);
    if (v.cat) p.set("cat", v.cat);
    if (v.inactivos) p.set("inactivos", "1");
    iniciar(() => router.replace(`${ruta}${p.size ? `?${p}` : ""}`, { scroll: false }));
  }

  // Busca solo mientras se escribe (con una pequeña espera).
  useEffect(() => {
    if (texto === valores.q) return;
    const espera = setTimeout(() => ir({ q: texto }), 300);
    return () => clearTimeout(espera);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo reacciona al texto
  }, [texto]);

  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
      <label className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={t.buscar}
          aria-label={t.buscar}
          className="pl-10"
          autoFocus
        />
      </label>
      <Selector value={valores.cat} onChange={(e) => ir({ cat: e.target.value })} aria-label="Categoría" className="sm:w-64">
        <option value="">{t.todas}</option>
        {categorias.map((c) => (
          <option key={c.id} value={c.id}>
            {"  ".repeat(c.nivel)}
            {c.nombre}
          </option>
        ))}
      </Selector>
      <label className="flex items-center gap-2 text-base sm:col-span-2">
        <Casilla checked={valores.inactivos} onChange={(e) => ir({ inactivos: e.target.checked })} />
        {t.inactivos}
      </label>
    </div>
  );
}
