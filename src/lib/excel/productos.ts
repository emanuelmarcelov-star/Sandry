/**
 * Importación de productos desde Excel: revisa cada fila y explica los
 * problemas en español. Se usa en el navegador (vista previa editable) y en el
 * servidor (que vuelve a revisar todo antes de guardar).
 */
import { dec, leerNumero } from "@/lib/dinero";
import { UNIDADES, type TarifaIva, type UnidadBase } from "@/lib/catalogo";

/** Columnas de la hoja "Productos", en orden. */
export const COLUMNAS_PRODUCTOS = [
  { clave: "codigoBarras", titulo: "Código de barras", ancho: 18 },
  { clave: "plu", titulo: "Código interno", ancho: 12 },
  { clave: "nombre", titulo: "Nombre", ancho: 32 },
  { clave: "marca", titulo: "Marca", ancho: 16 },
  { clave: "categoria", titulo: "Categoría", ancho: 24 },
  { clave: "subcategoria", titulo: "Subcategoría", ancho: 22 },
  { clave: "unidadBase", titulo: "Unidad base", ancho: 12 },
  { clave: "presentacion", titulo: "Presentación", ancho: 16 },
  { clave: "factor", titulo: "Factor", ancho: 9 },
  { clave: "precioCompra", titulo: "Precio de compra", ancho: 14 },
  { clave: "precioVenta", titulo: "Precio de venta", ancho: 14 },
  { clave: "iva", titulo: "IVA", ancho: 9 },
  { clave: "stockInicial", titulo: "Stock inicial", ancho: 12 },
  { clave: "stockMinimo", titulo: "Stock mínimo", ancho: 12 },
  { clave: "caducidad", titulo: "Fecha de caducidad", ancho: 16 },
  { clave: "proveedor", titulo: "Proveedor", ancho: 20 },
] as const;

export type ClaveColumna = (typeof COLUMNAS_PRODUCTOS)[number]["clave"];
export type FilaProducto = { fila: number } & Record<ClaveColumna, string>;

export type CategoriaContexto = { id: string; nombre: string; padreId: string | null };
export type ProductoContexto = { id: string; nombre: string; marca: string; plu: string | null; codigos: string[] };
export type ContextoImportacion = {
  categorias: CategoriaContexto[];
  productos: ProductoContexto[];
  puedeVerCostos: boolean;
};

export type Coincidencia =
  | { tipo: "nuevo" }
  | { tipo: "codigo" | "plu" | "nombre"; productoId: string; nombre: string }
  | { tipo: "parecido"; productoId: string; nombre: string };

export type FilaRevisada = {
  fila: number;
  vacia: boolean;
  errores: string[];
  avisos: string[];
  coincidencia: Coincidencia;
  /** Datos ya interpretados (solo si no hay errores). */
  datos?: {
    nombre: string;
    marca: string;
    plu: string | null;
    codigo: string | null;
    unidadBase: UnidadBase;
    presentacion: string;
    factor: string;
    esBase: boolean;
    precioCompra: string | null;
    precioVenta: string | null;
    iva: TarifaIva | null;
    stock: string | null;
    stockMinimo: string | null;
    categoria: string | null;
    subcategoria: string | null;
    caducidad: boolean;
  };
};

// ------------------------------------------------------------------ texto

/** Minúsculas, sin tildes ni espacios de más: para comparar nombres. */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, " ")
    .trim();
}

function trigramas(texto: string): Set<string> {
  const t = `  ${normalizarTexto(texto)} `;
  const resultado = new Set<string>();
  for (let i = 0; i < t.length - 2; i++) resultado.add(t.slice(i, i + 3));
  return resultado;
}

/** Parecido entre 0 y 1 (1 = iguales). */
export function parecido(a: string, b: string): number {
  const x = trigramas(a);
  const y = trigramas(b);
  let comunes = 0;
  for (const t of x) if (y.has(t)) comunes++;
  return comunes / (x.size + y.size - comunes || 1);
}

const UNIDADES_ACEPTADAS: Record<string, UnidadBase> = {
  unidad: "unidad", unidades: "unidad", u: "unidad", und: "unidad", un: "unidad",
  libra: "libra", libras: "libra", lb: "libra", lbs: "libra",
  kilo: "kilo", kilos: "kilo", kg: "kilo", kilogramo: "kilo",
  litro: "litro", litros: "litro", l: "litro", lt: "litro", lts: "litro",
};

