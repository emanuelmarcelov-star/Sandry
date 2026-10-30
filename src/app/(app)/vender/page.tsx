import { Suspense } from "react";
import { textos } from "@/lib/textos";
import { puede, requerirPermiso } from "@/server/sesion";
import { listarCategorias } from "@/server/catalogo";
import { ajustesVenta, cajaAbierta, clientesConSaldo, favoritos, formasDePago, productosParaVenta } from "@/server/ventas";
import { PantallaVenta } from "./pantalla-venta";

export default function Vender() {
  return (
    <Suspense fallback={<p className="text-lg">{textos.general.cargando}</p>}>
      <Contenido />
    </Suspense>
  );
}

async function Contenido() {
  const yo = await requerirPermiso("ventas.vender");
  const [productos, categorias, favs, formas, clientes, ajustes, abierta] = await Promise.all([
    productosParaVenta(yo),
    listarCategorias(),
    favoritos(),
    formasDePago(),
    clientesConSaldo(),
    ajustesVenta(),
    cajaAbierta(),
  ]);
  return (
    <PantallaVenta
      productos={productos}
      categorias={categorias.filter((c) => c.activa && !c.padreId).map((c) => ({ id: c.id, nombre: c.nombre }))}
      favoritos={favs}
      formas={formas}
      clientes={clientes}
      ajustes={ajustes}
      cajaAbierta={abierta}
      puedeAbrirCaja={puede(yo, "caja.abrir_cerrar")}
      puedeCrearProducto={puede(yo, "productos.editar")}
    />
  );
}
