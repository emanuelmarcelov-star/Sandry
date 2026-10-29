/**
 * Importación de productos desde Excel: revisa cada fila y explica los
 * problemas en español. Se usa en el navegador (vista previa editable) y en el
 * servidor (que vuelve a revisar todo antes de guardar).
 *
 * Dos hojas:
 *  - «Productos»: el catálogo. «Cuántos tengo» es el stock real (o inicial si es nuevo).
 *  - «Compras»: lo que entró. «Cuántos entraron» se SUMA al stock. Si el
 *    producto no existe, se crea.
 *  - «Salidas»: lo que salió sin venderse (se dañó, caducó…). «Cuántos salieron» se RESTA.
 */
import { dec, leerNumero } from "@/lib/dinero";
import { UNIDADES, type TarifaIva, type UnidadBase } from "@/lib/catalogo";

/**
 * Columnas de la hoja «Productos», en orden: primero lo más sencillo
 * (categoría, producto, costo, precio, stock) y al final lo opcional.
 * `otros` son títulos de plantillas anteriores que se siguen aceptando.
 */
export const COLUMNAS_PRODUCTOS = [
  { clave: "categoria", titulo: "Categoría", ancho: 24, otros: [] },
  { clave: "nombre", titulo: "Producto", ancho: 32, otros: ["Nombre"] },
  { clave: "precioCompra", titulo: "Costo", ancho: 11, otros: ["Precio de compra"] },
  { clave: "precioVenta", titulo: "Precio de venta", ancho: 14, otros: [] },
  { clave: "stockInicial", titulo: "Cuántos tengo", ancho: 13, otros: ["Stock inicial"] },
  { clave: "stockMinimo", titulo: "Avisar si quedan menos de", ancho: 15, otros: ["Stock mínimo"] },
  { clave: "marca", titulo: "Marca", ancho: 16, otros: [] },
  { clave: "presentacion", titulo: "Presentación", ancho: 16, otros: [] },
  { clave: "factor", titulo: "Factor", ancho: 9, otros: [] },
  { clave: "unidadBase", titulo: "Se cuenta por", ancho: 12, otros: ["Unidad base"] },
  { clave: "plu", titulo: "Código corto", ancho: 12, otros: ["Código interno"] },
  { clave: "codigoBarras", titulo: "Código de barras", ancho: 18, otros: [] },
  { clave: "caducidad", titulo: "Fecha de caducidad", ancho: 16, otros: [] },
  { clave: "proveedor", titulo: "Proveedor", ancho: 20, otros: [] },
] as const;

/** Columnas de la hoja «Compras»: solo hace falta llenar «Cuántos entraron». */
export const COLUMNAS_COMPRAS = [
  { clave: "categoria", titulo: "Categoría", ancho: 24, otros: [] },
  { clave: "nombre", titulo: "Producto", ancho: 32, otros: ["Código o nombre del producto"] },
  { clave: "presentacion", titulo: "Presentación", ancho: 16, otros: [] },
  { clave: "precioCompra", titulo: "Costo", ancho: 11, otros: [] },
  { clave: "precioVenta", titulo: "Precio de venta", ancho: 14, otros: [] },
  { clave: "stockInicial", titulo: "Cuántos entraron", ancho: 15, otros: ["Cantidad"] },
  { clave: "factor", titulo: "Factor", ancho: 9, otros: [] },
] as const;

/** Motivos de la hoja «Salidas» (lo que sale sin venderse). */
export const MOTIVOS_SALIDA = {
  merma: "Se dañó",
  caducado: "Se caducó",
  autoconsumo: "Consumo de la casa",
  regalo: "Regalo",
  robo: "Robo o pérdida",
} as const;
export type MotivoSalida = keyof typeof MOTIVOS_SALIDA;

/** Columnas de la hoja «Salidas»: solo hace falta «Cuántos salieron» y el motivo. */
export const COLUMNAS_SALIDAS = [
  { clave: "categoria", titulo: "Categoría", ancho: 24, otros: [] },
  { clave: "nombre", titulo: "Producto", ancho: 32, otros: [] },
  { clave: "presentacion", titulo: "Presentación", ancho: 16, otros: [] },
  { clave: "stockInicial", titulo: "Cuántos salieron", ancho: 15, otros: ["Cantidad"] },
  { clave: "motivo", titulo: "Motivo", ancho: 20, otros: [] },
  { clave: "nota", titulo: "Nota", ancho: 30, otros: [] },
] as const;

