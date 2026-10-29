import { beforeAll, describe, expect, test } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/tipos";
import { admin, anonimo, crearCuenta, sesionDe, vaciarProyecto } from "./ayuda";

/*
 * Reglas de acceso de la fase 2, probadas directo contra la base de datos
 * (como lo haría alguien que intenta saltarse la app).
 * Las pruebas van en orden: cada bloque usa lo que dejó el anterior.
 */

const DUENA = "duena@prueba.sandry.test";
const CAJERA = "cajera@prueba.sandry.test";
const BODEGA = "bodega@prueba.sandry.test";

let idDuena: string;
let idCajera: string;
let idBodega: string;
let duena: SupabaseClient<Database>;
let cajera: SupabaseClient<Database>;

beforeAll(async () => {
  await vaciarProyecto();
  idDuena = await crearCuenta(DUENA, { nombre_completo: "Rosa Dueña", telefono: "0991112233" });
  idCajera = await crearCuenta(CAJERA, { nombre_completo: "Ana Cajera", telefono: "0994445566", cedula: "1710034065" });
  idBodega = await crearCuenta(BODEGA, { nombre_completo: "Luz Bodega" });
  duena = await sesionDe(DUENA);
  cajera = await sesionDe(CAJERA);
});

describe("registro", () => {
  test("la primera persona queda como administradora activa", async () => {
    const { data } = await admin().from("perfiles").select("estado, rol_id").eq("id", idDuena).single();
    expect(data).toEqual({ estado: "activo", rol_id: "administradora" });
  });

  test("las siguientes quedan pendientes y sin rol", async () => {
    const { data } = await admin().from("perfiles").select("estado, rol_id, telefono, cedula").eq("id", idCajera).single();
    expect(data).toEqual({ estado: "pendiente", rol_id: null, telefono: "0994445566", cedula: "1710034065" });
  });

  test("la bitácora anota los registros", async () => {
    const { data } = await admin().from("bitacora").select("accion, usuario_id").order("id");
    expect(data?.map((e) => e.accion)).toEqual(["registro_primera_administradora", "registro", "registro"]);
  });
});

describe("persona pendiente", () => {
  test("solo ve su propio perfil y nada de la tienda", async () => {
    const { data: perfiles } = await cajera.from("perfiles").select("id");
    expect(perfiles?.map((p) => p.id)).toEqual([idCajera]);
    const { data: roles } = await cajera.from("roles").select("id");
    expect(roles).toEqual([]);
    const { data: ajustes } = await cajera.from("ajustes").select("*");
    expect(ajustes).toEqual([]);
  });

  test("no puede aprobarse a sí misma", async () => {
    const { error } = await cajera.rpc("aprobar_usuario", { p_usuario: idCajera, p_rol: "administradora" });
    expect(error?.code).toBe("42501");
  });

  test("no puede cambiar su rol ni su estado escribiendo directo en la tabla", async () => {
    await cajera.from("perfiles").update({ estado: "activo", rol_id: "administradora" }).eq("id", idCajera);
    const { data } = await admin().from("perfiles").select("estado, rol_id").eq("id", idCajera).single();
    expect(data).toEqual({ estado: "pendiente", rol_id: null });
  });

  test("no puede crear su PIN hasta ser aprobada", async () => {
    const { error } = await cajera.rpc("definir_mi_pin", { p_pin: "1234" });
    expect(error?.message).toContain("no está activa");
  });
});

describe("la administradora aprueba", () => {
  test("ve a todas las personas", async () => {
    const { data } = await duena.from("perfiles").select("id");
    expect(data).toHaveLength(3);
  });

  test("aprueba a la cajera con su rol y queda en la bitácora", async () => {
    const { error } = await duena.rpc("aprobar_usuario", { p_usuario: idCajera, p_rol: "cajera" });
    expect(error).toBeNull();
    const { data } = await admin().from("perfiles").select("estado, rol_id, aprobado_por").eq("id", idCajera).single();
    expect(data).toEqual({ estado: "activo", rol_id: "cajera", aprobado_por: idDuena });
    const { data: evento } = await duena.from("bitacora").select("accion, usuario_id, entidad_id").eq("accion", "aprobar_usuario").single();
    expect(evento).toEqual({ accion: "aprobar_usuario", usuario_id: idDuena, entidad_id: idCajera });
  });

  test("no se puede aprobar dos veces", async () => {
    const { error } = await duena.rpc("aprobar_usuario", { p_usuario: idCajera, p_rol: "cajera" });
    expect(error?.message).toContain("no está pendiente");
  });
});

