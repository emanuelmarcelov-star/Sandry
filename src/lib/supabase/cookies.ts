/**
 * "Recordarme": si la persona NO marcó la casilla, las cookies de sesión se
 * guardan sin fecha de vencimiento, así el navegador las borra al cerrarse.
 */
export const COOKIE_RECORDAR = "sandry-recordar";
export const COOKIE_DISPOSITIVO = "sandry-dispositivo";

type OpcionesCookie = { maxAge?: number; expires?: Date; [clave: string]: unknown };

export function ajustarOpcionesSesion<T extends OpcionesCookie>(opciones: T, recordar: boolean): T {
  if (recordar) return opciones;
  const { maxAge, expires, ...resto } = opciones;
  void maxAge;
  void expires;
  return resto as T;
}

export function quiereRecordar(valorCookie: string | undefined): boolean {
  return valorCookie !== "0";
}
