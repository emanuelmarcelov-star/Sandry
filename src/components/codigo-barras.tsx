"use client";

import { useMemo } from "react";
import { toSVG } from "bwip-js/browser";
import { tipoDeCodigo } from "@/lib/catalogo";

/** Dibuja un código de barras (EAN-13, EAN-8, UPC, ITF-14 o Code 128) como SVG. */
export function CodigoBarras({ codigo, alto = 10, conTexto = true, className }: { codigo: string; alto?: number; conTexto?: boolean; className?: string }) {
  const svg = useMemo(() => {
    try {
      const tipo = tipoDeCodigo(codigo);
      return toSVG({
        bcid: tipo,
        text: codigo,
        height: alto,
        includetext: conTexto,
        textxalign: "center",
        textsize: 9,
        ...(tipo === "itf14" ? { borderwidth: 0 } : {}),
      });
    } catch {
      return null;
    }
  }, [codigo, alto, conTexto]);

  if (!svg) return <span className="font-mono text-xs">{codigo}</span>;
  // El SVG lo genera la librería a partir del número: no contiene datos del usuario fuera del código.
  return <span className={className} data-codigo={codigo} dangerouslySetInnerHTML={{ __html: svg }} />;
}
