"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { clienteServidor } from "@/lib/supabase/servidor";
import { mensajeError, type Resultado } from "@/lib/errores";
import { leerNumero } from "@/lib/dinero";
import { armarCompra, armarLineas, revisarCompra, type DatosCompra, type LineaCompra, type ProductoLigero } from "@/lib/compras";
import type { Json } from "@/lib/supabase/tipos";
import { puede, requerirPermiso, requerirUsuarioActivo } from "@/server/sesion";
import { productosParaCompra } from "@/server/abastecimiento";

/** Aviso al guardar una compra: el costo subió o en otro lugar estaba más barato. */
export type AvisoCosto = {
  productoId: string;
  producto: string;
  antes: string | null;
  ahora: string;
  masBaratoEn: string | null;
  costoMasBarato: string | null;
};

function refrescar() {
  revalidatePath("/compras", "layout");
  revalidatePath("/inventario", "layout");
  revalidatePath("/dinero");
  revalidatePath("/catalogo", "layout");
}

const texto = (v: unknown) => (v === null || v === undefined ? null : String(v));

function leerAvisos(avisos: unknown): AvisoCosto[] {
  return ((avisos as Record<string, unknown>[] | null) ?? []).map((a) => ({
    productoId: String(a.producto_id),
    producto: String(a.producto),
    antes: texto(a.antes),
    ahora: String(a.ahora),
    masBaratoEn: texto(a.mas_barato_en),
    costoMasBarato: texto(a.costo_mas_barato),
  }));
}

// ------------------------------------------------------------------ compras

export async function registrarCompra(datos: DatosCompra): Promise<Resultado<{ id: string; avisos: AvisoCosto[] }>> {
  const yo = await requerirUsuarioActivo();
  if (!puede(yo, "compras.registrar") && !puede(yo, "compras.recibir")) return { ok: false, mensaje: "No tienes permiso para hacer esto." };
  const errores = revisarCompra(datos, new Map());
  if (errores.length) return { ok: false, mensaje: errores.join(" ") };

  const supabase = await clienteServidor();
  const { data, error } = await supabase.rpc("registrar_compra", { p: armarCompra(datos) as unknown as Json });
  if (error) return { ok: false, mensaje: mensajeError(error, "No se pudo guardar la compra.") };
  refrescar();
  const r = data as { id: string; avisos: unknown };
  return { ok: true, datos: { id: r.id, avisos: leerAvisos(r.avisos) }, mensaje: "Compra guardada." };
}

export async function detallarCompra(compraId: string, lineas: LineaCompra[]): Promise<Resultado> {
  await requerirPermiso("compras.registrar");
  const supabase = await clienteServidor();
  const { error } = await supabase.rpc("detallar_compra", { p_compra: compraId, p_lineas: armarLineas(lineas) as unknown as Json });
  if (error) return { ok: false, mensaje: mensajeError(error, "No se pudo guardar el detalle.") };
  refrescar();
  return { ok: true, mensaje: "Compra detallada." };
}

export async function pagarCompra(entrada: { compraId: string; monto: string; cuentaId: string; nota: string }): Promise<Resultado> {
  await requerirPermiso("compras.registrar");
  const monto = leerNumero(entrada.monto);
  if (!monto || monto.lte(0)) return { ok: false, mensaje: "Escribe un monto mayor que 0." };
  const supabase = await clienteServidor();
  const { error } = await supabase.rpc("pagar_compra", {
    p: { compra_id: entrada.compraId, monto: monto.toString(), cuenta_id: entrada.cuentaId, nota: entrada.nota },
  });
  if (error) return { ok: false, mensaje: mensajeError(error, "No se pudo registrar el pago.") };
  refrescar();
  return { ok: true, mensaje: "Pago registrado." };
}

