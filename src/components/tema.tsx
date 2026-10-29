"use client";

import { ThemeProvider, useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { textos } from "@/lib/textos";

/** Modo claro / oscuro (sigue al del celular o PC hasta que se elija uno). */
export function ProveedorTema({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </ThemeProvider>
  );
}

export function useCambiarTema() {
  const { resolvedTheme, setTheme } = useTheme();
  const oscuro = resolvedTheme === "dark";
  return {
    oscuro,
    etiqueta: oscuro ? textos.menu.temaClaro : textos.menu.temaOscuro,
    Icono: oscuro ? Sun : Moon,
    cambiar: () => setTheme(oscuro ? "light" : "dark"),
  };
}