describe("cajera activa", () => {
  test("tiene los permisos de cajera y no los de administradora", async () => {
    const { data } = await cajera.rpc("mis_permisos");
    expect(new Set(data as string[])).toEqual(
      new Set(["ventas.vender", "ventas.ver_propias", "caja.abrir_cerrar", "clientes.gestionar", "productos.ver"]),
    );
    const { data: verReportes } = await cajera.rpc("tiene_permiso", { p_permiso: "reportes.ver" });
    expect(verReportes).toBe(false);
    const { data: verCostos } = await cajera.rpc("tiene_permiso", { p_permiso: "costos.ver" });
    expect(verCostos).toBe(false);
  });

  test("no ve la bitácora ni a las demás personas", async () => {
    const { data: bitacora } = await cajera.from("bitacora").select("id");
    expect(bitacora).toEqual([]);
    const { data: perfiles } = await cajera.from("perfiles").select("id");
    expect(perfiles?.map((p) => p.id)).toEqual([idCajera]);
  });

  test("no puede usar las acciones de la administradora", async () => {
    const intentos = await Promise.all([
      cajera.rpc("aprobar_usuario", { p_usuario: idBodega, p_rol: "cajera" }),
      cajera.rpc("cambiar_rol_usuario", { p_usuario: idCajera, p_rol: "administradora" }),
      cajera.rpc("cambiar_estado_usuario", { p_usuario: idDuena, p_activo: false }),
      cajera.rpc("actualizar_permisos_rol", { p_rol: "cajera", p_permisos: ["reportes.ver"] }),
      cajera.rpc("actualizar_ajustes", { p_minutos_inactividad: 480, p_descuento_max: 100 }),
      cajera.rpc("resetear_pin", { p_usuario: idDuena }),
    ]);
    for (const { error } of intentos) expect(error?.code).toBe("42501");
  });

  test("no puede llamar a las funciones exclusivas del servidor", async () => {
    const intentos = await Promise.all([
      cajera.rpc("verificar_pin", { p_usuario: idDuena, p_pin: "1234" }),
      cajera.rpc("buscar_correo_por_dato", { p_dato: "0991112233" }),
      cajera.rpc("registrar_evento", { p_usuario: idDuena, p_accion: "falso", p_entidad: "x", p_entidad_id: "x" }),
    ]);
    for (const { error } of intentos) expect(error).not.toBeNull();
  });

  test("no puede escribir directo en la bitácora ni en los permisos", async () => {
    await cajera.from("bitacora").insert({ accion: "falso" });
    await cajera.from("rol_permisos").insert({ rol_id: "cajera", permiso: "reportes.ver" });
    const { count } = await admin().from("bitacora").select("id", { count: "exact", head: true }).eq("accion", "falso");
    expect(count).toBe(0);
    const { data } = await cajera.rpc("tiene_permiso", { p_permiso: "reportes.ver" });
    expect(data).toBe(false);
  });
});

describe("PIN", () => {
  test("debe tener de 4 a 6 números", async () => {
    for (const pin of ["12", "1234567", "12a4"]) {
      const { error } = await cajera.rpc("definir_mi_pin", { p_pin: pin });
      expect(error?.message).toContain("4 a 6");
    }
  });

  test("nadie puede leer el PIN guardado, ni su dueña", async () => {
    await cajera.rpc("definir_mi_pin", { p_pin: "4321" });
    const { data } = await cajera.from("pines").select("*");
    expect(data ?? []).toEqual([]);
    const { data: tiene } = await cajera.rpc("tengo_pin");
    expect(tiene).toBe(true);
  });

  test("el servidor lo verifica y bloquea tras 5 errores", async () => {
    const a = admin();
    expect((await a.rpc("verificar_pin", { p_usuario: idCajera, p_pin: "4321" })).data).toBe("ok");
    for (let i = 1; i <= 4; i++) {
      expect((await a.rpc("verificar_pin", { p_usuario: idCajera, p_pin: "0000" })).data).toBe("incorrecto");
    }
    expect((await a.rpc("verificar_pin", { p_usuario: idCajera, p_pin: "0000" })).data).toBe("bloqueado");
    // Aunque ahora acierte, sigue bloqueado.
    expect((await a.rpc("verificar_pin", { p_usuario: idCajera, p_pin: "4321" })).data).toBe("bloqueado");
    expect((await a.rpc("verificar_pin", { p_usuario: idDuena, p_pin: "1234" })).data).toBe("sin_pin");
  });

  test("la administradora puede borrarlo", async () => {
    expect((await duena.rpc("resetear_pin", { p_usuario: idCajera })).error).toBeNull();
    expect((await admin().rpc("verificar_pin", { p_usuario: idCajera, p_pin: "4321" })).data).toBe("sin_pin");
  });
});