/** Sube la foto del recibo (ya achicada en el celular). Devuelve la ruta guardada. */
export async function subirRecibo(formulario: FormData): Promise<Resultado<{ ruta: string }>> {
  const yo = await requerirUsuarioActivo();
  if (!["compras.registrar", "compras.recibir", "gastos.registrar"].some((p) => puede(yo, p))) {
    return { ok: false, mensaje: "No tienes permiso para hacer esto." };
  }
  const foto = formulario.get("foto");
  if (!(foto instanceof File) || !foto.size) return { ok: false, mensaje: "Elige una foto." };
  if (foto.size > 3 * 1024 * 1024) return { ok: false, mensaje: "La foto pesa más de 3 MB." };
  const extension = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[foto.type];
  if (!extension) return { ok: false, mensaje: "La foto debe ser JPG, PNG o WEBP." };
  const ruta = `${new Date().toISOString().slice(0, 7)}/${randomUUID()}.${extension}`;
  const supabase = await clienteServidor();
  const { error } = await supabase.storage.from("recibos").upload(ruta, foto, { contentType: foto.type });
  if (error) return { ok: false, mensaje: "No se pudo subir la foto." };
  return { ok: true, datos: { ruta } };
}

/** Producto nuevo en segundos, desde una compra: nombre y precio de venta. */
export async function crearProductoRapido(entrada: { nombre: string; precioVenta: string }): Promise<Resultado<{ producto: ProductoLigero }>> {
  const yo = await requerirPermiso("productos.editar");
  const nombre = entrada.nombre.trim();
  if (!nombre) return { ok: false, mensaje: "Escribe el nombre del producto." };
  const precio = entrada.precioVenta.trim() ? leerNumero(entrada.precioVenta) : null;
  if (entrada.precioVenta.trim() && (!precio || precio.isNegative())) return { ok: false, mensaje: "El precio no es válido." };
  const supabase = await clienteServidor();
  const { data: id, error } = await supabase.rpc("guardar_producto", {
    p: {
      nombre,
      presentaciones: [{ nombre: "Unidad", factor: 1, es_base: true, precio_venta: precio?.toString() ?? null, codigos: [] }],
    } as unknown as Json,
  });
  if (error) return { ok: false, mensaje: mensajeError(error, "No se pudo crear el producto.") };
  const producto = (await productosParaCompra(yo)).find((p) => p.id === id);
  if (!producto) return { ok: false, mensaje: "Se creó, pero no se pudo cargar. Vuelve a buscarlo." };
  revalidatePath("/catalogo", "layout");
  return { ok: true, datos: { producto }, mensaje: "Producto creado." };
}

// ------------------------------------------------------------------ proveedores

export type DatosProveedor = {
  id?: string;
  nombre: string;
  tipo: string;
  ruc: string;
  contacto: string;
  telefono: string;
  direccion: string;
  diasVisita: number[];
  condiciones: string;
  notas: string;
  activo: boolean;
};

export async function guardarProveedor(d: DatosProveedor): Promise<Resultado<{ id: string }>> {
  await requerirPermiso("proveedores.gestionar");
  const supabase = await clienteServidor();
  const { data, error } = await supabase.rpc("guardar_proveedor", {
    p: {
      id: d.id ?? null, nombre: d.nombre, tipo: d.tipo, ruc: d.ruc, contacto: d.contacto, telefono: d.telefono,
      direccion: d.direccion, dias_visita: d.diasVisita, condiciones: d.condiciones, notas: d.notas, activo: d.activo,
    },
  });
  if (error) return { ok: false, mensaje: mensajeError(error, "No se pudo guardar el proveedor.") };
  refrescar();
  return { ok: true, datos: { id: data as string }, mensaje: "Proveedor guardado." };
}

// ------------------------------------------------------------------ dinero

