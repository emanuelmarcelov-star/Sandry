-- =============================================================================
-- Fase 6 — Gastos, vehículo, gastos fijos, otros ingresos, conciliación y reportes.
--
-- Decisiones (30/10/2026): cada gasto del carro se marca «tienda» o «personal»
-- (lo personal pagado con plata de la tienda es retiro de la dueña, no gasto
-- del negocio); gastos fijos con aviso: arriendo, luz, agua, internet, sueldo.
-- =============================================================================

alter table public.movimientos_dinero drop constraint movimientos_dinero_motivo_check;
alter table public.movimientos_dinero add constraint movimientos_dinero_motivo_check check (motivo in (
  'saldo_inicial', 'correccion', 'venta', 'compra', 'gasto', 'pago_proveedor', 'transferencia', 'aporte', 'retiro',
  'abono_cliente', 'garantia_envase', 'otro_ingreso'));

alter table public.ajustes add column correo_resumen text not null default '';

-- -----------------------------------------------------------------------------
-- Categorías de gasto (planas, con un grupo para los reportes)
-- -----------------------------------------------------------------------------
alter table public.categorias_gasto
  add column grupo text not null default 'Otros',
  add column es_vehiculo boolean not null default false;

update public.categorias_gasto set grupo = 'Transporte y vehículo', es_vehiculo = true where nombre in ('Gasolina', 'Parqueadero', 'Peajes');
update public.categorias_gasto set grupo = 'Transporte y vehículo' where nombre in ('Cargador o estibador', 'Otros del viaje');
update public.categorias_gasto set grupo = 'Suministros' where nombre = 'Fundas y empaques';
update public.categorias_gasto set grupo = 'Arriendo' where nombre = 'Arriendo';
update public.categorias_gasto set grupo = 'Servicios básicos' where nombre in ('Luz', 'Agua', 'Internet y teléfono');
update public.categorias_gasto set grupo = 'Sueldos' where nombre = 'Sueldos';
insert into public.categorias_gasto (nombre, grupo, es_transporte, es_vehiculo, orden) values
  ('Mantenimiento del carro', 'Transporte y vehículo', false, true, 7),
  ('Lavado del carro', 'Transporte y vehículo', false, true, 8),
  ('Matrícula del carro', 'Transporte y vehículo', false, true, 9),
  ('Impuestos y permisos', 'Impuestos y permisos', false, false, 15),
  ('Mantenimiento del local', 'Mantenimiento del local', false, false, 16),
  ('Papel y etiquetas', 'Suministros', false, false, 17);

