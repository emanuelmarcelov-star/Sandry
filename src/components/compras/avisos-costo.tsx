import Link from "next/link";
import { Aviso } from "@/components/formulario";
import { formatoDolares } from "@/lib/dinero";
import { textosCompras } from "@/lib/textos";
import type { AvisoCosto } from "@/server/acciones/abastecimiento";

const t = textosCompras.avisos;

/** Después de comprar: qué costos subieron y dónde estaba más barato, con enlace para revisar el precio. */
export function AvisosCosto({ avisos }: { avisos: AvisoCosto[] }) {
  if (!avisos.length) return null;
  return (
    <Aviso tipo="info">
      <p className="font-semibold">{t.titulo}</p>
      <ul className="mt-2 grid gap-3">
        {avisos.map((a) => (
          <li key={a.productoId} className="grid gap-1">
            {a.antes && Number(a.ahora) > Number(a.antes) && <span>{t.subio(a.producto, formatoDolares(a.antes), formatoDolares(a.ahora))}</span>}
            {a.masBaratoEn && a.costoMasBarato && (
              <span>
                {a.producto}: {t.masBarato(a.masBaratoEn, formatoDolares(a.costoMasBarato))}
              </span>
            )}
            <Link href={`/catalogo/${a.productoId}`} className="font-medium underline">
              {t.revisarPrecio}
            </Link>
          </li>
        ))}
      </ul>
    </Aviso>
  );
}