function leerIva(texto: string): TarifaIva | null | "invalido" {
  const t = normalizarTexto(texto).replace(/\s/g, "");
  if (t === "") return null;
  if (["15", "15%", "iva15", "si", "sí"].includes(t)) return "15";
  if (["0", "0%", "iva0", "no"].includes(t)) return "0";
  if (t.startsWith("exent")) return "exento";
  return "invalido";
}

export function normalizarPlu(texto: string): string {
  return texto.trim().replace(/^0+(?=\d)/, "");
}

// ------------------------------------------------------------------ revisión

/** Busca una categoría por nombre (y opcionalmente dentro de una madre). */
export function buscarCategoria(
  categorias: CategoriaContexto[],
  nombre: string,
  padreId: string | null | undefined = undefined,
): CategoriaContexto | undefined {
  const n = normalizarTexto(nombre);
  return categorias.find(
    (c) => normalizarTexto(c.nombre) === n && (padreId === undefined || c.padreId === padreId),
  );
}

/**
 * Revisa todas las filas. Devuelve, por fila, los errores (rojo), los avisos
 * (amarillo) y con qué producto existente coincide.
 */
export function revisarFilas(
  filas: FilaProducto[],
  contexto: ContextoImportacion,
): { filas: FilaRevisada[]; categoriasNuevas: string[] } {
  const porCodigo = new Map<string, ProductoContexto>();
  const porPlu = new Map<string, ProductoContexto>();
  for (const p of contexto.productos) {
    for (const c of p.codigos) porCodigo.set(c, p);
    if (p.plu) porPlu.set(p.plu, p);
  }

  // Para detectar repetidos dentro del mismo archivo (entre productos distintos).
  const claveProducto = (f: FilaProducto) => `${normalizarTexto(f.nombre)}|${normalizarTexto(f.marca)}`;
  const codigosEnArchivo = new Map<string, string>();
  const plusEnArchivo = new Map<string, string>();
  const categoriasNuevas = new Set<string>();

  const revisadas = filas.map((f): FilaRevisada => {
    const errores: string[] = [];
    const avisos: string[] = [];
    const vacia = Object.entries(f).every(([k, v]) => k === "fila" || String(v ?? "").trim() === "");
    if (vacia) return { fila: f.fila, vacia, errores, avisos, coincidencia: { tipo: "nuevo" } };

    const codigo = f.codigoBarras.trim().replace(/\s/g, "");
    const plu = normalizarPlu(f.plu);
    const nombre = f.nombre.trim();
    const marca = f.marca.trim();

    // ¿Con qué producto existente coincide? Código → PLU → nombre.
    let coincidencia: Coincidencia = { tipo: "nuevo" };
    const porElCodigo = codigo ? porCodigo.get(codigo) : undefined;
    const porElPlu = plu ? porPlu.get(plu) : undefined;
    if (porElCodigo) coincidencia = { tipo: "codigo", productoId: porElCodigo.id, nombre: porElCodigo.nombre };
    else if (porElPlu) coincidencia = { tipo: "plu", productoId: porElPlu.id, nombre: porElPlu.nombre };
    else if (nombre) {
      const exacto = contexto.productos.find(
        (p) => normalizarTexto(p.nombre) === normalizarTexto(nombre) && (!marca || normalizarTexto(p.marca) === normalizarTexto(marca)),
      );
      if (exacto) coincidencia = { tipo: "nombre", productoId: exacto.id, nombre: exacto.nombre };
      else {
        let mejor: { p: ProductoContexto; valor: number } | null = null;
        for (const p of contexto.productos) {
          const valor = parecido(p.nombre, nombre);
          if (valor >= 0.6 && (!mejor || valor > mejor.valor)) mejor = { p, valor };
        }
        if (mejor) coincidencia = { tipo: "parecido", productoId: mejor.p.id, nombre: mejor.p.nombre };
      }
    }

    if (!nombre && coincidencia.tipo !== "codigo" && coincidencia.tipo !== "plu") {
      errores.push("Falta el nombre del producto.");
    }

    if (codigo && !/^[0-9A-Za-z.\-]{3,64}$/.test(codigo)) {
      errores.push("El código de barras tiene caracteres no válidos.");
    }
    if (codigo) {
      const otro = codigosEnArchivo.get(codigo);
      if (otro && otro !== claveProducto(f)) errores.push(`El código de barras ${codigo} está repetido en otra fila.`);
      codigosEnArchivo.set(codigo, claveProducto(f));
    }

    if (plu && !/^[1-9]\d{0,3}$/.test(plu)) errores.push("El código interno debe ser un número de 1 a 4 cifras.");
    if (plu) {
      const otro = plusEnArchivo.get(plu);
      if (otro && otro !== claveProducto(f)) errores.push(`El código interno ${plu} está repetido en otra fila.`);
      plusEnArchivo.set(plu, claveProducto(f));
      if (porElPlu && porElCodigo && porElPlu.id !== porElCodigo.id) {
        errores.push(`El código interno ${plu} ya lo usa «${porElPlu.nombre}».`);
      }
    }

    const unidadTexto = normalizarTexto(f.unidadBase);
    const unidadBase = unidadTexto === "" ? "unidad" : UNIDADES_ACEPTADAS[unidadTexto];
    if (!unidadBase) errores.push("Unidad base no válida. Usa: unidad, libra, kilo o litro.");
    const nombreBase = UNIDADES[unidadBase ?? "unidad"].presentacionBase;

    const presentacion = f.presentacion.trim() || nombreBase;
    const esBase = normalizarTexto(presentacion) === normalizarTexto(nombreBase);
    let factor = "1";
    if (f.factor.trim() === "") {
      if (!esBase) errores.push(`Falta el factor: ¿cuántas ${nombreBase.toLowerCase()}es trae «${presentacion}»?`);
    } else {
      const n = leerNumero(f.factor);
      if (!n || n.lte(0)) errores.push("El factor debe ser un número mayor que 0.");
      else {
        factor = n.toString();
        if (esBase && !n.eq(1)) errores.push(`La presentación «${presentacion}» es la unidad base: su factor debe ser 1.`);
      }
    }

    const numero = (texto: string, etiqueta: string) => {
      if (texto.trim() === "") return null;
      const n = leerNumero(texto);
      if (!n) {
        errores.push(`${etiqueta}: «${texto}» no es un número.`);
        return null;
      }
      if (n.isNegative()) {
        errores.push(`${etiqueta} no puede ser negativo.`);
        return null;
      }
      return n.toString();
    };
    let precioCompra = numero(f.precioCompra, "El precio de compra");
    const precioVenta = numero(f.precioVenta, "El precio de venta");
    const stock = numero(f.stockInicial, "El stock inicial");
    const stockMinimo = numero(f.stockMinimo, "El stock mínimo");
    if (precioCompra && !contexto.puedeVerCostos) {
      avisos.push("No tienes permiso de costos: el precio de compra no se guardará.");
      precioCompra = null;
    }
    if (!precioVenta) avisos.push("Sin precio de venta.");
    if (precioCompra && precioVenta && Number(precioVenta) < Number(precioCompra)) {
      avisos.push("El precio de venta es menor que el de compra (se vendería a pérdida).");
    }

    const iva = leerIva(f.iva);
    if (iva === "invalido") errores.push("IVA no válido. Usa 15%, 0% o exento.");

    // Categoría y subcategoría
    let categoria: string | null = f.categoria.trim() || null;
    const subcategoria: string | null = f.subcategoria.trim() || null;
    if (!categoria && subcategoria) {
      const sola = buscarCategoria(contexto.categorias, subcategoria);
      if (sola) categoria = contexto.categorias.find((c) => c.id === sola.padreId)?.nombre ?? null;
      else errores.push("Hay subcategoría pero falta la categoría.");
    }
    if (categoria) {
      const madre = buscarCategoria(contexto.categorias, categoria, null) ?? buscarCategoria(contexto.categorias, categoria);
      if (!madre) categoriasNuevas.add(categoria);
      if (subcategoria && (!madre || !buscarCategoria(contexto.categorias, subcategoria, madre.id))) {
        categoriasNuevas.add(`${categoria} → ${subcategoria}`);
      }
    } else if (coincidencia.tipo === "nuevo") {
      avisos.push("Sin categoría.");
    }

    if (f.caducidad.trim()) avisos.push("La fecha de caducidad se registrará por lotes desde la fase 4; por ahora se marca «maneja caducidad».");
    if (f.proveedor.trim()) avisos.push("El proveedor se podrá guardar desde la fase 4.");
    if (coincidencia.tipo === "nombre") avisos.push(`Parece ser «${coincidencia.nombre}», que ya existe: se actualizará.`);
    if (coincidencia.tipo === "parecido") avisos.push(`¿Es «${coincidencia.nombre}»? Si es el mismo, márcalo para actualizarlo en vez de crear uno nuevo.`);

    return {
      fila: f.fila,
      vacia,
      errores,
      avisos,
      coincidencia,
      datos: errores.length
        ? undefined
        : {
            nombre: nombre || (coincidencia.tipo !== "nuevo" ? coincidencia.nombre : ""),
            marca,
            plu: plu || null,
            codigo: codigo || null,
            unidadBase: unidadBase!,
            presentacion,
            factor,
            esBase,
            precioCompra,
            precioVenta,
            iva: iva === "invalido" ? null : iva,
            stock,
            stockMinimo,
            categoria,
            subcategoria,
            caducidad: Boolean(f.caducidad.trim()),
          },
    };
  });

  return { filas: revisadas, categoriasNuevas: Array.from(categoriasNuevas) };
}