export async function moverDinero(entrada: {
  tipo: "transferencia" | "aporte" | "retiro" | "correccion";
  origen?: string;
  destino?: string;
  monto: string;
  nota: string;
}): Promise<Resultado> {
  await requerirPermiso("dinero.mover");
  const monto = leerNumero(entrada.monto);
  if (!monto || monto.isNegative() || (entrada.tipo !== "correccion" && monto.isZero())) {
    return { ok: false, mensaje: "Escribe un monto válido." };
  }
  const supabase = await clienteServidor();
  const { error } = await supabase.rpc("mover_dinero", {
    p: { tipo: entrada.tipo, origen: entrada.origen ?? null, destino: entrada.destino ?? null, monto: monto.toString(), nota: entrada.nota },
  });
  if (error) return { ok: false, mensaje: mensajeError(error, "No se pudo registrar.") };
  revalidatePath("/dinero");
  return { ok: true, mensaje: "Listo." };
}

export async function guardarCuenta(entrada: { id?: string; nombre: string; tipo: string; activa: boolean }): Promise<Resultado> {
  await requerirPermiso("dinero.mover");
  const supabase = await clienteServidor();
  const { error } = await supabase.rpc("guardar_cuenta", { p: { id: entrada.id ?? null, nombre: entrada.nombre, tipo: entrada.tipo, activa: entrada.activa } });
  if (error) return { ok: false, mensaje: mensajeError(error, "No se pudo guardar la cuenta.") };
  revalidatePath("/dinero");
  return { ok: true, mensaje: "Cuenta guardada." };
}

// ------------------------------------------------------------------ viaje

export async function iniciarViaje(id: string, lista: { productoId: string; cantidad: string | null }[]): Promise<Resultado> {
  await requerirPermiso("compras.registrar");
  const supabase = await clienteServidor();
  const { error } = await supabase.rpc("iniciar_viaje", {
    p_id: id,
    p_lista: lista.map((l) => ({ producto_id: l.productoId, cantidad: l.cantidad })) as unknown as Json,
  });
  if (error) return { ok: false, mensaje: mensajeError(error, "No se pudo iniciar el viaje.") };
  revalidatePath("/compras", "layout");
  return { ok: true };
}

export async function marcarListaViaje(viajeId: string, productoId: string, tachado: boolean): Promise<Resultado> {
  await requerirPermiso("compras.registrar");
  const supabase = await clienteServidor();
  const { error } = await supabase.rpc("marcar_lista_viaje", { p_viaje: viajeId, p_producto: productoId, p_tachado: tachado });
  if (error) return { ok: false, mensaje: mensajeError(error) };
  return { ok: true };
}

export type DatosGasto = { id: string; viajeId?: string; categoriaId: string; descripcion: string; monto: string; cuentaId: string };

export async function registrarGasto(d: DatosGasto): Promise<Resultado> {
  await requerirUsuarioActivo();
  const monto = leerNumero(d.monto);
  if (!monto || monto.lte(0)) return { ok: false, mensaje: "Escribe un monto mayor que 0." };
  const supabase = await clienteServidor();
  const { error } = await supabase.rpc("registrar_gasto", {
    p: { id: d.id, viaje_id: d.viajeId ?? null, categoria_id: d.categoriaId, descripcion: d.descripcion, monto: monto.toString(), cuenta_id: d.cuentaId },
  });
  if (error) return { ok: false, mensaje: mensajeError(error, "No se pudo guardar el gasto.") };
  revalidatePath("/compras", "layout");
  revalidatePath("/dinero");
  return { ok: true, mensaje: "Gasto anotado." };
}

