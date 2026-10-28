// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { borrarBorrador, guardarBorrador, leerBorrador } from "@/lib/borradores";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("borradores en el dispositivo", () => {
  test("guarda y recupera un carrito", () => {
    const carrito = [{ producto: "Coca-Cola 500 ml", cantidad: "2" }];
    expect(guardarBorrador("carrito", carrito)).toBe(true);
    expect(leerBorrador("carrito")?.datos).toEqual(carrito);
  });

  test("borrar deja el borrador vacío", () => {
    guardarBorrador("carrito", [1]);
    borrarBorrador("carrito");
    expect(leerBorrador("carrito")).toBeNull();
  });

  test("si el almacenamiento está lleno o bloqueado, no rompe la app", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(guardarBorrador("carrito", [1])).toBe(false);
  });

  test("ignora datos dañados", () => {
    localStorage.setItem("sandry:borrador:carrito", "{no es json");
    expect(leerBorrador("carrito")).toBeNull();
  });
});
