/**
 * Validaciones de datos de Ecuador y utilidades de privacidad.
 */

function digitos(texto: string): number[] {
  return texto.split("").map(Number);
}

/**
 * Cédula ecuatoriana: 10 dígitos, provincia 01–24 (o 30 para extranjeros
 * residentes), tercer dígito menor que 6 y dígito verificador módulo 10.
 */
export function validarCedula(cedula: string): boolean {
  if (!/^\d{10}$/.test(cedula)) return false;
  const provincia = Number(cedula.slice(0, 2));
  if (!((provincia >= 1 && provincia <= 24) || provincia === 30)) return false;
  const d = digitos(cedula);
  if (d[2] >= 6) return false;

  const suma = d.slice(0, 9).reduce((total, valor, i) => {
    let producto = valor * (i % 2 === 0 ? 2 : 1);
    if (producto > 9) producto -= 9;
    return total + producto;
  }, 0);
  return (10 - (suma % 10)) % 10 === d[9];
}

function modulo11(valores: number[], coeficientes: number[]): number | null {
  const suma = valores.reduce((total, v, i) => total + v * coeficientes[i], 0);
  const resto = suma % 11;
  const verificador = resto === 0 ? 0 : 11 - resto;
  return verificador === 10 ? null : verificador;
}

/**
 * RUC ecuatoriano (13 dígitos):
 *  - Persona natural (tercer dígito 0–5): cédula válida + establecimiento.
 *  - Entidad pública (tercer dígito 6): módulo 11 sobre los 8 primeros.
 *  - Sociedad privada (tercer dígito 9): módulo 11 sobre los 9 primeros.
 * Ojo: el SRI ha emitido algunos RUC que no cumplen el módulo 11; cuando se
 * use para facturar (fase 7) se permitirá continuar con una advertencia.
 */
export function validarRuc(ruc: string): boolean {
  if (!/^\d{13}$/.test(ruc)) return false;
  const provincia = Number(ruc.slice(0, 2));
  if (!((provincia >= 1 && provincia <= 24) || provincia === 30)) return false;
  const d = digitos(ruc);
  const tercero = d[2];

  if (tercero < 6) {
    return validarCedula(ruc.slice(0, 10)) && ruc.slice(10) !== "000";
  }
  if (tercero === 6) {
    return modulo11(d.slice(0, 8), [3, 2, 7, 6, 5, 4, 3, 2]) === d[8] && ruc.slice(9) !== "0000";
  }
  if (tercero === 9) {
    return modulo11(d.slice(0, 9), [4, 3, 2, 7, 6, 5, 4, 3, 2]) === d[9] && ruc.slice(10) !== "000";
  }
  return false;
}

/** Teléfono: solo números, de 7 a 15 dígitos (fijo o celular). */
export function limpiarTelefono(telefono: string): string {
  return telefono.replace(/[^\d]/g, "");
}

/** "maria@gmail.com" → "ma****@gmail.com" (no revela el largo del nombre). */
export function enmascararCorreo(correo: string): string {
  const [local, dominio] = correo.split("@");
  if (!local || !dominio) return "****";
  const visible = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
  return `${visible}****@${dominio}`;
}
