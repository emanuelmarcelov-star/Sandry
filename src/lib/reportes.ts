/**
 * Ayudas de los reportes: rangos de fechas (en hora de Ecuador) y cálculos
 * sencillos sobre los números que devuelve la base de datos.
 */

export type Periodo = "hoy" | "ayer" | "semana" | "mes" | "mesPasado" | "anio";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const desdeIso = (t: string) => new Date(`${t}T12:00:00Z`);

/** Desde y hasta (aaaa-mm-dd, ambos incluidos) de un período, según el día de hoy en Ecuador. */
export function rangoPeriodo(periodo: Periodo, hoy: string): { desde: string; hasta: string } {
  const d = desdeIso(hoy);
  switch (periodo) {
    case "hoy":
      return { desde: hoy, hasta: hoy };
    case "ayer": {
      const a = new Date(d.getTime() - 86_400_000);
      return { desde: iso(a), hasta: iso(a) };
    }
    case "semana": {
      const dia = d.getUTCDay() || 7; // lunes = 1 … domingo = 7
      return { desde: iso(new Date(d.getTime() - (dia - 1) * 86_400_000)), hasta: hoy };
    }
    case "mes":
      return { desde: `${hoy.slice(0, 7)}-01`, hasta: hoy };
    case "mesPasado": {
      const primero = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1, 12));
      const ultimo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 0, 12));
      return { desde: iso(primero), hasta: iso(ultimo) };
    }
    case "anio":
      return { desde: `${hoy.slice(0, 4)}-01-01`, hasta: hoy };
  }
}

/** Cambio porcentual de b a a (null si antes no hubo nada). */
export function variacion(ahora: number, antes: number): number | null {
  if (!antes) return null;
  return Math.round(((ahora - antes) / antes) * 1000) / 10;
}

export type ProductoReporte = { producto_id: string; producto: string; cantidad: number; ventas: number; ganancia: number };

/** Listas de productos para el reporte: más vendidos, más y menos rentables, y vendidos a pérdida. */
export function rankings(productos: ProductoReporte[], cuantos = 10) {
  const n = (x: unknown) => Number(x);
  const lista = productos.map((p) => ({ ...p, cantidad: n(p.cantidad), ventas: n(p.ventas), ganancia: n(p.ganancia) }));
  return {
    masVendidos: [...lista].sort((a, b) => b.cantidad - a.cantidad).slice(0, cuantos),
    masRentables: [...lista].sort((a, b) => b.ganancia - a.ganancia).slice(0, cuantos),
    menosRentables: [...lista].filter((p) => p.ganancia >= 0).sort((a, b) => a.ganancia - b.ganancia).slice(0, cuantos),
    aPerdida: lista.filter((p) => p.ganancia < 0).sort((a, b) => a.ganancia - b.ganancia),
  };
}
