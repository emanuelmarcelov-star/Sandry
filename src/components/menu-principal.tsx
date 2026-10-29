"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { History, Home, KeyRound, LogOut, Menu, Settings, ShieldCheck, UserRound, Users, X } from "lucide-react";
import { useCambiarTema } from "@/components/tema";
import { textos } from "@/lib/textos";
import { cn } from "cn";

const t = textos.menu;

export type OpcionMenu = { href: string; etiqueta: string; icono: keyof typeof ICONOS };

const ICONOS = { Home, Users, ShieldCheck, History, Settings, UserRound };

/** Botón "Menú" con las secciones permitidas, cambio de usuario, tema y salir. */
export function MenuPrincipal({ nombre, rol, opciones }: { nombre: string; rol: string; opciones: OpcionMenu[] }) {
  const [abierto, setAbierto] = useState(false);
  const ruta = usePathname();
  const tema = useCambiarTema();

  useEffect(() => {
    if (!abierto) return;
    const cerrar = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    window.addEventListener("keydown", cerrar);
    return () => window.removeEventListener("keydown", cerrar);
  }, [abierto]);

  const claseOpcion = "flex w-full items-center gap-3 rounded-lg px-3 py-3 text-lg hover:bg-muted";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        aria-expanded={abierto}
        className="flex h-12 items-center gap-2 rounded-lg border px-3 text-base font-medium"
      >
        {abierto ? <X className="size-6" aria-hidden /> : <Menu className="size-6" aria-hidden />}
        <span className="max-w-36 truncate">{nombre}</span>
      </button>

      {abierto && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAbierto(false)} aria-hidden />
          <div
            className="absolute right-0 z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-xl border bg-popover p-2 shadow-lg"
          >
            <p className="px-3 pt-2 pb-3 text-sm text-muted-foreground">{rol}</p>
            <nav className="grid">
              {opciones.map(({ href, etiqueta, icono }) => {
                const Icono = ICONOS[icono];
                return (
                  <Link key={href} href={href} onClick={() => setAbierto(false)} className={cn(claseOpcion, ruta === href && "bg-muted font-semibold")}>
                    <Icono className="size-6" aria-hidden />
                    {etiqueta}
                  </Link>
                );
              })}
            </nav>
            <div className="my-2 border-t" />
            <a href="/cambiar-usuario" className={claseOpcion}>
              <KeyRound className="size-6" aria-hidden />
              {t.cambiarUsuario}
            </a>
            <button type="button" onClick={tema.cambiar} className={claseOpcion}>
              <tema.Icono className="size-6" aria-hidden />
              {tema.etiqueta}
            </button>
            <a href="/salir" className={cn(claseOpcion, "text-destructive")}>
              <LogOut className="size-6" aria-hidden />
              {t.salir}
            </a>
          </div>
        </>
      )}
    </div>
  );
}