/** Lee el motivo escrito en Excel (el texto de la lista, la clave o algo parecido). Vacío = se dañó. */
export function leerMotivo(texto: string): MotivoSalida | null {
  const n = normalizarTexto(texto);
  if (!n) return "merma";
  for (const [clave, titulo] of Object.entries(MOTIVOS_SALIDA)) {
    if (n === clave || n === normalizarTexto(titulo)) return clave as MotivoSalida;
  }
  if (/dan|romp|perd/.test(n)) return "merma";
  if (/caduc|venc/.test(n)) return "caducado";
  if (/casa|consum/.test(n)) return "autoconsumo";
  if (/regal/.test(n)) return "regalo";
  if (/rob/.test(n)) return "robo";
  return null;
}

type Columna = { clave: string; titulo: string; otros: readonly string[] };

/** Letra de Excel de una columna (A, B, C...) según su clave. */
export function letraDeColumna(clave: string, columnas: readonly Columna[] = COLUMNAS_PRODUCTOS): string {
  return String.fromCharCode(65 + columnas.findIndex((c) => c.clave === clave));
}

export type ClaveColumna = (typeof COLUMNAS_PRODUCTOS)[number]["clave"];
export type FilaProducto = {
  fila: number;
  deCompras?: boolean;
  deSalidas?: boolean;
  /** Solo hoja «Salidas». */
  motivo?: string;
  nota?: string;
} & Record<ClaveColumna, string>;

/** Número de fila interno para las hojas «Compras» y «Salidas» (no chocan con las de «Productos»). */
export const DESPLAZAMIENTO_COMPRAS = 100_000;
export const DESPLAZAMIENTO_SALIDAS = 200_000;
export function nombreDeFila(fila: number): string {
  if (fila >= DESPLAZAMIENTO_SALIDAS) return `Salidas ${fila - DESPLAZAMIENTO_SALIDAS}`;
  return fila >= DESPLAZAMIENTO_COMPRAS ? `Compras ${fila - DESPLAZAMIENTO_COMPRAS}` : `Productos ${fila}`;
}

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
  deCompras: boolean;
  deSalidas: boolean;
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
    stock: string | null;
    stockMinimo: string | null;
    categoria: string | null;
    caducidad: boolean;
    /** Solo hoja «Salidas». */
    salida?: { tipo: MotivoSalida; nota: string };
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

export function normalizarPlu(texto: string): string {
  return texto.trim().replace(/^0+(?=\d)/, "");
}

// ------------------------------------------------------------------ revisión

