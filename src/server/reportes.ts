import "server-only";
import { clienteServidor } from "@/lib/supabase/servidor";
import type { ProductoReporte } from "@/lib/reportes";

/** Lo que devuelve la función reporte() de la base de datos. */
export type Reporte = {
  ventas: number;
  cantidad_ventas: number;
  costo: number;
  ganancia_bruta: number;
  margen: number | null;
  ticket_promedio: number | null;
  gastos: number;
  perdidas: number;
  ganancia_neta: number;
  gastos_por_grupo: Record<string, number>;
  gastos_personales: number;
  perdidas_por_tipo: Record<string, number>;
  por_forma: Record<string, number>;
  por_dia: { dia: string; ventas: number; ganancia: number }[];
  por_hora: { hora: number; ventas: number; total: number }[];
  por_dia_semana: { dia: number; ventas: number; total: number }[];
  por_categoria: { categoria: string; ventas: number; ganancia: number }[];
  por_trabajadora: { nombre: string; ventas: number; total: number }[];
  productos: ProductoReporte[];
  varios: number;
  flujo: { motivo: string; entra: number | null; sale: number | null }[];
  flujo_por_cuenta: { cuenta: string; entra: number; sale: number; saldo: number }[];
  compras_por_lugar: { lugar: string; compras: number; total: number }[];
  compras: number;
  gastos_transporte: number;
  inventario: { costo: number; venta: number };
  fiados: number;
  por_pagar: number;
  conciliacion: { dia: string; forma: string; total: number; verificado: boolean }[];
};

export async function obtenerReporte(desde: string, hasta: string, usuarioId?: string): Promise<{ reporte: Reporte | null; error?: string }> {
  const supabase = await clienteServidor();
  const { data, error } = await supabase.rpc("reporte", { p_desde: desde, p_hasta: hasta, p_usuario: usuarioId || undefined });
  if (error) return { reporte: null, error: error.message };
  return { reporte: data as unknown as Reporte };
}

export type Panel = {
  hoy: Reporte;
  semana_pasada: { ventas: number; ganancia_bruta: number };
  caja_abierta: boolean;
  efectivo_esperado: number;
  saldos: { nombre: string; saldo: number; tipo: string }[];
  alertas: Record<"poco_stock" | "por_caducar" | "fiados" | "por_pagar_vencido" | "pendientes" | "revisar" | "gastos_fijos", number>;
};

export async function panelInicio(): Promise<Panel | null> {
  const supabase = await clienteServidor();
  const { data } = await supabase.rpc("panel_inicio");
  return (data as unknown as Panel) ?? null;
}

export async function trabajadoras(): Promise<{ id: string; nombre: string }[]> {
  const supabase = await clienteServidor();
  const { data } = await supabase.from("perfiles").select("id, nombre_completo").eq("estado", "activo").order("nombre_completo");
  return (data ?? []).map((p) => ({ id: p.id, nombre: p.nombre_completo }));
}
