/**
 * Cola de envíos pendientes guardada en el dispositivo.
 *
 * En el viaje de compras (mercado, supermercado) la señal puede irse: cada
 * compra o gasto se guarda primero aquí y se envía cuando hay conexión. Cada
 * operación lleva su propio id, así que reenviarla nunca la duplica.
 */

export type TipoOperacion = "iniciar_viaje" | "compra" | "gasto" | "tachar";

export type Operacion = {
  id: string;
  tipo: TipoOperacion;
  datos: unknown;
  /** Texto para mostrar en la lista de pendientes. */
  descripcion: string;
  creada: string;
  /** Último error que devolvió el servidor (no de red). */
  error?: string;
};

const CLAVE = "sandry:cola";
const oyentes = new Set<() => void>();

function leer(): Operacion[] {
  try {
    const crudo = localStorage.getItem(CLAVE);
    const lista = crudo ? (JSON.parse(crudo) as Operacion[]) : [];
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

function escribir(lista: Operacion[]): void {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(lista));
  } catch {
    // Sin espacio o en modo privado: no hay nada más que hacer.
  }
  for (const o of oyentes) o();
}

export function pendientes(): Operacion[] {
  return leer();
}

export function encolar(op: Omit<Operacion, "creada">): void {
  const lista = leer().filter((x) => x.id !== op.id);
  escribir([...lista, { ...op, creada: new Date().toISOString() }]);
}

export function quitar(id: string): void {
  escribir(leer().filter((x) => x.id !== id));
}

function marcarError(id: string, error: string): void {
  escribir(leer().map((x) => (x.id === id ? { ...x, error } : x)));
}

export function suscribir(oyente: () => void): () => void {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}

export type RespuestaEnvio = { ok: true } | { ok: false; mensaje: string };

let enviando = false;

/** Si la señal se va a medio envío, la petición puede quedarse colgada: se da por fallida. */
function conLimite<T>(promesa: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolver, rechazar) => {
    const reloj = setTimeout(() => rechazar(new Error("Sin respuesta")), ms);
    promesa.then(
      (v) => (clearTimeout(reloj), resolver(v)),
      (e) => (clearTimeout(reloj), rechazar(e)),
    );
  });
}

/**
 * Envía en orden lo pendiente. Si falla la red (o no responde), se detiene y
 * lo intenta después; reenviar no duplica nada. Si el servidor rechaza algo
 * (un dato mal), lo marca con el error y sigue con lo demás.
 */
export async function enviarPendientes(
  enviar: (op: Operacion) => Promise<RespuestaEnvio>,
  limiteMs = 15_000,
): Promise<{ enviados: number; sinRed: boolean }> {
  if (enviando) return { enviados: 0, sinRed: false };
  enviando = true;
  let enviados = 0;
  try {
    for (const op of leer()) {
      let r: RespuestaEnvio;
      try {
        r = await conLimite(enviar(op), limiteMs);
      } catch {
        return { enviados, sinRed: true };
      }
      if (r.ok) {
        quitar(op.id);
        enviados++;
      } else {
        marcarError(op.id, r.mensaje);
        // Si no se pudo iniciar el viaje, lo demás del viaje tampoco va a entrar.
        if (op.tipo === "iniciar_viaje") break;
      }
    }
    return { enviados, sinRed: false };
  } finally {
    enviando = false;
  }
}
