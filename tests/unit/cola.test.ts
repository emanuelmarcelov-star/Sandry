import { beforeEach, describe, expect, test } from "vitest";
import { encolar, enviarPendientes, pendientes, quitar, type Operacion } from "@/lib/cola";

// localStorage mínimo para correr en Node.
const memoria = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => memoria.get(k) ?? null,
  setItem: (k: string, v: string) => void memoria.set(k, v),
  removeItem: (k: string) => void memoria.delete(k),
  clear: () => memoria.clear(),
  key: () => null,
  length: 0,
} as Storage;

const op = (id: string, tipo: Operacion["tipo"] = "compra") => ({ id, tipo, datos: { id }, descripcion: id });

describe("cola de envíos sin señal", () => {
  beforeEach(() => memoria.clear());

  test("guarda en orden y no duplica el mismo id", () => {
    encolar(op("a"));
    encolar(op("b"));
    encolar(op("a"));
    expect(pendientes().map((o) => o.id)).toEqual(["b", "a"]);
    quitar("b");
    expect(pendientes().map((o) => o.id)).toEqual(["a"]);
  });

  test("si se cae la red, se detiene y conserva lo que falta", async () => {
    encolar(op("viaje", "iniciar_viaje"));
    encolar(op("c1"));
    encolar(op("c2"));
    let llamadas = 0;
    const r = await enviarPendientes(async () => {
      if (++llamadas === 2) throw new TypeError("Failed to fetch");
      return { ok: true };
    });
    expect(r).toEqual({ enviados: 1, sinRed: true });
    expect(pendientes().map((o) => o.id)).toEqual(["c1", "c2"]);
    // Vuelve la señal: se envía lo demás.
    expect(await enviarPendientes(async () => ({ ok: true }))).toEqual({ enviados: 2, sinRed: false });
    expect(pendientes()).toEqual([]);
  });

  test("si un envío se queda colgado (se fue la señal a medias), no bloquea la cola", async () => {
    encolar(op("c1"));
    const colgado = await enviarPendientes(() => new Promise(() => {}), 50);
    expect(colgado).toEqual({ enviados: 0, sinRed: true });
    expect(await enviarPendientes(async () => ({ ok: true }))).toEqual({ enviados: 1, sinRed: false });
  });

  test("lo que el servidor rechaza queda marcado con el error y lo demás sigue", async () => {
    encolar(op("mala"));
    encolar(op("buena"));
    await enviarPendientes(async (o) => (o.id === "mala" ? { ok: false, mensaje: "Ese viaje ya terminó." } : { ok: true }));
    expect(pendientes()).toMatchObject([{ id: "mala", error: "Ese viaje ya terminó." }]);
  });
});