/** Convierte el valor de una celda de Excel en texto (números, fechas, fórmulas, texto enriquecido). */
export function textoDeCelda(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  if (valor instanceof Date) {
    return `${String(valor.getUTCDate()).padStart(2, "0")}/${String(valor.getUTCMonth() + 1).padStart(2, "0")}/${valor.getUTCFullYear()}`;
  }
  if (typeof valor === "object") {
    const v = valor as { result?: unknown; richText?: { text: string }[]; text?: string; hyperlink?: string };
    if (v.richText) return v.richText.map((r) => r.text).join("");
    if ("result" in v) return textoDeCelda(v.result);
    if (v.text !== undefined) return String(v.text);
    return "";
  }
  return String(valor).trim();
}

/** Encuentra qué columna es cada dato según el título (tolerante a tildes y mayúsculas). */
export function mapearEncabezados(titulos: string[]): Partial<Record<ClaveColumna, number>> {
  const mapa: Partial<Record<ClaveColumna, number>> = {};
  titulos.forEach((t, i) => {
    const n = normalizarTexto(t);
    const col = COLUMNAS_PRODUCTOS.find((c) => normalizarTexto(c.titulo) === n);
    if (col) mapa[col.clave] = i;
  });
  return mapa;
}

// ------------------------------------------------------------------ armar lo que se guarda

