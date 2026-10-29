import { z } from "zod";
import { leerNumero } from "@/lib/dinero";

/**
 * Formulario de producto. Los números viajan como texto (para no perder
 * decimales) y se validan con leerNumero.
 */
const numeroOpcional = (mensaje: string) =>
  z
    .string()
    .trim()
    .refine((t) => t === "" || (leerNumero(t)?.gte(0) ?? false), mensaje);

const numeroPositivo = (mensaje: string) =>
  z.string().trim().refine((t) => (leerNumero(t)?.gt(0) ?? false), mensaje);

export const esquemaPresentacion = z.object({
  id: z.string().optional(),
  nombre: z.string().trim().min(1, "Ponle nombre (ej. Unidad, Jaba x12)."),
  factor: numeroPositivo("El factor debe ser mayor que 0."),
  precioVenta: numeroOpcional("Precio no válido."),
  paraVenta: z.boolean(),
  paraCompra: z.boolean(),
  esBase: z.boolean(),
  codigos: z.string().trim(), // separados por coma o espacio
});

export const esquemaProducto = z.object({
  id: z.string().optional(),
  nombre: z.string().trim().min(2, "Escribe el nombre del producto.").max(120, "Nombre demasiado largo."),
  marca: z.string().trim().max(60),
  categoriaId: z.string(),
  plu: z
    .string()
    .trim()
    .refine((t) => t === "" || /^0*[1-9]\d{0,3}$/.test(t), "El código corto es un número de 1 a 4 cifras."),
  sinonimos: z.string().trim(),
  unidadBase: z.enum(["unidad", "libra", "kilo", "litro"]),
  tarifaIva: z.enum(["15", "0", "exento"]),
  stockMinimo: numeroOpcional("Número no válido."),
  manejaCaducidad: z.boolean(),
  retornable: z.boolean(),
  soloMayores: z.boolean(),
  ubicacion: z.string().trim().max(60),
  activo: z.boolean(),
  fotoRuta: z.string(),
  /** Costo de compra por unidad base, tal como lo dice la factura (antes del IVA). */
  costoUnitario: numeroOpcional("Costo no válido."),
  /** Si la compra tiene IVA: el costo real es el costo + IVA de compras. */
  compraConIva: z.boolean(),
  stockInicial: numeroOpcional("Stock no válido."),
  presentaciones: z
    .array(esquemaPresentacion)
    .min(1, "Agrega al menos una presentación.")
    .refine((ps) => ps.filter((p) => p.esBase).length === 1, "Debe haber exactamente una presentación base."),
});

export type DatosProducto = z.input<typeof esquemaProducto>;
export type DatosPresentacion = z.input<typeof esquemaPresentacion>;

export const esquemaCategoria = z.object({
  id: z.string().optional(),
  nombre: z.string().trim().min(2, "Escribe el nombre.").max(60),
  padreId: z.string(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color no válido."),
  tarifaIva: z.enum(["", "15", "0", "exento"]),
  margenObjetivo: numeroOpcional("Margen no válido."),
  activa: z.boolean(),
});
export type DatosCategoria = z.input<typeof esquemaCategoria>;

/** "123, 456 789" → ["123", "456", "789"] */
export function separarCodigos(texto: string): string[] {
  return Array.from(new Set(texto.split(/[\s,;]+/).map((c) => c.trim()).filter(Boolean)));
}
