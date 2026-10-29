-- =============================================================================
-- Fase 4 — Inventario: lista de compras sugerida y alertas, pedido al
-- preventista, envases retornables y conteo de inventario.
-- =============================================================================

insert into public.permisos (codigo, grupo, descripcion, orden) values
  ('inventario.aprobar', 'Inventario', 'Aprobar los conteos de inventario (cambia el stock)', 62);

-- -----------------------------------------------------------------------------
-- Lista de compras sugerida: lo que está bajo el mínimo o no alcanza para una
-- semana según lo vendido en las últimas 4 semanas. Se sugiere llegar a 2 semanas
-- (o al doble del mínimo). Agrupada por el último lugar donde se compró.
-- -----------------------------------------------------------------------------
create function public.lista_sugerida()
returns table (producto_id uuid, nombre text, unidad_base text, stock numeric, stock_minimo numeric,
               vendido_4_semanas numeric, sugerido numeric, proveedor_id uuid, proveedor text)
language sql stable security definer set search_path = '' as $$
  with ventas as (
    select m.producto_id, sum(-m.cantidad) as vendido
    from public.movimientos_stock m
    where m.tipo = 'venta' and m.fecha >= now() - interval '28 days'
    group by m.producto_id
  ),
  ultimo_lugar as (
    select distinct on (l.producto_id) l.producto_id, c.proveedor_id
    from public.compra_lineas l join public.compras c on c.id = l.compra_id
    where c.estado <> 'anulada' and c.proveedor_id is not null
    order by l.producto_id, c.fecha desc
  ),
  base as (
    select p.id, p.nombre, p.unidad_base, coalesce(e.cantidad, 0) as stock, p.stock_minimo,
           coalesce(v.vendido, 0) as vendido, u.proveedor_id
    from public.productos p
    left join public.existencias e on e.producto_id = p.id
    left join ventas v on v.producto_id = p.id
    left join ultimo_lugar u on u.producto_id = p.id
    where p.activo and public.tiene_permiso('productos.ver')
  )
  select b.id, b.nombre, b.unidad_base, b.stock, b.stock_minimo, b.vendido,
         ceil(greatest(b.stock_minimo * 2, b.vendido / 2) - b.stock),
         b.proveedor_id, coalesce(pr.nombre, '')
  from base b left join public.proveedores pr on pr.id = b.proveedor_id
  where ((b.stock_minimo > 0 and b.stock < b.stock_minimo) or (b.vendido > 0 and b.stock < b.vendido / 4))
    and greatest(b.stock_minimo * 2, b.vendido / 2) - b.stock > 0
  order by coalesce(pr.nombre, 'zzz'), b.nombre;
$$;

