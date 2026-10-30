"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Aviso, Campo, Casilla, Selector } from "@/components/formulario";
import { achicarFoto } from "@/lib/imagen";
import { textos, textosVentas } from "@/lib/textos";
import { guardarAjustesVenta, subirQrDeuna } from "@/server/acciones/ventas";
import type { AjustesVenta, FormaPago } from "@/server/ventas";

const t = textosVentas.ajustes;

export function AjustesPuntoVenta({
  ajustes,
  formas: formasIniciales,
  cuentas,
}: {
  ajustes: AjustesVenta;
  formas: FormaPago[];
  cuentas: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const [sinStock, setSinStock] = useState<string>(ajustes.ventaSinStock);
  const [ancho, setAncho] = useState(String(ajustes.ticketAncho));
  const [mensaje, setMensaje] = useState(ajustes.ticketMensaje);
  const [banco, setBanco] = useState<Record<string, string>>({ ...ajustes.banco } as Record<string, string>);
  const [desde, setDesde] = useState(ajustes.alcoholDesde ?? "");
  const [hasta, setHasta] = useState(ajustes.alcoholHasta ?? "");
  const [formas, setFormas] = useState(formasIniciales.map((f) => ({ id: f.id, nombre: f.nombre, cuentaId: f.cuentaId ?? "", activa: f.activa })));
  const [error, setError] = useState<string>();
  const [guardando, iniciar] = useTransition();
  const archivo = useRef<HTMLInputElement>(null);

  const campoBanco = (clave: string, etiqueta: string) => (
    <Campo id={`banco-${clave}`} etiqueta={etiqueta} opcional>
      <Input id={`banco-${clave}`} value={banco[clave] ?? ""} onChange={(e) => setBanco({ ...banco, [clave]: e.target.value })} />
    </Campo>
  );

  return (
    <section className="grid gap-5">
      <h2 className="text-2xl font-bold">{t.titulo}</h2>
      {error && <Aviso tipo="error">{error}</Aviso>}

      <div className="grid gap-2">
        <p className="text-base font-medium">{t.qr}</p>
        {ajustes.deunaQr && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ajustes.deunaQr} alt="QR de Deuna" className="max-h-48 justify-self-start rounded-lg bg-white p-2" />
        )}
        <input
          ref={archivo}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            iniciar(async () => {
              const datos = new FormData();
              datos.set("foto", await achicarFoto(f, 1000));
              const r = await subirQrDeuna(datos);
              if (!r.ok) return setError(r.mensaje);
              toast.success(r.mensaje);
              router.refresh();
            });
          }}
        />
        <Button variant="outline" className="justify-self-start" onClick={() => archivo.current?.click()} disabled={guardando}>
          <Upload className="size-5" aria-hidden /> {t.subirQr}
        </Button>
      </div>

      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          iniciar(async () => {
            const r = await guardarAjustesVenta({
              ventaSinStock: sinStock,
              ticketAncho: ancho,
              ticketMensaje: mensaje,
              banco,
              alcoholDesde: desde,
              alcoholHasta: hasta,
              formas: formas.map((f) => ({ id: f.id, cuentaId: f.cuentaId, activa: f.activa })),
            });
            if (!r.ok) return setError(r.mensaje);
            setError(undefined);
            toast.success(r.mensaje);
            router.refresh();
          });
        }}
      >
        <fieldset className="grid gap-2 rounded-xl border p-4">
          <legend className="px-1 font-semibold">{t.banco}</legend>
          {campoBanco("banco", t.bancoNombre)}
          {campoBanco("tipo", t.bancoTipo)}
          {campoBanco("numero", t.bancoNumero)}
          {campoBanco("titular", t.bancoTitular)}
          {campoBanco("identificacion", t.bancoId)}
        </fieldset>

        <fieldset className="grid gap-2 rounded-xl border p-4">
          <legend className="px-1 font-semibold">{t.formas}</legend>
          {formas.map((f, i) => (
            <div key={f.id} className="grid grid-cols-[auto_1fr_1fr] items-center gap-2">
              <Casilla
                aria-label={f.nombre}
                checked={f.activa}
                onChange={(e) => setFormas(formas.map((x, j) => (j === i ? { ...x, activa: e.target.checked } : x)))}
              />
              <span>{f.nombre}</span>
              {f.id === "fiado" ? (
                <span className="text-sm text-muted-foreground">—</span>
              ) : (
                <Selector
                  aria-label={`Cuenta de ${f.nombre}`}
                  value={f.cuentaId}
                  onChange={(e) => setFormas(formas.map((x, j) => (j === i ? { ...x, cuentaId: e.target.value } : x)))}
                >
                  {cuentas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </Selector>
              )}
            </div>
          ))}
        </fieldset>

        <Campo id="aj-sin-stock" etiqueta={t.sinStock}>
          <Selector id="aj-sin-stock" value={sinStock} onChange={(e) => setSinStock(e.target.value)}>
            <option value="avisar">{t.avisar}</option>
            <option value="bloquear">{t.bloquear}</option>
          </Selector>
        </Campo>
        <Campo id="aj-ancho" etiqueta={t.ticket}>
          <Selector id="aj-ancho" value={ancho} onChange={(e) => setAncho(e.target.value)}>
            <option value="80">80 mm</option>
            <option value="58">58 mm</option>
          </Selector>
        </Campo>
        <Campo id="aj-mensaje" etiqueta={t.mensaje} opcional>
          <Input id="aj-mensaje" value={mensaje} onChange={(e) => setMensaje(e.target.value)} />
        </Campo>
        <fieldset className="grid gap-2">
          <legend className="text-base font-medium">{t.alcohol}</legend>
          <div className="grid grid-cols-2 gap-2">
            <Campo id="aj-desde" etiqueta={t.desde}>
              <Input id="aj-desde" type="time" value={desde} onChange={(e) => setDesde(e.target.value)} />
            </Campo>
            <Campo id="aj-hasta" etiqueta={t.hasta}>
              <Input id="aj-hasta" type="time" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            </Campo>
          </div>
        </fieldset>
        <Button type="submit" size="lg" disabled={guardando}>
          {guardando ? textos.general.guardando : t.guardar}
        </Button>
      </form>
    </section>
  );
}