describe("permisos por rol", () => {
  test("la administradora agrega un permiso a la cajera y vale de inmediato", async () => {
    const actuales = (await cajera.rpc("mis_permisos")).data as string[];
    const { error } = await duena.rpc("actualizar_permisos_rol", { p_rol: "cajera", p_permisos: [...actuales, "compras.recibir"] });
    expect(error).toBeNull();
    expect((await cajera.rpc("tiene_permiso", { p_permiso: "compras.recibir" })).data).toBe(true);
  });

  test("los permisos de la administradora no se pueden quitar", async () => {
    const { error } = await duena.rpc("actualizar_permisos_rol", { p_rol: "administradora", p_permisos: [] });
    expect(error?.message).toContain("no se pueden quitar");
  });

  test("no acepta permisos inventados", async () => {
    const { error } = await duena.rpc("actualizar_permisos_rol", { p_rol: "cajera", p_permisos: ["todo.todo"] });
    expect(error?.message).toContain("no existe");
  });
});

describe("protecciones de la administradora", () => {
  test("no puede desactivarse ni cambiarse el rol a sí misma", async () => {
    expect((await duena.rpc("cambiar_estado_usuario", { p_usuario: idDuena, p_activo: false })).error?.message).toContain(
      "a ti misma",
    );
    expect((await duena.rpc("cambiar_rol_usuario", { p_usuario: idDuena, p_rol: "cajera" })).error?.message).toContain(
      "propio rol",
    );
  });

  test("desactivar conserva la cuenta pero quita todo acceso", async () => {
    await admin().from("dispositivo_usuarios").insert({ dispositivo_id: crypto.randomUUID(), usuario_id: idCajera });
    expect((await duena.rpc("cambiar_estado_usuario", { p_usuario: idCajera, p_activo: false })).error).toBeNull();
    expect((await cajera.rpc("tiene_permiso", { p_permiso: "ventas.vender" })).data).toBe(false);
    expect((await cajera.from("roles").select("id")).data).toEqual([]);
    const { count } = await admin().from("dispositivo_usuarios").select("usuario_id", { count: "exact", head: true }).eq("usuario_id", idCajera);
    expect(count).toBe(0);
    const { data } = await admin().from("perfiles").select("estado").eq("id", idCajera).single();
    expect(data?.estado).toBe("desactivado");
  });

  test("y se puede reactivar", async () => {
    expect((await duena.rpc("cambiar_estado_usuario", { p_usuario: idCajera, p_activo: true })).error).toBeNull();
    expect((await cajera.rpc("tiene_permiso", { p_permiso: "ventas.vender" })).data).toBe(true);
  });
});

describe("ajustes", () => {
  test("solo la administradora los cambia, y queda en la bitácora", async () => {
    expect((await duena.rpc("actualizar_ajustes", { p_minutos_inactividad: 20, p_descuento_max: 10 })).error).toBeNull();
    const { data } = await cajera.from("ajustes").select("minutos_inactividad, descuento_max_sin_autorizacion").single();
    expect(data).toEqual({ minutos_inactividad: 20, descuento_max_sin_autorizacion: 10 });
    const { count } = await duena.from("bitacora").select("id", { count: "exact", head: true }).eq("accion", "cambiar_ajustes");
    expect(count).toBe(1);
  });

  test("rechaza valores fuera de rango", async () => {
    const { error } = await duena.rpc("actualizar_ajustes", { p_minutos_inactividad: 0, p_descuento_max: 5 });
    expect(error).not.toBeNull();
  });
});

describe("sin sesión", () => {
  test("no ve nada", async () => {
    const anon = anonimo();
    for (const tabla of ["perfiles", "roles", "permisos", "ajustes", "bitacora", "pines"] as const) {
      const { data } = await anon.from(tabla).select("*");
      expect(data ?? [], tabla).toEqual([]);
    }
  });
});

describe("olvidé mi correo", () => {
  test("encuentra el correo por teléfono o cédula (solo desde el servidor)", async () => {
    const a = admin();
    expect((await a.rpc("buscar_correo_por_dato", { p_dato: "099 444 5566" })).data).toBe(CAJERA);
    expect((await a.rpc("buscar_correo_por_dato", { p_dato: "1710034065" })).data).toBe(CAJERA);
    expect((await a.rpc("buscar_correo_por_dato", { p_dato: "0000000000" })).data).toBeNull();
    expect((await a.rpc("buscar_correo_por_dato", { p_dato: "12" })).data).toBeNull();
  });
});
