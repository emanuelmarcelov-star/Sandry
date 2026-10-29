import { z } from "zod";
import { limpiarTelefono, validarCedula } from "@/lib/validaciones";

/**
 * Reglas de los formularios de usuarios. Las usa el navegador (para avisar
 * rápido) y el servidor (que vuelve a revisar todo: nunca se confía en el navegador).
 */

const correo = z.string().trim().toLowerCase().email("Escribe un correo válido, por ejemplo maria@gmail.com.");

const contrasena = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres.")
  .max(72, "La contraseña es demasiado larga.");

const telefono = z
  .string()
  .trim()
  .transform(limpiarTelefono)
  .refine((t) => t.length >= 7 && t.length <= 15, "Escribe un teléfono válido, por ejemplo 0991234567.");

const cedulaOpcional = z
  .string()
  .trim()
  .optional()
  .transform((c) => c ?? "")
  .refine((c) => c === "" || validarCedula(c), "La cédula no es válida. Revisa los 10 números.");

const nombre = z
  .string()
  .trim()
  .min(3, "Escribe tu nombre completo.")
  .max(120, "El nombre es demasiado largo.");

export const esquemaRegistro = z
  .object({
    nombreCompleto: nombre,
    correo,
    telefono,
    cedula: cedulaOpcional,
    contrasena,
    confirmacion: z.string(),
  })
  .refine((d) => d.contrasena === d.confirmacion, {
    message: "Las dos contraseñas no son iguales.",
    path: ["confirmacion"],
  });
export type DatosRegistro = z.input<typeof esquemaRegistro>;

export const esquemaEntrar = z.object({
  correo,
  contrasena: z.string().min(1, "Escribe tu contraseña."),
  recordar: z.boolean(),
});
export type DatosEntrar = z.input<typeof esquemaEntrar>;

export const esquemaRecuperar = z.object({ correo });

export const esquemaNuevaContrasena = z
  .object({ contrasena, confirmacion: z.string() })
  .refine((d) => d.contrasena === d.confirmacion, {
    message: "Las dos contraseñas no son iguales.",
    path: ["confirmacion"],
  });
export type DatosNuevaContrasena = z.input<typeof esquemaNuevaContrasena>;

export const esquemaOlvideCorreo = z.object({
  dato: z
    .string()
    .trim()
    .refine((d) => limpiarTelefono(d).length >= 7, "Escribe tu teléfono o tu cédula."),
});

export const esquemaPin = z.object({
  pin: z.string().regex(/^\d{4,6}$/, "El PIN debe tener de 4 a 6 números."),
});

export const esquemaMiPerfil = z.object({
  nombreCompleto: nombre,
  telefono,
  cedula: cedulaOpcional,
});
export type DatosMiPerfil = z.input<typeof esquemaMiPerfil>;

export const esquemaInvitar = z.object({
  nombreCompleto: nombre,
  correo,
  rol: z.string().min(1, "Elige un rol."),
});
export type DatosInvitar = z.input<typeof esquemaInvitar>;

export const esquemaCambiarCorreo = z.object({
  usuarioId: z.string().uuid(),
  correo,
});

export const esquemaAjustes = z.object({
  minutosInactividad: z.coerce
    .number<string>()
    .int("Escribe un número entero de minutos.")
    .min(1, "Mínimo 1 minuto.")
    .max(480, "Máximo 480 minutos (8 horas)."),
  descuentoMaximo: z.coerce
    .number<string>()
    .min(0, "No puede ser negativo.")
    .max(100, "Máximo 100%."),
});
export type DatosAjustes = z.input<typeof esquemaAjustes>;
export type SalidaAjustes = z.output<typeof esquemaAjustes>;

/** Convierte los errores de Zod en { campo: mensaje } para mostrarlos en el formulario. */
export function erroresPorCampo(error: z.ZodError): Record<string, string> {
  const campos: Record<string, string> = {};
  for (const problema of error.issues) {
    const clave = String(problema.path[0] ?? "formulario");
    campos[clave] ??= problema.message;
  }
  return campos;
}
