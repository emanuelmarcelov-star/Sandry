"use client";

import { useEffect, useRef } from "react";
import { DetectorLector } from "@/lib/ventas";

/**
 * Escucha el lector de códigos (USB o Bluetooth en modo teclado) en toda la
 * pantalla, aunque el cursor no esté en el buscador. Si el cursor está en un
 * campo de texto, no hace nada: ese campo recibe el código con su Enter.
 */
export function useLectorGlobal(alLeer: (codigo: string) => void, activo = true) {
  const alLeerRef = useRef(alLeer);
  useEffect(() => {
    alLeerRef.current = alLeer;
  }, [alLeer]);

  useEffect(() => {
    if (!activo) return;
    const detector = new DetectorLector();
    const escuchar = (e: KeyboardEvent) => {
      const destino = e.target as HTMLElement | null;
      if (destino && (destino.tagName === "INPUT" || destino.tagName === "TEXTAREA" || destino.isContentEditable)) return;
      const codigo = detector.tecla(e.key, performance.now());
      if (codigo) {
        e.preventDefault();
        alLeerRef.current(codigo);
      }
    };
    window.addEventListener("keydown", escuchar);
    return () => window.removeEventListener("keydown", escuchar);
  }, [activo]);
}

let audio: AudioContext | null = null;

/** Pitido y vibración al leer un código (o un tono bajo si algo salió mal). */
export function pitido(bien = true) {
  try {
    audio ??= new AudioContext();
    const osc = audio.createOscillator();
    const vol = audio.createGain();
    osc.frequency.value = bien ? 1500 : 300;
    vol.gain.value = 0.15;
    osc.connect(vol).connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + (bien ? 0.08 : 0.3));
  } catch {
    // Sin sonido no pasa nada.
  }
  try {
    navigator.vibrate?.(bien ? 40 : [80, 60, 80]);
  } catch {
    // Algunos navegadores no vibran.
  }
}