-- Productos con stock que no se han movido en X días.
create function public.productos_sin_movimiento(p_dias int)
returns table (producto_id uuid, nombre text, unidad_base text, stock numeric, ultimo timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id, p.nombre, p.unidad_base, e.cantidad, max(m.fecha)
  from public.productos p
  join public.existencias e on e.producto_id = p.id and e.cantidad > 0
  left join public.movimientos_stock m on m.producto_id = p.id
  where p.activo and public.tiene_permiso('productos.ver')
  group by p.id, p.nombre, p.unidad_base, e.cantidad
  having coalesce(max(m.fecha), '-infinity') < now() - make_interval(days => p_dias)
  order by max(m.fecha) nulls first;
$$;

-- -----------------------------------------------------------------------------
-- Pedido al preventista
-- -----------------------------------------------------------------------------
create table public.pedidos (
  id           uuid primary key default gen_random_uuid(),
  proveedor_id uuid not null references public.proveedores (id),
  fecha        timestamptz not null default now(),
  estado       text not null default 'borrador' check (estado in ('borrador', 'enviado', 'recibido', 'anulado')),
  nota         text not null default '',
  compra_id    uuid references public.compras (id),
  usuario_id   uuid references public.perfiles (id) on delete set null
);
create index pedidos_proveedor on public.pedidos (proveedor_id, fecha desc);

create table public.pedido_lineas (
  pedido_id       uuid not null references public.pedidos (id) on delete cascade,
  producto_id     uuid not null references public.productos (id),
  presentacion_id uuid not null references public.presentaciones (id),
  cantidad        numeric(12, 3) not null check (cantidad > 0),
  primary key (pedido_id, presentacion_id)
);

create function public.guardar_pedido(p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_l jsonb;
begin
  perform public.exigir_permiso('compras.registrar');
  if nullif(p ->> 'proveedor_id', '') is null then raise exception 'Elige a qué proveedor es el pedido.'; end if;
  if v_id is null then
    insert into public.pedidos (proveedor_id, nota, usuario_id)
    values ((p ->> 'proveedor_id')::uuid, coalesce(trim(p ->> 'nota'), ''), auth.uid())
    returning id into v_id;
  else
    update public.pedidos set proveedor_id = (p ->> 'proveedor_id')::uuid, nota = coalesce(trim(p ->> 'nota'), '')
    where id = v_id and estado in ('borrador', 'enviado');
    if not found then raise exception 'Ese pedido ya fue recibido o anulado.'; end if;
    delete from public.pedido_lineas where pedido_id = v_id;
  end if;
  for v_l in select * from jsonb_array_elements(coalesce(p -> 'lineas', '[]')) loop
    if not exists (select 1 from public.presentaciones
                   where id = (v_l ->> 'presentacion_id')::uuid and producto_id = (v_l ->> 'producto_id')::uuid) then
      raise exception 'Un producto del pedido no existe.';
    end if;
    insert into public.pedido_lineas (pedido_id, producto_id, presentacion_id, cantidad)
    values (v_id, (v_l ->> 'producto_id')::uuid, (v_l ->> 'presentacion_id')::uuid, (v_l ->> 'cantidad')::numeric)
    on conflict (pedido_id, presentacion_id) do update set cantidad = public.pedido_lineas.cantidad + excluded.cantidad;
  end loop;
  return v_id;
end;
$$;

-- Cambia el estado: 'enviado' (se mandó por WhatsApp), 'anulado', o 'recibido' con la compra que lo trajo.
create function public.marcar_pedido(p_pedido uuid, p_estado text, p_compra uuid default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (public.tiene_permiso('compras.registrar') or (p_estado = 'recibido' and public.tiene_permiso('compras.recibir'))) then
    raise exception 'No tienes permiso para hacer esto.' using errcode = '42501';
  end if;
  if p_estado not in ('enviado', 'recibido', 'anulado') then raise exception 'Estado no válido.'; end if;
  update public.pedidos set estado = p_estado, compra_id = coalesce(p_compra, compra_id)
  where id = p_pedido and estado in ('borrador', 'enviado');
  if not found then raise exception 'Ese pedido ya fue recibido o anulado.'; end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Envases retornables (jabas y botellas)
--   vacíos:    envases vacíos que hay en la tienda
--   debidos:   envases que llegaron llenos y todavía se deben al proveedor
--   garantías: envases que clientes se llevaron pagando garantía
-- -----------------------------------------------------------------------------
create table public.envases (
  id           uuid primary key default gen_random_uuid(),
  nombre       text not null check (trim(nombre) <> ''),
  garantia     numeric(12, 4) not null default 0 check (garantia >= 0),
  proveedor_id uuid references public.proveedores (id),
  activo       boolean not null default true,
  creado_en    timestamptz not null default now()
);
create unique index envases_nombre on public.envases (public.normalizar(nombre));

create table public.movimientos_envases (
  id         bigint generated always as identity primary key,
  fecha      timestamptz not null default now(),
  envase_id  uuid not null references public.envases (id),
  tipo       text not null check (tipo in (
               'llegaron_llenos', 'entregue_vacios', 'cliente_trajo', 'garantia_cobrada', 'garantia_devuelta', 'conteo_vacios')),
  cantidad   int not null,
  vacios     int not null default 0,
  debidos    int not null default 0,
  garantias  int not null default 0,
  compra_id  uuid references public.compras (id),
  nota       text not null default '',
  usuario_id uuid references public.perfiles (id) on delete set null
);
create index movimientos_envases_envase on public.movimientos_envases (envase_id, fecha desc);

create function public.guardar_envase(p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
begin
  perform public.exigir_permiso('proveedores.gestionar');
  if coalesce(trim(p ->> 'nombre'), '') = '' then raise exception 'Escribe el nombre del envase (ej. Jaba Coca-Cola).'; end if;
  if exists (select 1 from public.envases where public.normalizar(nombre) = public.normalizar(p ->> 'nombre') and id is distinct from v_id) then
    raise exception 'Ya existe un envase con ese nombre.';
  end if;
  if v_id is null then
    insert into public.envases (nombre, garantia, proveedor_id)
    values (trim(p ->> 'nombre'), coalesce(nullif(p ->> 'garantia', '')::numeric, 0), nullif(p ->> 'proveedor_id', '')::uuid)
    returning id into v_id;
  else
    update public.envases set nombre = trim(p ->> 'nombre'), garantia = coalesce(nullif(p ->> 'garantia', '')::numeric, 0),
           proveedor_id = nullif(p ->> 'proveedor_id', '')::uuid, activo = coalesce((p ->> 'activo')::boolean, activo)
    where id = v_id;
  end if;
  return v_id;
end;
$$;

create function public.registrar_envases(p jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_envase record;
  v_tipo text := p ->> 'tipo';
  v_n int := nullif(p ->> 'cantidad', '')::int;
  v_cuenta uuid := nullif(p ->> 'cuenta_id', '')::uuid;
  v_vacios int := 0;
  v_debidos int := 0;
  v_garantias int := 0;
  v_actual int;
begin
  if not (public.tiene_permiso('compras.registrar') or public.tiene_permiso('compras.recibir')
          or public.tiene_permiso('ventas.vender')) then
    raise exception 'No tienes permiso para hacer esto.' using errcode = '42501';
  end if;
  select * into v_envase from public.envases where id = (p ->> 'envase_id')::uuid;
  if not found then raise exception 'Elige el envase.'; end if;
  if v_n is null or v_n < 0 or (v_tipo <> 'conteo_vacios' and v_n = 0) then raise exception 'Escribe una cantidad mayor que 0.'; end if;

  case v_tipo
    when 'llegaron_llenos' then v_debidos := v_n;
    when 'entregue_vacios' then v_vacios := -v_n; v_debidos := -v_n;
    when 'cliente_trajo' then v_vacios := v_n;
    when 'garantia_cobrada' then v_garantias := v_n;
    when 'garantia_devuelta' then v_garantias := -v_n; v_vacios := v_n;
    when 'conteo_vacios' then
      select coalesce(sum(vacios), 0) into v_actual from public.movimientos_envases where envase_id = v_envase.id;
      v_vacios := v_n - v_actual;
      if v_vacios = 0 then return; end if;
    else raise exception 'Movimiento de envases no válido.';
  end case;

  if v_tipo in ('garantia_cobrada', 'garantia_devuelta') and v_envase.garantia > 0 then
    if v_cuenta is null then raise exception 'Elige la cuenta del dinero de la garantía.'; end if;
    perform public.registrar_dinero(v_cuenta, case when v_tipo = 'garantia_cobrada' then 1 else -1 end * v_n * v_envase.garantia,
      'garantia_envase', 'envase', v_envase.id::text, 'Garantía ' || v_envase.nombre);
  end if;
  insert into public.movimientos_envases (envase_id, tipo, cantidad, vacios, debidos, garantias, compra_id, nota, usuario_id)
  values (v_envase.id, v_tipo, v_n, v_vacios, v_debidos, v_garantias, nullif(p ->> 'compra_id', '')::uuid,
          coalesce(trim(p ->> 'nota'), ''), auth.uid());
end;
$$;

create function public.saldos_envases()
returns table (id uuid, nombre text, garantia numeric, proveedor text, activo boolean, vacios bigint, debidos bigint, garantias bigint)
language sql stable security definer set search_path = '' as $$
  select e.id, e.nombre, e.garantia, coalesce(p.nombre, ''), e.activo,
         coalesce(sum(m.vacios), 0), coalesce(sum(m.debidos), 0), coalesce(sum(m.garantias), 0)
  from public.envases e
  left join public.proveedores p on p.id = e.proveedor_id
  left join public.movimientos_envases m on m.envase_id = e.id
  where public.tiene_permiso('productos.ver')
  group by e.id, p.nombre
  order by e.activo desc, e.nombre;
$$;

-- -----------------------------------------------------------------------------
-- Conteo de inventario: se cuenta en el celular, se envía y la administradora
-- aprueba. La diferencia se calcula contra lo que decía el sistema AL MOMENTO
-- de contar cada producto (así no se pierden las ventas que pasen mientras tanto).
-- -----------------------------------------------------------------------------
create table public.conteos (
  id           uuid primary key default gen_random_uuid(),
  nombre       text not null,
  categoria_id uuid references public.categorias (id) on delete set null,
  estado       text not null default 'abierto' check (estado in ('abierto', 'por_aprobar', 'aprobado', 'anulado')),
  creado_por   uuid references public.perfiles (id) on delete set null,
  creado_en    timestamptz not null default now(),
  enviado_en   timestamptz,
  aprobado_por uuid references public.perfiles (id) on delete set null,
  aprobado_en  timestamptz
);

create table public.conteo_lineas (
  conteo_id   uuid not null references public.conteos (id) on delete cascade,
  producto_id uuid not null references public.productos (id) on delete cascade,
  sistema     numeric(12, 3), -- lo que decía la app cuando se contó
  contado     numeric(12, 3) check (contado >= 0),
  contado_en  timestamptz,
  contado_por uuid references public.perfiles (id) on delete set null,
  primary key (conteo_id, producto_id)
);

create function public.iniciar_conteo(p_nombre text, p_categoria uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  perform public.exigir_permiso('inventario.contar');
  insert into public.conteos (nombre, categoria_id, creado_por)
  values (coalesce(nullif(trim(p_nombre), ''),
                   'Conteo ' || coalesce((select nombre from public.categorias where id = p_categoria), 'de todo')),
          p_categoria, auth.uid())
  returning id into v_id;
  insert into public.conteo_lineas (conteo_id, producto_id)
  select v_id, p.id from public.productos p
  where p.activo and (p_categoria is null or p.categoria_id = p_categoria);
  perform public.registrar_evento(auth.uid(), 'iniciar_conteo', 'conteo', v_id::text, jsonb_build_object('categoria', p_categoria));
  return v_id;
end;
$$;

-- Anota lo contado (null = borrar). Si el producto no estaba en la lista, se agrega.
create function public.anotar_conteo(p_conteo uuid, p_producto uuid, p_contado numeric) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.exigir_permiso('inventario.contar');
  if not exists (select 1 from public.conteos where id = p_conteo and estado = 'abierto') then
    raise exception 'Ese conteo ya se envió.';
  end if;
  if p_contado is not null and p_contado < 0 then raise exception 'Lo contado no puede ser negativo.'; end if;
  insert into public.conteo_lineas (conteo_id, producto_id, sistema, contado, contado_en, contado_por)
  values (p_conteo, p_producto,
          case when p_contado is null then null else coalesce((select cantidad from public.existencias where producto_id = p_producto), 0) end,
          p_contado, case when p_contado is null then null else now() end, case when p_contado is null then null else auth.uid() end)
  on conflict (conteo_id, producto_id) do update
    set sistema = excluded.sistema, contado = excluded.contado, contado_en = excluded.contado_en, contado_por = excluded.contado_por;
end;
$$;

create function public.enviar_conteo(p_conteo uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.exigir_permiso('inventario.contar');
  if not exists (select 1 from public.conteo_lineas where conteo_id = p_conteo and contado is not null) then
    raise exception 'Todavía no contaste nada.';
  end if;
  update public.conteos set estado = 'por_aprobar', enviado_en = now() where id = p_conteo and estado = 'abierto';
  if not found then raise exception 'Ese conteo ya se envió.'; end if;
end;
$$;

-- Aprueba el conteo: cada diferencia se registra como «Corrección de conteo».
-- p_productos: solo esos productos (null = todos los contados). Devuelve cuántos cambiaron.
create function public.aprobar_conteo(p_conteo uuid, p_productos uuid[] default null) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_linea record;
  v_nombre text;
  v_cambios int := 0;
begin
  perform public.exigir_permiso('inventario.aprobar');
  select nombre into v_nombre from public.conteos where id = p_conteo and estado in ('abierto', 'por_aprobar') for update;
  if not found then raise exception 'Ese conteo ya fue aprobado o anulado.'; end if;
  for v_linea in
    select producto_id, contado - sistema as diferencia from public.conteo_lineas
    where conteo_id = p_conteo and contado is not null and contado <> sistema
      and (p_productos is null or producto_id = any (p_productos))
  loop
    perform public.registrar_movimiento(v_linea.producto_id, 'conteo', v_linea.diferencia, null, 'conteo', p_conteo::text, v_nombre);
    v_cambios := v_cambios + 1;
  end loop;
  update public.conteos set estado = 'aprobado', aprobado_por = auth.uid(), aprobado_en = now() where id = p_conteo;
  perform public.registrar_evento(auth.uid(), 'aprobar_conteo', 'conteo', p_conteo::text, jsonb_build_object('cambios', v_cambios));
  return v_cambios;
end;
$$;

create function public.anular_conteo(p_conteo uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (public.tiene_permiso('inventario.aprobar')
          or exists (select 1 from public.conteos where id = p_conteo and creado_por = auth.uid() and public.tiene_permiso('inventario.contar'))) then
    raise exception 'No tienes permiso para hacer esto.' using errcode = '42501';
  end if;
  update public.conteos set estado = 'anulado' where id = p_conteo and estado in ('abierto', 'por_aprobar');
  if not found then raise exception 'Ese conteo ya fue aprobado o anulado.'; end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Seguridad
-- -----------------------------------------------------------------------------
alter table public.pedidos enable row level security;
alter table public.pedido_lineas enable row level security;
alter table public.envases enable row level security;
alter table public.movimientos_envases enable row level security;
alter table public.conteos enable row level security;
alter table public.conteo_lineas enable row level security;

create policy "ver pedidos" on public.pedidos for select to authenticated
  using (public.tiene_permiso('compras.registrar') or public.tiene_permiso('compras.recibir'));
create policy "ver líneas de pedido" on public.pedido_lineas for select to authenticated
  using (public.tiene_permiso('compras.registrar') or public.tiene_permiso('compras.recibir'));
create policy "ver envases" on public.envases for select to authenticated using (public.tiene_permiso('productos.ver'));
create policy "ver movimientos de envases" on public.movimientos_envases for select to authenticated
  using (public.tiene_permiso('compras.registrar') or public.tiene_permiso('costos.ver'));
create policy "ver conteos" on public.conteos for select to authenticated
  using (public.tiene_permiso('inventario.contar') or public.tiene_permiso('inventario.aprobar'));
create policy "ver líneas de conteo" on public.conteo_lineas for select to authenticated
  using (public.tiene_permiso('inventario.contar') or public.tiene_permiso('inventario.aprobar'));

revoke insert, update, delete, truncate on
  public.pedidos, public.pedido_lineas, public.envases, public.movimientos_envases, public.conteos, public.conteo_lineas
from anon, authenticated;
revoke all on
  public.pedidos, public.pedido_lineas, public.envases, public.movimientos_envases, public.conteos, public.conteo_lineas
from anon;

revoke execute on function
  public.lista_sugerida(), public.productos_sin_movimiento(int), public.guardar_pedido(jsonb),
  public.marcar_pedido(uuid, text, uuid), public.guardar_envase(jsonb), public.registrar_envases(jsonb),
  public.saldos_envases(), public.iniciar_conteo(text, uuid), public.anotar_conteo(uuid, uuid, numeric),
  public.enviar_conteo(uuid), public.aprobar_conteo(uuid, uuid[]), public.anular_conteo(uuid)
from public, anon;
grant execute on function
  public.lista_sugerida(), public.productos_sin_movimiento(int), public.guardar_pedido(jsonb),
  public.marcar_pedido(uuid, text, uuid), public.guardar_envase(jsonb), public.registrar_envases(jsonb),
  public.saldos_envases(), public.iniciar_conteo(text, uuid), public.anotar_conteo(uuid, uuid, numeric),
  public.enviar_conteo(uuid), public.aprobar_conteo(uuid, uuid[]), public.anular_conteo(uuid)
to authenticated;