export async function recibirViaje(
  viajeId: string,
  lineas: { lineaId: number; recibido: string; danados: string }[],
): Promise<Resultado<{ avisos: AvisoCosto[] }>> {
  await requerirPermiso("compras.registrar");
  for (const l of lineas) {
    const r = leerNumero(l.recibido);
    const d = l.danados.trim() ? leerNumero(l.danados) : null;
    if (!r || r.isNegative() || (l.danados.trim() && (!d || d.isNegative()))) {
      return { ok: false, mensaje: "Revisa las cantidades: deben ser números de 0 en adelante." };
    }
  }
  const supabase = await clienteServidor();
  const { data, error } = await supabase.rpc("recibir_viaje", {
    p_viaje: viajeId,
    p_lineas: lineas.map((l) => ({
      linea_id: l.lineaId,
      recibido: leerNumero(l.recibido)!.toString(),
      danados: l.danados.trim() ? leerNumero(l.danados)!.toString() : "0",
    })) as unknown as Json,
  });
  if (error) return { ok: false, mensaje: mensajeError(error, "No se pudo recibir el viaje.") };
  refrescar();
  return { ok: true, datos: { avisos: leerAvisos(data) }, mensaje: "Listo: todo entró al stock." };
}

// ------------------------------------------------------------------ pedidos

export async function guardarPedido(entrada: {
  id?: string;
  proveedorId: string;
  nota: string;
  lineas: { productoId: string; presentacionId: string; cantidad: string }[];
}): Promise<Resultado<{ id: string }>> {
  await requerirPermiso("compras.registrar");
  const lineas = [];
  for (const l of entrada.lineas) {
    const n = leerNumero(l.cantidad);
    if (!n || n.lte(0)) return { ok: false, mensaje: "Todas las cantidades deben ser mayores que 0." };
    lineas.push({ producto_id: l.productoId, presentacion_id: l.presentacionId, cantidad: n.toString() });
  }
  if (!lineas.length) return { ok: false, mensaje: "Agrega al menos un producto al pedido." };
  const supabase = await clienteServidor();
  const { data, error } = await supabase.rpc("guardar_pedido", {
    p: { id: entrada.id ?? null, proveedor_id: entrada.proveedorId, nota: entrada.nota, lineas } as unknown as Json,
  });
  if (error) return { ok: false, mensaje: mensajeError(error, "No se pudo guardar el pedido.") };
  revalidatePath("/compras", "layout");
  return { ok: true, datos: { id: data as string }, mensaje: "Pedido guardado." };
}

export async function marcarPedido(pedidoId: string, estado: "enviado" | "recibido" | "anulado", compraId?: string): Promise<Resultado> {
  await requerirUsuarioActivo();
  const supabase = await clienteServidor();
  const { error } = await supabase.rpc("marcar_pedido", { p_pedido: pedidoId, p_estado: estado, p_compra: compraId });
  if (error) return { ok: false, mensaje: mensajeError(error) };
  revalidatePath("/compras", "layout");
  return { ok: true };
}

// ------------------------------------------------------------------ envases

export async function guardarEnvase(entrada: { id?: string; nombre: string; garantia: string; proveedorId: string; activo: boolean }): Promise<Resultado> {
  await requerirPermiso("proveedores.gestionar");
  const garantia = entrada.garantia.trim() ? leerNumero(entrada.garantia) : null;
  if (entrada.garantia.trim() && (!garantia || garantia.isNegative())) return { ok: false, mensaje: "La garantía no es válida." };
  const supabase = await clienteServidor();
  const { error } = await supabase.rpc("guardar_envase", {
    p: { id: entrada.id ?? null, nombre: entrada.nombre, garantia: garantia?.toString() ?? "0", proveedor_id: entrada.proveedorId || null, activo: entrada.activo },
  });
  if (error) return { ok: false, mensaje: mensajeError(error, "No se pudo guardar el envase.") };
  revalidatePath("/inventario/envases");
  return { ok: true, mensaje: "Envase guardado." };
}

export async function registrarEnvases(entrada: { envaseId: string; tipo: string; cantidad: string; cuentaId: string; nota: string }): Promise<Resultado> {
  await requerirUsuarioActivo();
  const n = Number(entrada.cantidad);
  if (!Number.isInteger(n) || n < 0) return { ok: false, mensaje: "La cantidad debe ser un número entero." };
  const supabase = await clienteServidor();
  const { error } = await supabase.rpc("registrar_envases", {
    p: { envase_id: entrada.envaseId, tipo: entrada.tipo, cantidad: n, cuenta_id: entrada.cuentaId || null, nota: entrada.nota },
  });
  if (error) return { ok: false, mensaje: mensajeError(error, "No se pudo registrar.") };
  revalidatePath("/inventario/envases");
  revalidatePath("/dinero");
  return { ok: true, mensaje: "Envases actualizados." };
}

