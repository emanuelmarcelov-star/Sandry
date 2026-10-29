/**
 * Traduce los errores de Supabase a mensajes entendibles en español.
 */
const POR_CODIGO: Record<string, string> = {
  invalid_credentials: "Correo o contraseña incorrectos.",
  user_already_exists: "Ya existe una cuenta con ese correo.",
  email_exists: "Ya existe una cuenta con ese correo.",
  email_not_confirmed: "Todavía no confirmaste tu correo. Revisa tu bandeja de entrada.",
  over_email_send_rate_limit: "Se enviaron demasiados correos. Intenta de nuevo en una hora.",
  over_request_rate_limit: "Demasiados intentos. Espera unos minutos y vuelve a intentar.",
  weak_password: "La contraseña es muy débil. Usa al menos 8 caracteres.",
  same_password: "La contraseña nueva debe ser distinta de la anterior.",
  user_banned: "Esta cuenta está bloqueada.",
  session_not_found: "Tu sesión terminó. Vuelve a entrar.",
  otp_expired: "El enlace ya venció o ya se usó. Pide uno nuevo.",
  signup_disabled: "Los registros nuevos están desactivados.",
};

export function mensajeError(error: unknown, porDefecto = "Ocurrió un error. Intenta de nuevo."): string {
  if (!error || typeof error !== "object") return porDefecto;
  const e = error as { code?: string; message?: string };
  if (e.code && POR_CODIGO[e.code]) return POR_CODIGO[e.code];
  // Los mensajes que lanzan nuestras funciones de la base de datos ya están en español.
  if (e.code === "P0001" && e.message) return e.message;
  if (e.code === "42501") return "No tienes permiso para hacer esto.";
  if (e.code === "23505") return "Ese dato ya está registrado por otra persona.";
  return porDefecto;
}

/** Forma común de responder de las acciones del servidor. */
export type Resultado<T = undefined> =
  | { ok: true; datos?: T; mensaje?: string }
  | { ok: false; mensaje: string; campos?: Record<string, string> };
