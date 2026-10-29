"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeftRight, Calculator, HandCoins, Pencil, PiggyBank, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Aviso, Campo, Casilla, Selector } from "@/components/formulario";
import { formatoDolares } from "@/lib/dinero";
import { textos, textosDinero } from "@/lib/textos";
import { guardarCuenta, moverDinero } from "@/server/acciones/abastecimiento";

const t = textosDinero;

type Cuenta = { id: string; nombre: string; tipo: string; activa: boolean; saldo: string };
type Tipo = "transferencia" | "aporte" | "retiro" | "correccion";

export function AccionesDinero({ cuentas }: { cuentas: Cuenta[] }) {
  const [tipo, setTipo] = useState<Tipo | null>(null);
  const [cuentaEditada, setCuentaEditada] = useState<Partial<Cuenta> | null>(null);
  const botones = [
    ["transferencia", t.transferir, ArrowLeftRight],
    ["aporte", t.aporte, PiggyBank],
    ["retiro", t.retiro, HandCoins],
    ["correccion", t.corregir, Calculator],
  ] as const;
  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-2">
        {botones.map(([clave, etiqueta, Icono]) => (
          <Button key={clave} variant="outline" className="h-auto min-h-14 justify-start whitespace-normal py-2 text-left" onClick={() => setTipo(clave)}>
            <Icono className="size-5 shrink-0" aria-hidden /> {etiqueta}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" size="sm" onClick={() => setCuentaEditada({ tipo: "otra", activa: true })}>
          <Plus className="size-4" aria-hidden /> {t.nuevaCuenta}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setCuentaEditada(cuentas[0])}>
          <Pencil className="size-4" aria-hidden /> {t.editar}
        </Button>
      </div>
      {tipo && <DialogoMovimiento tipo={tipo} cuentas={cuentas.filter((c) => c.activa)} onCerrar={() => setTipo(null)} />}
      {cuentaEditada && <DialogoCuenta inicial={cuentaEditada} cuentas={cuentas} onCerrar={() => setCuentaEditada(null)} />}
    </div>
  );
}

function DialogoMovimiento({ tipo, cuentas, onCerrar }: { tipo: Tipo; cuentas: Cuenta[]; onCerrar: () => void }) {
  const router = useRouter();
  const deTienda = cuentas.filter((c) => c.tipo !== "personal");
  const [origen, setOrigen] = useState("");
  const [destino, setDestino] = useState("");
  const [monto, setMonto] = useState("");
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string>();
  const [guardando, iniciar] = useTransition();
  const titulo = { transferencia: t.transferir, aporte: t.aporte, retiro: t.retiro, correccion: t.corregir }[tipo];
  const elegida = cuentas.find((c) => c.id === destino);

  const selector = (id: string, etiqueta: string, valor: string, cambiar: (v: string) => void, lista: Cuenta[]) => (
    <Campo id={id} etiqueta={etiqueta}>
      <Selector id={id} value={valor} onChange={(e) => cambiar(e.target.value)}>
        <option value="">—</option>
        {lista.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nombre}
          </option>
        ))}
      </Selector>
    </Campo>
  );

  return (
    <Dialog open onOpenChange={(a) => !a && onCerrar()}>
      <DialogContent className="text-base sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">{titulo}</DialogTitle>
        </DialogHeader>
        {error && <Aviso tipo="error">{error}</Aviso>}
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            iniciar(async () => {
              const r = await moverDinero({ tipo, origen: origen || undefined, destino: destino || undefined, monto, nota });
              if (!r.ok) return setError(r.mensaje);
              toast.success(t.guardado);
              onCerrar();
              router.refresh();
            });
          }}
        >
          {(tipo === "transferencia" || tipo === "retiro") && selector("dinero-origen", t.desde, origen, setOrigen, tipo === "retiro" ? deTienda : cuentas)}
          {tipo !== "retiro" && selector("dinero-destino", tipo === "correccion" ? t.cuenta : t.hacia, destino, setDestino, tipo === "aporte" ? deTienda : cuentas)}
          {tipo === "correccion" && elegida && (
            <p className="text-muted-foreground">
              Según la app: {formatoDolares(elegida.saldo)}
            </p>
          )}
          <Campo id="dinero-monto" etiqueta={tipo === "correccion" ? t.montoReal : t.monto}>
            <Input id="dinero-monto" inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="$0.00" />
          </Campo>
          <Campo id="dinero-nota" etiqueta={t.nota} opcional>
            <Input id="dinero-nota" value={nota} onChange={(e) => setNota(e.target.value)} />
          </Campo>
          <Button type="submit" size="lg" disabled={guardando || !monto.trim()}>
            {guardando ? textos.general.guardando : textos.general.guardar}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DialogoCuenta({ inicial, cuentas, onCerrar }: { inicial: Partial<Cuenta>; cuentas: Cuenta[]; onCerrar: () => void }) {
  const router = useRouter();
  const [c, setC] = useState(inicial);
  const [error, setError] = useState<string>();
  const [guardando, iniciar] = useTransition();
  return (
    <Dialog open onOpenChange={(a) => !a && onCerrar()}>
      <DialogContent className="text-base sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">{c.id ? t.editar : t.nuevaCuenta}</DialogTitle>
        </DialogHeader>
        {error && <Aviso tipo="error">{error}</Aviso>}
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            iniciar(async () => {
              const r = await guardarCuenta({ id: c.id, nombre: c.nombre ?? "", tipo: c.tipo ?? "otra", activa: c.activa ?? true });
              if (!r.ok) return setError(r.mensaje);
              toast.success(t.guardado);
              onCerrar();
              router.refresh();
            });
          }}
        >
          {c.id && (
            <Campo id="cuenta-elegir" etiqueta={t.cuenta}>
              <Selector id="cuenta-elegir" value={c.id} onChange={(e) => setC(cuentas.find((x) => x.id === e.target.value)!)}>
                {cuentas.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.nombre}
                  </option>
                ))}
              </Selector>
            </Campo>
          )}
          <Campo id="cuenta-nombre" etiqueta={t.nombre}>
            <Input id="cuenta-nombre" value={c.nombre ?? ""} onChange={(e) => setC({ ...c, nombre: e.target.value })} placeholder="Banco Pichincha" />
          </Campo>
          {!c.id && (
            <Campo id="cuenta-tipo" etiqueta={t.tipo}>
              <Selector id="cuenta-tipo" value={c.tipo} onChange={(e) => setC({ ...c, tipo: e.target.value })}>
                {Object.entries(t.tipos)
                  .filter(([k]) => k !== "personal")
                  .map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
              </Selector>
            </Campo>
          )}
          {c.id && (
            <label className="flex items-center gap-3">
              <Casilla checked={c.activa ?? true} onChange={(e) => setC({ ...c, activa: e.target.checked })} /> {t.activa}
            </label>
          )}
          <Button type="submit" size="lg" disabled={guardando}>
            {guardando ? textos.general.guardando : textos.general.guardar}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
