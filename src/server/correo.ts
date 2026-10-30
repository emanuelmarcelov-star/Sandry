import "server-only";
import nodemailer from "nodemailer";

/**
 * Correos que manda la app (resumen del día) con el Gmail de la tienda.
 * Necesita GMAIL_USUARIO y GMAIL_CLAVE_APP (contraseña de aplicación de Google)
 * en las variables de entorno del servidor; nunca en el código ni en git.
 */
export function correoConfigurado(): boolean {
  return Boolean(process.env.GMAIL_USUARIO && process.env.GMAIL_CLAVE_APP);
}

export async function enviarCorreo(para: string, asunto: string, texto: string, html: string): Promise<{ ok: boolean; motivo?: string }> {
  if (!correoConfigurado()) return { ok: false, motivo: "sin_configurar" };
  try {
    const transporte = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: process.env.GMAIL_USUARIO, pass: process.env.GMAIL_CLAVE_APP!.replace(/\s/g, "") },
    });
    await transporte.sendMail({ from: `Sandry <${process.env.GMAIL_USUARIO}>`, to: para, subject: asunto, text: texto, html });
    return { ok: true };
  } catch {
    return { ok: false, motivo: "error" };
  }
}

/** Texto y HTML sencillo a partir de filas «etiqueta: valor». */
export function armarCorreo(titulo: string, filas: [string, string][]): { texto: string; html: string } {
  const escapar = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const texto = [titulo, "", ...filas.map(([k, v]) => `${k}: ${v}`)].join("\n");
  const html = `<div style="font-family:Arial,sans-serif;font-size:16px;color:#111">
<h2 style="color:#15803d;margin:0 0 12px">${escapar(titulo)}</h2>
<table style="border-collapse:collapse">${filas
    .map(([k, v]) => `<tr><td style="padding:4px 16px 4px 0;color:#555">${escapar(k)}</td><td style="padding:4px 0;font-weight:bold;text-align:right">${escapar(v)}</td></tr>`)
    .join("")}</table></div>`;
  return { texto, html };
}
