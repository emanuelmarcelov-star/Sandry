/**
 * Borradores guardados en el dispositivo (carrito de venta, compra en curso…).
 *
 * Si se va la señal o se cierra la pantalla sin querer, lo que se estaba
 * registrando no se pierde. El navegador puede negar el almacenamiento
 * (modo privado, poco espacio), así que nunca dejamos que eso rompa la app.
 */

const PREFIJO = "sandry:borrador:";

type Envoltura<T> = { version: 1; guardadoEn: string; datos: T };

export function guardarBorrador<T>(clave: string, datos: T): boolean {
  try {
    const envoltura: Envoltura<T> = { version: 1, guardadoEn: new Date().toISOString(), datos };
    localStorage.setItem(PREFIJO + clave, JSON.stringify(envoltura));
    return true;
  } catch {
    return false;
  }
}

export function leerBorrador<T>(clave: string): { datos: T; guardadoEn: Date } | null {
  try {
    const crudo = localStorage.getItem(PREFIJO + clave);
    if (!crudo) return null;
    const envoltura = JSON.parse(crudo) as Envoltura<T>;
    if (envoltura?.version !== 1) return null;
    return { datos: envoltura.datos, guardadoEn: new Date(envoltura.guardadoEn) };
  } catch {
    return null;
  }
}

export function borrarBorrador(clave: string): void {
  try {
    localStorage.removeItem(PREFIJO + clave);
  } catch {
    // Nada que hacer: si no se puede leer, tampoco hay nada que borrar.
  }
}
