"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

export function PestanasCatalogo({ pestanas }: { pestanas: { href: string; etiqueta: string }[] }) {
  const ruta = usePathname();
  const activa = (href: string) =>
    href === "/catalogo" ? ruta === "/catalogo" || /^\/catalogo\/(nuevo|[0-9a-f-]{36})/.test(ruta) : ruta.startsWith(href);
  if (pestanas.length < 2) return null;
  return (
    <nav className="-mx-4 flex gap-1 overflow-x-auto border-b px-4 print:hidden" aria-label="Secciones del catálogo">
      {pestanas.map((p) => (
        <Link
          key={p.href}
          href={p.href}
          className={cn(
            "shrink-0 border-b-2 px-3 py-3 text-base font-medium whitespace-nowrap",
            activa(p.href) ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {p.etiqueta}
        </Link>
      ))}
    </nav>
  );
}