/** Lo que hoy existe de un producto (para actualizarlo sin perder nada). */
export type ProductoActual = {
  id: string;
  nombre: string;
  marca: string;
  categoriaId: string | null;
  plu: string | null;
  sinonimos: string[];
  fotoRuta: string | null;
  unidadBase: UnidadBase;
  tarifaIva: TarifaIva;
  stockMinimo: string;
  manejaCaducidad: boolean;
  retornable: boolean;
  soloMayores: boolean;
  ubicacion: string;
  activo: boolean;
  presentaciones: {
    id: string;
    nombre: string;
    factor: string;
    precioVenta: string | null;
    paraVenta: boolean;
    paraCompra: boolean;
    esBase: boolean;
    codigos: string[];
  }[];
};

export type OpcionesArmado = {
  /** Filas «parecido» que la persona confirmó que son el mismo producto. */
  unirParecidos: Set<number>;
  actuales: Map<string, ProductoActual>;
  /** Id de la categoría (ya creada si era nueva) para categoría + subcategoría. */
  categoriaId: (categoria: string | null, subcategoria: string | null) => string | null;
  /** IVA por defecto de una categoría. */
  ivaDeCategoria: (categoriaId: string | null) => TarifaIva;
};

type PresentacionPayload = {
  id?: string;
  nombre: string;
  factor: string;
  precio_venta: string | null;
  para_venta: boolean;
  para_compra: boolean;
  es_base: boolean;
  orden: number;
  codigos: string[];
};

/**
 * Agrupa las filas por producto (una fila = una presentación) y arma lo que
 * recibe la función guardar_producto. El stock se convierte a unidad base.
 */
