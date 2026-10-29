import { Suspense } from "react";
import { textos, textosCompras } from "@/lib/textos";
import { puede, requerirPermiso } from "@/server/sesion";
import { categoriasGasto, listaSugerida, listarCuentas, listarProveedores, productosParaCompra, viajeEnCurso } from "@/server/abastecimiento";
import { PantallaViaje, type EstadoViaje } from "./pantalla-viaje";

export default function PaginaViaje() {
  return (
    <div className="grid gap-5">
      <h1 className="text-3xl font-bold">{textosCompras.viaje.titulo}</h1>
      <Suspense fallback={<p className="text-lg">{textos.general.cargando}</p>}>
        <Contenido />
      </Suspense>
    </div>
  );
}

async function Contenido() {
  const yo = await requerirPermiso("compras.registrar");
  const [productos, proveedores, cuentas, categorias, sugerida, enCurso] = await Promise.all([
    productosParaCompra(yo),
    listarProveedores(true),
    listarCuentas(),
    categoriasGasto(),
    listaSugerida(),
    viajeEnCurso(),
  ]);
  const estado: EstadoViaje | null = enCurso && {
    id: enCurso.id,
    inicio: enCurso.inicio,
    lista: enCurso.lista,
    compras: enCurso.compras.map((c) => ({ id: c.id, lugar: c.lugar || textosCompras.lista.sinLugar, total: c.total })),
    gastos: enCurso.gastos.map((g) => ({ id: g.id, categoria: g.categoria, monto: g.monto })),
  };
  return (
    <PantallaViaje
      datos={{ productos, proveedores: proveedores.map((p) => ({ id: p.id, nombre: p.nombre })), cuentas, categorias }}
      enCurso={estado}
      sugerida={sugerida.map((s) => ({ productoId: s.productoId, nombre: s.nombre, unidadBase: s.unidadBase, cantidad: s.sugerido, tachado: false }))}
      puedeCrearProducto={puede(yo, "productos.editar")}
      puedeCrearLugar={puede(yo, "proveedores.gestionar")}
    />
  );
}
