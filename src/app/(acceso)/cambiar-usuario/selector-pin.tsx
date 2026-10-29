"use client";

import { useState, useTransition } from "react";
import { Delete, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Aviso } from "@/components/formulario";
import { entrarConPin, type PersonaDelDispositivo } from "@/server/acciones/pin";
import { textos } from "@/lib/textos";
import { cn } from "cn";

const t = textos.pin;
const TECLAS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "borrar"];

/** Lista de personas del dispositivo + teclado numérico grande para el PIN. */
export function SelectorPin({ personas }: { personas: PersonaDelDispositivo[] }) {
  const [elegida, setElegida] = useState<PersonaDelDispositivo | null>(
    personas.length === 1 && personas[0].tienePin ? personas[0] : null,
  );
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string>();
  const [enviando, iniciar] = useTransition();

  function enviar(valor = pin) {
    if (!elegida || valor.length < 4) return;
    iniciar(async () => {
      setError(undefined);
      const r = await entrarConPin(elegida.id, valor);
      if (r && !r.ok) {
        setError(r.mensaje);
        setPin("");
      }
    });
  }

  function tecla(valor: string) {
    if (valor === "borrar") return setPin((p) => p.slice(0, -1));
    if (pin.length >= 6) return;
    setPin(pin + valor);
  }

  return (
    <div className="grid gap-5">
      <div className="grid gap-2">
        {personas.map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={!p.tienePin}
            onClick={() => {
              setElegida(p);
              setPin("");
              setError(undefined);
            }}
            className={cn(
              "flex items-center gap-3 rounded-xl border p-4 text-left text-lg disabled:opacity-50",
              elegida?.id === p.id && "border-primary bg-primary/10 ring-2 ring-primary",
            )}
          >
            <UserRound className="size-6 shrink-0" aria-hidden />
            <span className="flex-1 font-medium">{p.nombre}</span>
            {!p.tienePin && <span className="text-sm text-muted-foreground">{t.sinPin}</span>}
          </button>
        ))}
      </div>

      {elegida && (
        <form
          className="grid gap-4"
          onSubmit={(evento) => {
            evento.preventDefault();
            enviar();
          }}
        >
          <label htmlFor="pin" className="text-center text-base font-medium">
            {t.escribePin}
          </label>
          <input
            id="pin"
            value={pin}
            onChange={(evento) => setPin(evento.target.value.replace(/\D/g, "").slice(0, 6))}
            type="password"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            className="h-14 rounded-lg border text-center text-3xl tracking-[0.5em] outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          {error && <Aviso tipo="error">{error}</Aviso>}
          <div className="grid grid-cols-3 gap-2">
            {TECLAS.map((valor, i) =>
              valor === "" ? (
                <span key={i} />
              ) : (
                <Button
                  key={i}
                  type="button"
                  variant="outline"
                  className="h-16 text-2xl"
                  onClick={() => tecla(valor)}
                  aria-label={valor === "borrar" ? t.borrar : valor}
                >
                  {valor === "borrar" ? <Delete className="size-7" aria-hidden /> : valor}
                </Button>
              ),
            )}
          </div>
          <Button type="submit" size="lg" disabled={enviando || pin.length < 4}>
            {enviando ? textos.acceso.entrando : t.entrar}
          </Button>
        </form>
      )}
    </div>
  );
}
