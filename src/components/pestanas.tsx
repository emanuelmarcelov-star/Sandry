"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

export type Pestana = { href: string; etiqueta: string; /** Solo se marca si la ruta es exactamente esta. */ exacta?: boolean };

/** Pestañas de una sección (Compras, Inventario…). */
export function Pestanas({ pestanas, nombre }: { pestanas: Pestana[]; nombre: string }) {
  const ruta = usePathname();
  const activa = (p: Pestana) => ruta === p.href || (!p.exacta && ruta.startsWith(p.href + "/"));
  if (pestanas.length < 2) return null;
  return (
    <nav className="-mx-4 flex gap-1 overflow-x-auto border-b px-4 print:hidden" aria-label={nombre}>
      {pestanas.map((p) => (
        <Link
          key={p.href}
          href={p.href}
          className={cn(
            "shrink-0 border-b-2 px-3 py-3 text-base font-medium whitespace-nowrap",
            activa(p) ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {p.etiqueta}
        </Link>
      ))}
    </nav>
  );
}