/** Busca una categoría principal por nombre (sin tildes ni mayúsculas). */
export function buscarCategoria(categorias: CategoriaContexto[], nombre: string): CategoriaContexto | undefined {
  const n = normalizarTexto(nombre);
  return categorias.find((c) => normalizarTexto(c.nombre) === n && !c.padreId) ?? categorias.find((c) => normalizarTexto(c.nombre) === n);
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
    const deCompras = Boolean(f.deCompras);
    const deSalidas = Boolean(f.deSalidas);
    const errores: string[] = [];
    const avisos: string[] = [];
    const vacia = Object.entries(f).every(
      ([k, v]) => k === "fila" || k === "deCompras" || k === "deSalidas" || String(v ?? "").trim() === "",
    );
    if (vacia) return { fila: f.fila, deCompras, deSalidas, vacia, errores, avisos, coincidencia: { tipo: "nuevo" } };

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
    const existe = coincidencia.tipo === "codigo" || coincidencia.tipo === "plu" || coincidencia.tipo === "nombre";

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
      // En «Compras» y «Salidas», una presentación que ya existe en el producto no necesita factor.
      if (!esBase && !((deCompras || deSalidas) && existe)) {
        errores.push(`Falta el factor: ¿cuántas ${nombreBase.toLowerCase()}es trae «${presentacion}»?`);
      }
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
    let precioCompra = numero(f.precioCompra, "El costo");
    const precioVenta = numero(f.precioVenta, "El precio de venta");
    const stock = numero(f.stockInicial, deSalidas ? "Cuántos salieron" : deCompras ? "Cuántos entraron" : "El stock inicial");
    let salida: { tipo: MotivoSalida; nota: string } | undefined;
    if (deSalidas) {
      const tipo = leerMotivo(f.motivo ?? "");
      if (!existe) errores.push("Ese producto no está en Sandry: en «Salidas» solo van productos que ya tienes.");
      if (!tipo) errores.push(`Motivo no válido. Usa: ${Object.values(MOTIVOS_SALIDA).join(", ")}.`);
      if (stock !== null && dec(stock).isZero()) errores.push("Cuántos salieron debe ser mayor que 0.");
      if (tipo && stock) {
        salida = { tipo, nota: (f.nota ?? "").trim() };
        avisos.push(`Se restarán ${stock} (${MOTIVOS_SALIDA[tipo]}).`);
      }
    }
    const stockMinimo = numero(f.stockMinimo, "El stock mínimo");
    if (precioCompra && !contexto.puedeVerCostos) {
      avisos.push("No tienes permiso de costos: el costo no se guardará.");
      precioCompra = null;
    }
    if (!precioVenta && !existe && !deSalidas) avisos.push("Sin precio de venta.");
    if (precioCompra && precioVenta && dec(precioVenta).lt(precioCompra)) {
      avisos.push("El precio de venta es menor que el costo: se vendería a pérdida.");
    }

    const categoria: string | null = f.categoria.trim() || null;
    if (categoria) {
      if (!buscarCategoria(contexto.categorias, categoria)) categoriasNuevas.add(categoria);
    } else if (!existe && !deSalidas) {
      avisos.push("Sin categoría.");
    }

    if (f.caducidad.trim()) avisos.push("La fecha de caducidad se registrará por lotes desde la fase 4; por ahora se marca «maneja caducidad».");
    if (f.proveedor.trim()) avisos.push("El proveedor se podrá guardar desde la fase 4.");
    if (coincidencia.tipo === "nombre" && !deCompras && !deSalidas) avisos.push(`Parece ser «${coincidencia.nombre}», que ya existe: se actualizará.`);
    if (coincidencia.tipo === "parecido") avisos.push(`¿Es «${coincidencia.nombre}»? Si es el mismo, márcalo para actualizarlo en vez de crear uno nuevo.`);

    return {
      fila: f.fila,
      deCompras,
      deSalidas,
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
            stock,
            stockMinimo,
            categoria,
            caducidad: Boolean(f.caducidad.trim()),
            ...(salida ? { salida } : {}),
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
export function mapearEncabezados(
  titulos: string[],
  columnas: readonly Columna[] = COLUMNAS_PRODUCTOS,
): Partial<Record<string, number>> {
  const mapa: Partial<Record<string, number>> = {};
  titulos.forEach((t, i) => {
    const n = normalizarTexto(t);
    // Se acepta el título actual y los de plantillas anteriores.
    const col = columnas.find((c) => normalizarTexto(c.titulo) === n || c.otros.some((o) => normalizarTexto(o) === n));
    if (col && mapa[col.clave] === undefined) mapa[col.clave] = i;
  });
  return mapa;
}

/** Una fila vacía con todas las columnas (para armar filas de «Compras»). */
export function filaVacia(fila: number): FilaProducto {
  return { fila, ...Object.fromEntries(COLUMNAS_PRODUCTOS.map((c) => [c.clave, ""])) } as FilaProducto;
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
  /** Id de la categoría (ya creada si era nueva). */
  categoriaId: (categoria: string | null) => string | null;
  /** IVA por defecto de una categoría (oculto; solo por si algún día se factura). */
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
 * recibe la función importar_productos. El stock se convierte a unidad base.
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
    let stockTotal = dec(0); // hoja «Productos»: cuántos hay
    let dijoStock = false;
    let comprado = dec(0); // hoja «Compras»: cuántos entraron (unidad base)
    const salidas: { tipo: MotivoSalida; cantidad: string; nota: string }[] = []; // hoja «Salidas»
    let valorComprado = dec(0); // para el costo promedio de lo que entró
    let compradoConCosto = dec(0);
    let costoCompraNuevo: string | null = null;
    let categoriaId = actual?.categoriaId ?? null;
    let plu = actual?.plu ?? null;
    let stockMinimo = actual?.stockMinimo ?? "0";
    let caducidad = actual?.manejaCaducidad ?? false;

    for (const f of filas) {
      const d = f.datos!;
      const esBase = d.esBase || normalizarTexto(d.presentacion) === normalizarTexto(nombreBase);
      let p = presentaciones.find((x) => (esBase ? x.es_base : normalizarTexto(x.nombre) === normalizarTexto(d.presentacion)));
      if (f.deSalidas) {
        // Lo que salió se RESTA (en unidad base). No cambia nada más del producto.
        if (d.salida && d.stock !== null) {
          const cantidad = dec(d.stock).times(p?.factor ?? d.factor).toDecimalPlaces(3).toString();
          salidas.push({ tipo: d.salida.tipo, cantidad, nota: d.salida.nota });
        }
        continue;
      }
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
      // Costo por unidad base: costo de la presentación ÷ factor (jaba $9 ÷ 12 = $0.75).
      const costoBase = d.precioCompra !== null ? dec(d.precioCompra).dividedBy(p.factor).toDecimalPlaces(4) : null;

      if (f.deCompras) {
        // Lo que entró se SUMA; su costo entra al promedio (no lo reemplaza).
        if (d.stock !== null && dec(d.stock).gt(0)) {
          const cantidad = dec(d.stock).times(p.factor);
          comprado = comprado.plus(cantidad);
          if (costoBase) {
            valorComprado = valorComprado.plus(cantidad.times(costoBase));
            compradoConCosto = compradoConCosto.plus(cantidad);
          }
        }
        if (costoCompraNuevo === null && costoBase) costoCompraNuevo = costoBase.toString();
      } else {
        if (costoUnitario === null && costoBase) costoUnitario = costoBase.toString();
        if (d.stock !== null) {
          stockTotal = stockTotal.plus(dec(d.stock).times(p.factor));
          dijoStock = true;
        }
        if (d.stockMinimo !== null) stockMinimo = d.stockMinimo;
      }
      if (d.categoria) categoriaId = opciones.categoriaId(d.categoria) ?? categoriaId;
      if (d.plu) plu = d.plu;
      if (d.caducidad) caducidad = true;
    }

    if (!presentaciones.some((p) => p.es_base)) {
      presentaciones.unshift({
        nombre: nombreBase, factor: "1", precio_venta: null, para_venta: true, para_compra: true, es_base: true, orden: -1, codigos: [],
      });
    }

    if (actual) actualizados++;
    else nuevos++;

    const texto = (n: ReturnType<typeof dec>) => n.toDecimalPlaces(3).toString();
    const costoSumar = compradoConCosto.gt(0) ? valorComprado.dividedBy(compradoConCosto).toDecimalPlaces(4).toString() : null;

    productos.push({
      ...(actual ? { id: actual.id } : {}),
      nombre: actual?.nombre ?? primero.nombre,
      marca: actual?.marca || primero.marca,
      categoria_id: categoriaId,
      plu,
      sinonimos: actual?.sinonimos ?? [],
      foto_ruta: actual?.fotoRuta ?? null,
      unidad_base: unidadBase,
      tarifa_iva: actual?.tarifaIva ?? opciones.ivaDeCategoria(categoriaId),
      stock_minimo: stockMinimo,
      maneja_caducidad: caducidad,
      retornable: actual?.retornable ?? false,
      solo_mayores: actual?.soloMayores ?? false,
      ubicacion: actual?.ubicacion ?? "",
      activo: actual?.activo ?? true,
      presentaciones: presentaciones.map((p, i) => ({ ...p, orden: i })),
      ...(actual
        ? {
            costo_unitario: costoUnitario,
            // «Cuántos tengo» = stock REAL (si cambió se corrige como conteo).
            stock_real: dijoStock ? texto(stockTotal) : null,
            // «Cuántos entraron» se suma, con su costo.
            stock_sumar: comprado.gt(0) ? texto(comprado) : null,
            costo_sumar: costoSumar,
            // «Cuántos salieron» se resta (se dañó, caducó…).
            ...(salidas.length ? { salidas } : {}),
          }
        : {
            // Nuevo: empieza con lo que dice «Productos» + lo que entró en «Compras».
            costo_unitario: costoUnitario ?? costoSumar ?? costoCompraNuevo,
            stock_inicial: stockTotal.plus(comprado).gt(0) ? texto(stockTotal.plus(comprado)) : null,
          }),
    });
  }
  return { productos, nuevos, actualizados };
}

// ------------------------------------------------------------------ exportar

/** Lo mínimo de un producto para sacarlo a Excel. */
export type ProductoParaExportar = {
  nombre: string;
  marca: string;
  categoriaId: string | null;
  plu: string | null;
  unidadBase: UnidadBase;
  stockMinimo: string;
  stock: string;
  costo: string | null; // por unidad base; null si no hay permiso
  presentaciones: { nombre: string; factor: string; precioVenta: string | null; esBase: boolean; paraCompra: boolean; codigos: string[] }[];
};

type FilaExportada = Partial<Record<string, string | number>>;
const numeroExcel = (v: string | null | undefined) => (v === null || v === undefined || v === "" ? "" : Number(v));

function nombreCategoria(categorias: CategoriaContexto[], id: string | null): string {
  const porId = new Map(categorias.map((c) => [c.id, c]));
  let c = id ? porId.get(id) : undefined;
  while (c?.padreId) c = porId.get(c.padreId);
  return c?.nombre ?? "";
}

function costoDe(p: ProductoParaExportar, factor: string): string | null {
  return p.costo !== null && Number(p.costo) > 0 ? dec(p.costo).times(factor).toDecimalPlaces(4).toString() : null;
}

/**
 * Filas de la hoja «Productos» para «Descargar mis productos»: una fila por
 * presentación. El stock va solo en la fila de la unidad base (en unidades
 * base) para que al volver a importar no se cuente dos veces.
 */
export function filasParaExportar(productos: ProductoParaExportar[], categorias: CategoriaContexto[]): FilaExportada[] {
  return productos.flatMap((p) => {
    const comunes = {
      categoria: nombreCategoria(categorias, p.categoriaId),
      nombre: p.nombre,
      marca: p.marca,
      plu: p.plu ?? "",
      unidadBase: p.unidadBase === "unidad" ? "" : p.unidadBase,
    };
    const nombreBase = UNIDADES[p.unidadBase].presentacionBase;
    return p.presentaciones.map((x) => ({
      ...comunes,
      presentacion: x.esBase && normalizarTexto(x.nombre) === normalizarTexto(nombreBase) ? "" : x.nombre,
      factor: x.esBase ? "" : numeroExcel(x.factor),
      precioCompra: numeroExcel(costoDe(p, x.factor)),
      precioVenta: numeroExcel(x.precioVenta),
      stockInicial: x.esBase ? numeroExcel(p.stock) : "",
      stockMinimo: x.esBase && Number(p.stockMinimo) > 0 ? numeroExcel(p.stockMinimo) : "",
      codigoBarras: x.codigos[0] ?? "",
    }));
  });
}

/**
 * Filas de la hoja «Compras»: cada producto en cada forma en que se compra
 * (unidad, jaba…), con su costo y precio. Solo falta escribir «Cuántos entraron».
 */
export function filasDeCompras(productos: ProductoParaExportar[], categorias: CategoriaContexto[]): FilaExportada[] {
  return productos.flatMap((p) =>
    p.presentaciones
      .filter((x) => x.esBase || x.paraCompra)
      .map((x) => ({
        categoria: nombreCategoria(categorias, p.categoriaId),
        nombre: p.nombre,
        presentacion: x.nombre,
        precioCompra: numeroExcel(costoDe(p, x.factor)),
        precioVenta: numeroExcel(x.precioVenta),
        stockInicial: "",
        factor: x.esBase ? "" : numeroExcel(x.factor),
      })),
  );
}

/**
 * Filas de la hoja «Salidas»: cada producto en su unidad base, listo para
 * escribir cuántos salieron y por qué.
 */
export function filasDeSalidas(productos: ProductoParaExportar[], categorias: CategoriaContexto[]): FilaExportada[] {
  return productos.map((p) => ({
    categoria: nombreCategoria(categorias, p.categoriaId),
    nombre: p.nombre,
    presentacion: p.presentaciones.find((x) => x.esBase)?.nombre ?? UNIDADES[p.unidadBase].presentacionBase,
    stockInicial: "",
    motivo: "",
    nota: "",
  }));
}