export function armarImportacion(revisadas: FilaRevisada[], opciones: OpcionesArmado) {
  const grupos = new Map<string, FilaRevisada[]>();
  for (const f of revisadas) {
    if (f.vacia || !f.datos || f.errores.length) continue;
    const c = f.coincidencia;
    const existente =
      c.tipo === "codigo" || c.tipo === "plu" || c.tipo === "nombre" || (c.tipo === "parecido" && opciones.unirParecidos.has(f.fila))
        ? c.productoId
        : null;
    const clave = existente ? `id:${existente}` : `nuevo:${normalizarTexto(f.datos.nombre)}|${normalizarTexto(f.datos.marca)}`;
    grupos.set(clave, [...(grupos.get(clave) ?? []), f]);
  }

  const productos: Record<string, unknown>[] = [];
  let nuevos = 0;
  let actualizados = 0;

  for (const [clave, filas] of grupos) {
    const actual = clave.startsWith("id:") ? opciones.actuales.get(clave.slice(3)) : undefined;
    const primero = filas[0].datos!;
    const unidadBase = actual?.unidadBase ?? primero.unidadBase;
    const nombreBase = UNIDADES[unidadBase].presentacionBase;

    const presentaciones: PresentacionPayload[] = (actual?.presentaciones ?? []).map((p, i) => ({
      id: p.id,
      nombre: p.nombre,
      factor: p.factor,
      precio_venta: p.precioVenta,
      para_venta: p.paraVenta,
      para_compra: p.paraCompra,
      es_base: p.esBase,
      orden: i,
      codigos: [...p.codigos],
    }));

    let costoUnitario: string | null = null;
    let stockTotal = dec(0);
    let categoriaId = actual?.categoriaId ?? null;
    let iva: TarifaIva | null = null;
    let plu = actual?.plu ?? null;
    let stockMinimo = actual?.stockMinimo ?? "0";
    let caducidad = actual?.manejaCaducidad ?? false;

    for (const f of filas) {
      const d = f.datos!;
      const esBase = d.esBase || normalizarTexto(d.presentacion) === normalizarTexto(nombreBase);
      let p = presentaciones.find((x) => (esBase ? x.es_base : normalizarTexto(x.nombre) === normalizarTexto(d.presentacion)));
      if (!p) {
        p = {
          nombre: esBase ? nombreBase : d.presentacion,
          factor: esBase ? "1" : d.factor,
          precio_venta: null,
          para_venta: true,
          para_compra: true,
          es_base: esBase,
          orden: presentaciones.length,
          codigos: [],
        };
        presentaciones.push(p);
      }
      if (d.precioVenta !== null) p.precio_venta = d.precioVenta;
      if (d.codigo && !p.codigos.includes(d.codigo)) {
        // Si el código estaba en otra presentación de este producto, se mueve aquí.
        for (const otra of presentaciones) otra.codigos = otra.codigos.filter((c) => c !== d.codigo);
        p.codigos.push(d.codigo);
      }
      if (costoUnitario === null && d.precioCompra !== null) {
        costoUnitario = dec(d.precioCompra).dividedBy(p.factor).toDecimalPlaces(4).toString();
      }
      if (d.stock !== null) stockTotal = stockTotal.plus(dec(d.stock).times(p.factor));
      if (d.categoria) categoriaId = opciones.categoriaId(d.categoria, d.subcategoria) ?? categoriaId;
      if (d.iva) iva = d.iva;
      if (d.plu) plu = d.plu;
      if (d.stockMinimo !== null) stockMinimo = d.stockMinimo;
      if (d.caducidad) caducidad = true;
    }

    if (!presentaciones.some((p) => p.es_base)) {
      presentaciones.unshift({
        nombre: nombreBase, factor: "1", precio_venta: null, para_venta: true, para_compra: true, es_base: true, orden: -1, codigos: [],
      });
    }

    if (actual) actualizados++;
    else nuevos++;

    productos.push({
      ...(actual ? { id: actual.id } : {}),
      nombre: actual?.nombre ?? primero.nombre,
      marca: actual?.marca || primero.marca,
      categoria_id: categoriaId,
      plu,
      sinonimos: actual?.sinonimos ?? [],
      foto_ruta: actual?.fotoRuta ?? null,
      unidad_base: unidadBase,
      tarifa_iva: iva ?? actual?.tarifaIva ?? opciones.ivaDeCategoria(categoriaId),
      stock_minimo: stockMinimo,
      maneja_caducidad: caducidad,
      retornable: actual?.retornable ?? false,
      solo_mayores: actual?.soloMayores ?? false,
      ubicacion: actual?.ubicacion ?? "",
      activo: actual?.activo ?? true,
      presentaciones: presentaciones.map((p, i) => ({ ...p, orden: i })),
      costo_unitario: costoUnitario,
      stock_inicial: stockTotal.gt(0) ? stockTotal.toDecimalPlaces(3).toString() : null,
    });
  }
  return { productos, nuevos, actualizados };
}
