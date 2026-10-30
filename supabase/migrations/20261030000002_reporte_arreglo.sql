-- Corrige el reporte: la conciliación agrupaba mal (error 42803) y, con filtro
-- de categoría, las ventas ahora son solo las de esa categoría.
create or replace function public.reporte(p_desde date, p_hasta date, p_usuario uuid default null, p_categoria uuid default null)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_inicio timestamptz := (p_desde::timestamp at time zone 'America/Guayaquil');
  v_fin timestamptz := ((p_hasta + 1)::timestamp at time zone 'America/Guayaquil');
  v jsonb;
begin
  perform public.exigir_permiso('reportes.ver');
  if p_hasta < p_desde then raise exception 'La fecha final es antes de la inicial.'; end if;

  with ventas as (
    select * from public.ventas
    where estado = 'normal' and fecha >= v_inicio and fecha < v_fin and (p_usuario is null or usuario_id = p_usuario)
  ),
  lineas as (
    select l.*, v.fecha, v.usuario_id, p.categoria_id, p.nombre as producto,
           (l.cantidad - l.devuelto) / l.cantidad as parte,
           coalesce(c.costo_total, 0) * (l.cantidad - l.devuelto) / l.cantidad as costo
    from public.venta_lineas l
    join ventas v on v.id = l.venta_id
    left join public.productos p on p.id = l.producto_id
    left join public.venta_linea_costos c on c.linea_id = l.id
    where p_categoria is null or p.categoria_id = p_categoria
  ),
  devoluciones as (
    select coalesce(sum(d.monto), 0) as monto from public.devoluciones d join ventas v on v.id = d.venta_id
  ),
  gastos as (
    select g.*, c.nombre as categoria, c.grupo, c.es_vehiculo, c.es_transporte
    from public.gastos g join public.categorias_gasto c on c.id = g.categoria_id
    where not g.anulado and g.fecha >= v_inicio and g.fecha < v_fin
  ),
  perdidas as (
    select m.tipo, sum(-m.cantidad * coalesce(pc.costo_promedio, 0)) as valor
    from public.movimientos_stock m left join public.producto_costos pc on pc.producto_id = m.producto_id
    where m.fecha >= v_inicio and m.fecha < v_fin and m.cantidad < 0
      and m.tipo in ('merma', 'caducado', 'robo', 'autoconsumo', 'regalo', 'conteo')
    group by m.tipo
  ),
  totales as (
    select (select count(*) from ventas) as n,
           case when p_categoria is null then (select coalesce(sum(total), 0) from ventas) - (select monto from devoluciones)
                else (select coalesce(round(sum(total * parte), 2), 0) from lineas) end as ventas,
           (select coalesce(sum(costo), 0) from lineas) as costo,
           (select coalesce(sum(monto), 0) from gastos where not personal) as gastos,
           (select coalesce(sum(valor), 0) from perdidas) as perdidas
  )
  select jsonb_build_object(
    'ventas', t.ventas, 'cantidad_ventas', t.n, 'costo', round(t.costo, 2),
    'ganancia_bruta', round(t.ventas - t.costo, 2),
    'margen', case when t.costo > 0 then round((t.ventas - t.costo) / t.costo * 100, 1) end,
    'ticket_promedio', case when t.n > 0 then round(t.ventas / t.n, 2) end,
    'gastos', round(t.gastos, 2), 'perdidas', round(t.perdidas, 2),
    'ganancia_neta', round(t.ventas - t.costo - t.gastos - t.perdidas, 2),
    'gastos_por_grupo', coalesce((select jsonb_object_agg(grupo, total) from (
        select grupo, round(sum(monto), 2) as total from gastos where not personal group by grupo) x), '{}'),
    'gastos_personales', (select coalesce(round(sum(monto), 2), 0) from gastos where personal),
    'perdidas_por_tipo', coalesce((select jsonb_object_agg(tipo, round(valor, 2)) from perdidas), '{}'),
    'por_forma', coalesce((select jsonb_object_agg(forma_pago_id, total) from (
        select vp.forma_pago_id, round(sum(vp.monto), 2) as total from public.venta_pagos vp join ventas v on v.id = vp.venta_id
        group by vp.forma_pago_id) x), '{}'),
    'por_dia', coalesce((select jsonb_agg(x order by x.dia) from (
        select (fecha at time zone 'America/Guayaquil')::date as dia, round(sum(total * parte), 2) as ventas,
               round(sum(total * parte - costo), 2) as ganancia
        from lineas group by 1) x), '[]'),
    'por_hora', coalesce((select jsonb_agg(x order by x.hora) from (
        select extract(hour from fecha at time zone 'America/Guayaquil')::int as hora, count(*) as ventas, round(sum(total), 2) as total
        from ventas group by 1) x), '[]'),
    'por_dia_semana', coalesce((select jsonb_agg(x order by x.dia) from (
        select extract(isodow from fecha at time zone 'America/Guayaquil')::int as dia, count(*) as ventas, round(sum(total), 2) as total
        from ventas group by 1) x), '[]'),
    'por_categoria', coalesce((select jsonb_agg(x order by x.ventas desc) from (
        select coalesce(c.nombre, 'Sin categoría') as categoria, round(sum(l.total * l.parte), 2) as ventas,
               round(sum(l.total * l.parte - l.costo), 2) as ganancia
        from lineas l left join public.categorias c on c.id = l.categoria_id
        where l.producto_id is not null group by 1) x), '[]'),
    'por_trabajadora', coalesce((select jsonb_agg(x order by x.total desc) from (
        select coalesce(pf.nombre_completo, '—') as nombre, count(*) as ventas, round(sum(v.total), 2) as total
        from ventas v left join public.perfiles pf on pf.id = v.usuario_id group by 1) x), '[]'),
    'productos', coalesce((select jsonb_agg(x) from (
        select producto_id, producto, round(sum((cantidad - devuelto) * factor), 3) as cantidad,
               round(sum(total * parte), 2) as ventas, round(sum(total * parte - costo), 2) as ganancia
        from lineas where producto_id is not null group by producto_id, producto) x), '[]'),
    'varios', (select coalesce(round(sum(total * parte), 2), 0) from lineas where producto_id is null),
    'flujo', coalesce((select jsonb_agg(x order by x.motivo) from (
        select motivo, round(sum(monto) filter (where monto > 0), 2) as entra, round(-sum(monto) filter (where monto < 0), 2) as sale
        from public.movimientos_dinero
        where fecha >= v_inicio and fecha < v_fin and motivo not in ('transferencia', 'correccion', 'saldo_inicial')
        group by motivo) x), '[]'),
    'flujo_por_cuenta', coalesce((select jsonb_agg(x order by x.orden) from (
        select c.nombre as cuenta, c.orden, round(coalesce(sum(m.monto) filter (where m.monto > 0), 0), 2) as entra,
               round(coalesce(-sum(m.monto) filter (where m.monto < 0), 0), 2) as sale,
               round(public.saldo_cuenta(c.id), 2) as saldo
        from public.cuentas_dinero c left join public.movimientos_dinero m on m.cuenta_id = c.id and m.fecha >= v_inicio and m.fecha < v_fin
        group by c.id) x), '[]'),
    'compras_por_lugar', coalesce((select jsonb_agg(x order by x.total desc) from (
        select coalesce(pr.nombre, 'Sin lugar') as lugar, count(*) as compras, round(sum(cm.total), 2) as total
        from public.compras cm left join public.proveedores pr on pr.id = cm.proveedor_id
        where cm.estado <> 'anulada' and cm.fecha >= v_inicio and cm.fecha < v_fin group by 1) x), '[]'),
    'compras', (select coalesce(round(sum(total), 2), 0) from public.compras where estado <> 'anulada' and fecha >= v_inicio and fecha < v_fin),
    'gastos_transporte', (select coalesce(round(sum(monto), 2), 0) from gastos where not personal and grupo = 'Transporte y vehículo'),
    'inventario', (select jsonb_build_object(
        'costo', round(coalesce(sum(greatest(e.cantidad, 0) * coalesce(pc.costo_promedio, 0)), 0), 2),
        'venta', round(coalesce(sum(greatest(e.cantidad, 0) * coalesce(pb.precio_venta, 0)), 0), 2))
      from public.existencias e
      join public.productos p on p.id = e.producto_id and p.activo
      left join public.producto_costos pc on pc.producto_id = e.producto_id
      left join public.presentaciones pb on pb.producto_id = e.producto_id and pb.es_base and pb.activa),
    'fiados', (select coalesce(round(sum(greatest(public.saldo_fiado(id), 0)), 2), 0) from public.clientes),
    'por_pagar', (select coalesce(round(sum(saldo), 2), 0) from public.cuentas_por_pagar()),
    'conciliacion', coalesce((select jsonb_agg(x order by x.dia desc, x.forma) from (
        select y.dia, y.forma, round(sum(y.monto), 2) as total,
               exists (select 1 from public.conciliaciones c where c.fecha = y.dia and c.forma_pago_id = y.forma) as verificado
        from (select (v.fecha at time zone 'America/Guayaquil')::date as dia, vp.forma_pago_id as forma, vp.monto
              from public.venta_pagos vp join ventas v on v.id = vp.venta_id
              where vp.forma_pago_id not in ('efectivo', 'fiado')) y
        group by y.dia, y.forma) x), '[]')
  ) into v
  from totales t;
  return v;
end;
$$;