// ------------------------------------------------------------------ inventario

export async function registrarLote(entrada: { productoId: string; vence: string; cantidad: string }): Promise<Resultado> {
  await requerirPermiso("inventario.ajustar");
  const n = leerNumero(entrada.cantidad);
  if (!n || n.lte(0)) return { ok: false, mensaje: "Escribe una cantidad mayor que 0." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entrada.vence)) return { ok: false, mensaje: "Elige la fecha de caducidad." };
  const supabase = await clienteServidor();
  const { error } = await supabase.rpc("registrar_lote", { p_producto: entrada.productoId, p_vence: entrada.vence, p_cantidad: Number(n.toString()) });
  if (error) return { ok: false, mensaje: mensajeError(error, "No se pudo anotar la fecha.") };
  revalidatePath("/inventario", "layout");
  revalidatePath("/catalogo", "layout");
  return { ok: true, mensaje: "Fecha anotada." };
}

export async function iniciarConteo(nombre: string, categoriaId: string): Promise<Resultado<{ id: string }>> {
  await requerirPermiso("inventario.contar");
  const supabase = await clienteServidor();
  const { data, error } = await supabase.rpc("iniciar_conteo", { p_nombre: nombre, p_categoria: categoriaId || undefined });
  if (error) return { ok: false, mensaje: mensajeError(error, "No se pudo empezar el conteo.") };
  revalidatePath("/inventario/conteos");
  return { ok: true, datos: { id: data as string } };
}

export async function anotarConteo(conteoId: string, productoId: string, contado: string): Promise<Resultado> {
  await requerirPermiso("inventario.contar");
  const n = contado.trim() ? leerNumero(contado) : null;
  if (contado.trim() && (!n || n.isNegative())) return { ok: false, mensaje: "Lo contado debe ser un número de 0 en adelante." };
  const supabase = await clienteServidor();
  const { error } = await supabase.rpc("anotar_conteo", {
    p_conteo: conteoId,
    p_producto: productoId,
    p_contado: n === null ? (null as unknown as number) : Number(n.toString()),
  });
  if (error) return { ok: false, mensaje: mensajeError(error, "No se pudo guardar.") };
  return { ok: true };
}

export async function enviarConteo(conteoId: string): Promise<Resultado> {
  await requerirPermiso("inventario.contar");
  const supabase = await clienteServidor();
  const { error } = await supabase.rpc("enviar_conteo", { p_conteo: conteoId });
  if (error) return { ok: false, mensaje: mensajeError(error) };
  revalidatePath("/inventario/conteos", "layout");
  return { ok: true, mensaje: "Conteo enviado." };
}

export async function aprobarConteo(conteoId: string, productos: string[] | null): Promise<Resultado<{ cambios: number }>> {
  await requerirPermiso("inventario.aprobar");
  const supabase = await clienteServidor();
  const { data, error } = await supabase.rpc("aprobar_conteo", { p_conteo: conteoId, p_productos: productos ?? undefined });
  if (error) return { ok: false, mensaje: mensajeError(error, "No se pudo aprobar.") };
  refrescar();
  return { ok: true, datos: { cambios: data as number } };
}

export async function anularConteo(conteoId: string): Promise<Resultado> {
  await requerirUsuarioActivo();
  const supabase = await clienteServidor();
  const { error } = await supabase.rpc("anular_conteo", { p_conteo: conteoId });
  if (error) return { ok: false, mensaje: mensajeError(error) };
  revalidatePath("/inventario/conteos", "layout");
  return { ok: true, mensaje: "Conteo anulado." };
}
