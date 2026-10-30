"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Aviso } from "@/components/formulario";

type Detector = { detect: (fuente: HTMLVideoElement) => Promise<{ rawValue: string }[]> };

const FORMATOS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "itf", "qr_code"];

async function crearDetector(): Promise<Detector> {
  const nativo = (globalThis as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
  if (nativo) return new nativo({ formats: FORMATOS });
  // iPhone y otros sin lector nativo: el respaldo basado en zxing.
  const { BarcodeDetector } = await import("barcode-detector/ponyfill");
  return new BarcodeDetector({ formats: FORMATOS as never }) as unknown as Detector;
}

/**
 * Lee códigos con la cámara del celular o de la PC. Queda abierta para leer
 * varios productos seguidos; el mismo código no se repite antes de 1,5 s.
 */
export function EscanerCamara({ titulo, onCodigo, onCerrar }: { titulo: string; onCodigo: (codigo: string) => void; onCerrar: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string>();
  const ultimo = useRef({ codigo: "", hora: 0 });
  const onCodigoRef = useRef(onCodigo);
  useEffect(() => {
    onCodigoRef.current = onCodigo;
  }, [onCodigo]);

  useEffect(() => {
    let flujo: MediaStream | null = null;
    let parar = false;
    let reloj: number | undefined;
    (async () => {
      try {
        flujo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (parar || !video.current) return;
        video.current.srcObject = flujo;
        await video.current.play();
        const detector = await crearDetector();
        const buscar = async () => {
          if (parar || !video.current) return;
          try {
            const [primero] = await detector.detect(video.current);
            const ahora = Date.now();
            if (primero && (primero.rawValue !== ultimo.current.codigo || ahora - ultimo.current.hora > 1500)) {
              ultimo.current = { codigo: primero.rawValue, hora: ahora };
              onCodigoRef.current(primero.rawValue);
            }
          } catch {
            // Un cuadro que no se pudo leer: se intenta con el siguiente.
          }
          reloj = window.setTimeout(buscar, 200);
        };
        void buscar();
      } catch {
        setError("No se pudo abrir la cámara. Revisa que el navegador tenga permiso para usarla.");
      }
    })();
    return () => {
      parar = true;
      window.clearTimeout(reloj);
      flujo?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <Dialog open onOpenChange={(a) => !a && onCerrar()}>
      <DialogContent className="text-base sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">{titulo}</DialogTitle>
        </DialogHeader>
        {error ? (
          <Aviso tipo="error">{error}</Aviso>
        ) : (
          <video ref={video} className="aspect-[4/3] w-full rounded-lg bg-black object-cover" muted playsInline />
        )}
      </DialogContent>
    </Dialog>
  );
}
