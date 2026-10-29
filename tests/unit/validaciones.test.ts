import { describe, expect, test } from "vitest";
import { enmascararCorreo, validarCedula, validarRuc } from "@/lib/validaciones";

/** Calcula el dígito verificador de una cédula para generar casos válidos. */
function completarCedula(nueve: string): string {
  const suma = nueve.split("").reduce((t, c, i) => {
    let p = Number(c) * (i % 2 === 0 ? 2 : 1);
    if (p > 9) p -= 9;
    return t + p;
  }, 0);
  return nueve + ((10 - (suma % 10)) % 10);
}

describe("cédula", () => {
  test("acepta cédulas válidas", () => {
    expect(validarCedula("1710034065")).toBe(true);
    expect(validarCedula(completarCedula("091234567"))).toBe(true); // Guayas
    expect(validarCedula(completarCedula("240000001"))).toBe(true); // Santa Elena
    expect(validarCedula(completarCedula("300000001"))).toBe(true); // extranjero residente
  });

  test("rechaza dígito verificador incorrecto", () => {
    expect(validarCedula("1710034064")).toBe(false);
  });

  test.each([
    ["171003406", "menos de 10 dígitos"],
    ["17100340655", "más de 10 dígitos"],
    ["17100340a5", "letras"],
    [completarCedula("251234567"), "provincia 25 no existe"],
    [completarCedula("001234567"), "provincia 00 no existe"],
    [completarCedula("176234567"), "tercer dígito 6 no es de persona"],
  ])("rechaza %s (%s)", (cedula) => {
    expect(validarCedula(cedula)).toBe(false);
  });
});

describe("RUC", () => {
  test("persona natural: cédula + 001", () => {
    expect(validarRuc("1710034065001")).toBe(true);
    expect(validarRuc("1710034065000")).toBe(false);
    expect(validarRuc("1710034064001")).toBe(false);
  });

  test("sociedad privada (tercer dígito 9)", () => {
    expect(validarRuc("1790011674001")).toBe(true);
    expect(validarRuc("1790011675001")).toBe(false);
  });

  test("entidad pública (tercer dígito 6)", () => {
    expect(validarRuc("1760001550001")).toBe(true);
    expect(validarRuc("1760001560001")).toBe(false);
    expect(validarRuc("1760001550000")).toBe(false);
  });

  test("formato incorrecto", () => {
    expect(validarRuc("179001167400")).toBe(false);
    expect(validarRuc("1770011674001")).toBe(false); // tercer dígito 7
  });
});

describe("correo enmascarado", () => {
  test.each([
    ["maria@gmail.com", "ma****@gmail.com"],
    ["jo@hotmail.com", "j****@hotmail.com"],
    ["a@x.ec", "a****@x.ec"],
    ["sin-arroba", "****"],
  ])("%s → %s", (correo, esperado) => {
    expect(enmascararCorreo(correo)).toBe(esperado);
  });
});