create function public.guardar_categoria_gasto(p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
begin
  perform public.exigir_permiso('ajustes.gestionar');
  if coalesce(trim(p ->> 'nombre'), '') = '' then raise exception 'Escribe el nombre.'; end if;
  if exists (select 1 from public.categorias_gasto where public.normalizar(nombre) = public.normalizar(p ->> 'nombre') and id is distinct from v_id) then
    raise exception 'Ya existe esa categoría.';
  end if;
  if v_id is null then
    insert into public.categorias_gasto (nombre, grupo, es_vehiculo, orden)
    values (trim(p ->> 'nombre'), coalesce(nullif(trim(p ->> 'grupo'), ''), 'Otros'), coalesce((p ->> 'es_vehiculo')::boolean, false),
            coalesce((select max(orden) + 1 from public.categorias_gasto), 1))
    returning id into v_id;
  else
    update public.categorias_gasto set nombre = trim(p ->> 'nombre'), grupo = coalesce(nullif(trim(p ->> 'grupo'), ''), grupo),
      es_vehiculo = coalesce((p ->> 'es_vehiculo')::boolean, es_vehiculo), activa = coalesce((p ->> 'activa')::boolean, activa)
    where id = v_id;
  end if;
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Vehículos y gastos fijos
-- -----------------------------------------------------------------------------
create table public.vehiculos (
  id        uuid primary key default gen_random_uuid(),
  nombre    text not null check (trim(nombre) <> ''),
  activo    boolean not null default true,
  creado_en timestamptz not null default now()
);

create function public.guardar_vehiculo(p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
begin
  perform public.exigir_permiso('gastos.registrar');
  if coalesce(trim(p ->> 'nombre'), '') = '' then raise exception 'Escribe el nombre del carro (ej. Chevrolet Aveo).'; end if;
  if v_id is null then
    insert into public.vehiculos (nombre) values (trim(p ->> 'nombre')) returning id into v_id;
  else
    update public.vehiculos set nombre = trim(p ->> 'nombre'), activo = coalesce((p ->> 'activo')::boolean, activo) where id = v_id;
  end if;
  return v_id;
end;
$$;

create table public.gastos_recurrentes (
  id           uuid primary key default gen_random_uuid(),
  categoria_id uuid not null references public.categorias_gasto (id),
  descripcion  text not null,
  monto        numeric(12, 4) check (monto is null or monto > 0),
  dia          int not null default 1 check (dia between 1 and 28),
  cuenta_id    uuid references public.cuentas_dinero (id),
  activo       boolean not null default true
);
insert into public.gastos_recurrentes (categoria_id, descripcion, dia)
select c.id, x.descripcion, x.dia
from (values ('Arriendo', 'Arriendo del local', 5), ('Luz', 'Luz', 15), ('Agua', 'Agua', 15),
             ('Internet y teléfono', 'Internet', 10), ('Sueldos', 'Sueldo de la trabajadora', 30 - 2)) x(categoria, descripcion, dia)
join public.categorias_gasto c on c.nombre = x.categoria;

create function public.guardar_recurrente(p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_monto numeric := nullif(p ->> 'monto', '')::numeric;
begin
  perform public.exigir_permiso('gastos.registrar');
  if coalesce(trim(p ->> 'descripcion'), '') = '' then raise exception 'Escribe qué gasto es.'; end if;
  if v_monto is not null and v_monto <= 0 then raise exception 'El monto debe ser mayor que 0.'; end if;
  if v_id is null then
    insert into public.gastos_recurrentes (categoria_id, descripcion, monto, dia, cuenta_id)
    values ((p ->> 'categoria_id')::uuid, trim(p ->> 'descripcion'), v_monto, coalesce(nullif(p ->> 'dia', '')::int, 1),
            nullif(p ->> 'cuenta_id', '')::uuid)
    returning id into v_id;
  else
    update public.gastos_recurrentes set categoria_id = (p ->> 'categoria_id')::uuid, descripcion = trim(p ->> 'descripcion'),
      monto = v_monto, dia = coalesce(nullif(p ->> 'dia', '')::int, dia), cuenta_id = nullif(p ->> 'cuenta_id', '')::uuid,
      activo = coalesce((p ->> 'activo')::boolean, activo)
    where id = v_id;
  end if;
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Gastos: tienda o personal, carro, gasto fijo, anular
-- -----------------------------------------------------------------------------
alter table public.gastos
  add column personal boolean not null default false,
  add column vehiculo_id uuid references public.vehiculos (id),
  add column galones numeric(8, 3) check (galones is null or galones > 0),
  add column kilometraje int check (kilometraje is null or kilometraje >= 0),
  add column recurrente_id uuid references public.gastos_recurrentes (id),
  add column anulado boolean not null default false;
create index gastos_recurrente on public.gastos (recurrente_id, fecha);

create or replace function public.registrar_gasto(p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := (p ->> 'id')::uuid;
  v_viaje uuid := nullif(p ->> 'viaje_id', '')::uuid;
  v_monto numeric := nullif(p ->> 'monto', '')::numeric;
  v_personal boolean := coalesce((p ->> 'personal')::boolean, false);
  v_categoria text;
  v_texto text;
begin
  if not (public.tiene_permiso('gastos.registrar') or (v_viaje is not null and public.tiene_permiso('compras.registrar'))) then
    raise exception 'No tienes permiso para hacer esto.' using errcode = '42501';
  end if;
  if v_id is null then raise exception 'Falta el identificador del gasto.'; end if;
  if exists (select 1 from public.gastos where id = v_id) then return v_id; end if;
  if v_monto is null or v_monto <= 0 then raise exception 'Escribe un monto mayor que 0.'; end if;
  select nombre into v_categoria from public.categorias_gasto where id = (p ->> 'categoria_id')::uuid;
  if not found then raise exception 'Elige qué fue el gasto.'; end if;
  if nullif(p ->> 'cuenta_id', '') is null then raise exception 'Elige de qué cuenta salió el dinero.'; end if;
  if v_viaje is not null and not exists (select 1 from public.viajes where id = v_viaje and estado = 'en_curso') then
    raise exception 'Ese viaje ya terminó.';
  end if;
  insert into public.gastos (id, fecha, categoria_id, descripcion, monto, cuenta_id, viaje_id, foto_ruta, usuario_id,
                             personal, vehiculo_id, galones, kilometraje, recurrente_id)
  values (v_id, coalesce(nullif(p ->> 'fecha', '')::timestamptz, now()), (p ->> 'categoria_id')::uuid,
          coalesce(trim(p ->> 'descripcion'), ''), round(v_monto, 4), (p ->> 'cuenta_id')::uuid, v_viaje,
          nullif(p ->> 'foto_ruta', ''), auth.uid(), v_personal, nullif(p ->> 'vehiculo_id', '')::uuid,
          nullif(p ->> 'galones', '')::numeric, nullif(p ->> 'kilometraje', '')::int, nullif(p ->> 'recurrente_id', '')::uuid);
  v_texto := v_categoria || coalesce(nullif(' · ' || trim(p ->> 'descripcion'), ' · '), '');
  -- Lo personal pagado con plata de la tienda es un retiro de la dueña, no un gasto del negocio.
  perform public.registrar_dinero((p ->> 'cuenta_id')::uuid, -v_monto, case when v_personal then 'retiro' else 'gasto' end,
    'gasto', v_id::text, case when v_personal then v_texto || ' (personal)' else v_texto end);
  perform public.registrar_evento(auth.uid(), 'registrar_gasto', 'gasto', v_id::text, p);
  return v_id;
end;
$$;

create function public.anular_gasto(p_gasto uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_gasto public.gastos;
begin
  perform public.exigir_permiso('gastos.registrar');
  select * into v_gasto from public.gastos where id = p_gasto and not anulado for update;
  if not found then raise exception 'Ese gasto ya está anulado.'; end if;
  update public.gastos set anulado = true where id = p_gasto;
  perform public.registrar_dinero(v_gasto.cuenta_id, v_gasto.monto, case when v_gasto.personal then 'retiro' else 'gasto' end,
    'gasto', p_gasto::text, 'Anulación de gasto');
  perform public.registrar_evento(auth.uid(), 'anular_gasto', 'gasto', p_gasto::text, '{}');
end;
$$;

-- Otros ingresos que no son ventas (ej. comisión de recargas).
create function public.registrar_ingreso(p jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_monto numeric := nullif(p ->> 'monto', '')::numeric;
begin
  perform public.exigir_permiso('gastos.registrar');
  if v_monto is null or v_monto <= 0 then raise exception 'Escribe un monto mayor que 0.'; end if;
  if coalesce(trim(p ->> 'descripcion'), '') = '' then raise exception 'Escribe de qué es el ingreso.'; end if;
  perform public.registrar_dinero((p ->> 'cuenta_id')::uuid, v_monto, 'otro_ingreso', 'ingreso', gen_random_uuid()::text, trim(p ->> 'descripcion'));
  perform public.registrar_evento(auth.uid(), 'registrar_ingreso', 'cuenta_dinero', p ->> 'cuenta_id', p);
end;
$$;

-- Gastos fijos de este mes que todavía no se han pagado.
create function public.recurrentes_pendientes()
returns table (id uuid, descripcion text, categoria_id uuid, categoria text, monto numeric, dia int, cuenta_id uuid, vence date)
language sql stable security definer set search_path = '' as $$
  with hoy as (select (now() at time zone 'America/Guayaquil')::date as d)
  select r.id, r.descripcion, r.categoria_id, c.nombre, r.monto, r.dia, r.cuenta_id,
         make_date(extract(year from hoy.d)::int, extract(month from hoy.d)::int, r.dia)
  from public.gastos_recurrentes r
  join public.categorias_gasto c on c.id = r.categoria_id
  cross join hoy
  where r.activo and (public.tiene_permiso('gastos.registrar') or public.tiene_permiso('reportes.ver'))
    and not exists (
      select 1 from public.gastos g
      where g.recurrente_id = r.id and not g.anulado
        and date_trunc('month', g.fecha at time zone 'America/Guayaquil') = date_trunc('month', hoy.d::timestamp))
  order by r.dia;
$$;

-- -----------------------------------------------------------------------------
-- Conciliación: comparar lo cobrado por Deuna, transferencia, etc. con la app del banco.
-- -----------------------------------------------------------------------------
create table public.conciliaciones (
  fecha          date not null,
  forma_pago_id  text not null references public.formas_pago (id),
  verificado_por uuid references public.perfiles (id) on delete set null,
  verificado_en  timestamptz not null default now(),
  primary key (fecha, forma_pago_id)
);

create function public.marcar_conciliado(p_fecha date, p_forma text, p_verificado boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.exigir_permiso('reportes.ver');
  if p_verificado then
    insert into public.conciliaciones (fecha, forma_pago_id, verificado_por) values (p_fecha, p_forma, auth.uid())
    on conflict do nothing;
  else
    delete from public.conciliaciones where fecha = p_fecha and forma_pago_id = p_forma;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Reporte del período (solo quien ve reportes). Fechas en hora de Ecuador.
-- -----------------------------------------------------------------------------
create function public.reporte(p_desde date, p_hasta date, p_usuario uuid default null, p_categoria uuid default null)
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
           (select coalesce(sum(total), 0) from ventas) - (select monto from devoluciones) as ventas,
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
        select (v.fecha at time zone 'America/Guayaquil')::date as dia, vp.forma_pago_id as forma, round(sum(vp.monto), 2) as total,
               exists (select 1 from public.conciliaciones c where c.fecha = (v.fecha at time zone 'America/Guayaquil')::date
                       and c.forma_pago_id = vp.forma_pago_id) as verificado
        from public.venta_pagos vp join ventas v on v.id = vp.venta_id
        where vp.forma_pago_id not in ('efectivo', 'fiado')
        group by 1, 2) x), '[]')
  ) into v
  from totales t;
  return v;
end;
$$;

-- Panel de inicio: hoy, el mismo día de la semana pasada y las alertas.
create function public.panel_inicio() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_hoy date := (now() at time zone 'America/Guayaquil')::date;
  v_dias int;
begin
  perform public.exigir_permiso('reportes.ver');
  select dias_aviso_caducidad into v_dias from public.ajustes where id = 1;
  return jsonb_build_object(
    'hoy', public.reporte(v_hoy, v_hoy),
    'semana_pasada', (select jsonb_build_object('ventas', r -> 'ventas', 'ganancia_bruta', r -> 'ganancia_bruta')
                      from public.reporte(v_hoy - 7, v_hoy - 7) r),
    'caja_abierta', exists (select 1 from public.cajas where estado = 'abierta'),
    'efectivo_esperado', public.saldo_cuenta(public.cuenta_caja()),
    'saldos', (select jsonb_agg(jsonb_build_object('nombre', s.nombre, 'saldo', s.saldo, 'tipo', s.tipo) order by s.orden)
               from public.saldos_cuentas() s where s.activa),
    'alertas', jsonb_build_object(
      'poco_stock', (select count(*) from public.lista_sugerida()),
      'por_caducar', (select count(*) from public.lotes l join public.productos p on p.id = l.producto_id and p.activo
                      where l.cantidad > 0 and l.vence <= v_hoy + v_dias),
      'fiados', (select coalesce(round(sum(greatest(public.saldo_fiado(id), 0)), 2), 0) from public.clientes),
      'por_pagar_vencido', (select coalesce(round(sum(saldo), 2), 0) from public.cuentas_por_pagar() where vence < v_hoy),
      'pendientes', (select count(*) from public.productos where pendiente and activo),
      'revisar', (select count(*) from public.venta_lineas l join public.ventas v on v.id = l.venta_id
                  where l.revisar and v.estado = 'normal' and v.fecha > now() - interval '7 days'),
      'gastos_fijos', (select count(*) from public.recurrentes_pendientes() where vence <= v_hoy + 3)
    )
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Seguridad
-- -----------------------------------------------------------------------------
alter table public.vehiculos enable row level security;
alter table public.gastos_recurrentes enable row level security;
alter table public.conciliaciones enable row level security;
create policy "ver vehículos" on public.vehiculos for select to authenticated
  using (public.tiene_permiso('gastos.registrar') or public.tiene_permiso('reportes.ver') or public.tiene_permiso('compras.registrar'));
create policy "ver gastos fijos" on public.gastos_recurrentes for select to authenticated
  using (public.tiene_permiso('gastos.registrar') or public.tiene_permiso('reportes.ver'));
create policy "ver conciliaciones" on public.conciliaciones for select to authenticated using (public.tiene_permiso('reportes.ver'));

revoke insert, update, delete, truncate on public.vehiculos, public.gastos_recurrentes, public.conciliaciones from anon, authenticated;
revoke all on public.vehiculos, public.gastos_recurrentes, public.conciliaciones from anon;

revoke execute on function
  public.guardar_categoria_gasto(jsonb), public.guardar_vehiculo(jsonb), public.guardar_recurrente(jsonb),
  public.anular_gasto(uuid), public.registrar_ingreso(jsonb), public.recurrentes_pendientes(),
  public.marcar_conciliado(date, text, boolean), public.reporte(date, date, uuid, uuid), public.panel_inicio()
from public, anon;
grant execute on function
  public.guardar_categoria_gasto(jsonb), public.guardar_vehiculo(jsonb), public.guardar_recurrente(jsonb),
  public.anular_gasto(uuid), public.registrar_ingreso(jsonb), public.recurrentes_pendientes(),
  public.marcar_conciliado(date, text, boolean), public.reporte(date, date, uuid, uuid), public.panel_inicio()
to authenticated;
