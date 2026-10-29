-- =============================================================================
-- Fase 4 — Abastecimiento: cuentas de dinero, proveedores, compras (suelta,
-- distribuidor, viaje), pagos a crédito, gastos del viaje y lotes con caducidad.
--
-- Reglas:
--  * Todo cambio pasa por funciones SECURITY DEFINER que revisan permisos.
--  * El libro de dinero (movimientos_dinero) y el kardex nunca se borran.
--  * Las compras y los viajes los crea el dispositivo con su propio id: si se va
--    la señal y se reintenta, no se duplica nada.
--  * Transporte del viaje = gasto de la tienda (no se prorratea en el costo).
-- =============================================================================

insert into public.permisos (codigo, grupo, descripcion, orden) values
  ('proveedores.gestionar', 'Compras', 'Crear y editar proveedores y lugares de compra', 52),
  ('dinero.ver',            'Dinero',  'Ver las cuentas de dinero y sus saldos', 75),
  ('dinero.mover',          'Dinero',  'Pasar dinero entre cuentas, aportes y retiros de la dueña', 76);
insert into public.rol_permisos (rol_id, permiso) values ('inventario', 'proveedores.gestionar');

alter table public.ajustes
  add column dias_aviso_caducidad int not null default 7 check (dias_aviso_caducidad between 1 and 90),
  add column dias_sin_movimiento int not null default 30 check (dias_sin_movimiento between 7 and 365);

-- -----------------------------------------------------------------------------
-- Cuentas de dinero y su libro
-- -----------------------------------------------------------------------------
create table public.cuentas_dinero (
  id        uuid primary key default gen_random_uuid(),
  nombre    text not null check (trim(nombre) <> ''),
  tipo      text not null check (tipo in ('caja', 'caja_fuerte', 'banco', 'deuna', 'personal', 'otra')),
  activa    boolean not null default true,
  orden     int not null default 0,
  creado_en timestamptz not null default now()
);
create unique index cuentas_dinero_nombre on public.cuentas_dinero (public.normalizar(nombre));
-- Solo hay un «Dinero personal de la dueña».
create unique index cuentas_dinero_una_personal on public.cuentas_dinero (tipo) where tipo = 'personal';

insert into public.cuentas_dinero (nombre, tipo, orden) values
  ('Caja', 'caja', 1),
  ('Banco', 'banco', 2),
  ('Deuna', 'deuna', 3),
  ('Dinero personal de la dueña', 'personal', 4);

create table public.movimientos_dinero (
  id              bigint generated always as identity primary key,
  fecha           timestamptz not null default now(),
  cuenta_id       uuid not null references public.cuentas_dinero (id),
  monto           numeric(12, 4) not null check (monto <> 0),
  motivo          text not null check (motivo in (
                    'saldo_inicial', 'correccion', 'venta', 'compra', 'gasto', 'pago_proveedor',
                    'transferencia', 'aporte', 'retiro', 'abono_cliente', 'garantia_envase')),
  referencia_tipo text,
  referencia_id   text,
  descripcion     text not null default '',
  usuario_id      uuid references public.perfiles (id) on delete set null
);
create index movimientos_dinero_cuenta on public.movimientos_dinero (cuenta_id, fecha desc);
create index movimientos_dinero_referencia on public.movimientos_dinero (referencia_tipo, referencia_id);

-- Escribe una línea en el libro (uso interno).
create function public.registrar_dinero(
  p_cuenta uuid, p_monto numeric, p_motivo text,
  p_referencia_tipo text default null, p_referencia_id text default null, p_descripcion text default ''
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_monto is null or p_monto = 0 then return; end if;
  if not exists (select 1 from public.cuentas_dinero where id = p_cuenta and activa) then
    raise exception 'Elige una cuenta de dinero activa.';
  end if;
  insert into public.movimientos_dinero (cuenta_id, monto, motivo, referencia_tipo, referencia_id, descripcion, usuario_id)
  values (p_cuenta, round(p_monto, 4), p_motivo, p_referencia_tipo, p_referencia_id, coalesce(p_descripcion, ''), auth.uid());
end;
$$;

create function public.saldos_cuentas()
returns table (id uuid, nombre text, tipo text, activa boolean, orden int, saldo numeric)
language sql stable security definer set search_path = '' as $$
  select c.id, c.nombre, c.tipo, c.activa, c.orden, coalesce(sum(m.monto), 0)
  from public.cuentas_dinero c
  left join public.movimientos_dinero m on m.cuenta_id = c.id
  where public.tiene_permiso('dinero.ver')
  group by c.id
  order by c.orden, c.nombre;
$$;

create function public.guardar_cuenta(p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
begin
  perform public.exigir_permiso('dinero.mover');
  if coalesce(trim(p ->> 'nombre'), '') = '' then raise exception 'Escribe el nombre de la cuenta.'; end if;
  if exists (select 1 from public.cuentas_dinero
             where public.normalizar(nombre) = public.normalizar(p ->> 'nombre') and id is distinct from v_id) then
    raise exception 'Ya existe una cuenta con ese nombre.';
  end if;
  if v_id is null then
    insert into public.cuentas_dinero (nombre, tipo, orden)
    values (trim(p ->> 'nombre'), coalesce(nullif(p ->> 'tipo', ''), 'otra'),
            coalesce((select max(orden) + 1 from public.cuentas_dinero), 1))
    returning id into v_id;
  else
    update public.cuentas_dinero
       set nombre = trim(p ->> 'nombre'),
           activa = coalesce((p ->> 'activa')::boolean, activa)
     where id = v_id;
    if not found then raise exception 'No se encontró la cuenta.'; end if;
  end if;
  perform public.registrar_evento(auth.uid(), 'guardar_cuenta', 'cuenta_dinero', v_id::text, p);
  return v_id;
end;
$$;

-- Transferencia, aporte de la dueña, retiro de la dueña o corrección de saldo.
create function public.mover_dinero(p jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_tipo text := p ->> 'tipo';
  v_origen uuid := nullif(p ->> 'origen', '')::uuid;
  v_destino uuid := nullif(p ->> 'destino', '')::uuid;
  v_monto numeric := nullif(p ->> 'monto', '')::numeric;
  v_nota text := coalesce(trim(p ->> 'nota'), '');
  v_personal uuid;
  v_saldo numeric;
  v_ref text := gen_random_uuid()::text;
begin
  perform public.exigir_permiso('dinero.mover');
  select id into v_personal from public.cuentas_dinero where tipo = 'personal';
  if v_monto is null or (v_tipo <> 'correccion' and v_monto <= 0) or v_monto < 0 then
    raise exception 'Escribe un monto mayor que 0.';
  end if;

  if v_tipo = 'transferencia' then
    if v_origen is null or v_destino is null or v_origen = v_destino then
      raise exception 'Elige dos cuentas distintas.';
    end if;
    perform public.registrar_dinero(v_origen, -v_monto, 'transferencia', 'transferencia', v_ref, v_nota);
    perform public.registrar_dinero(v_destino, v_monto, 'transferencia', 'transferencia', v_ref, v_nota);
  elsif v_tipo = 'aporte' then
    if v_destino is null or v_destino = v_personal then raise exception 'Elige a qué cuenta de la tienda entra.'; end if;
    perform public.registrar_dinero(v_personal, -v_monto, 'aporte', 'aporte', v_ref, v_nota);
    perform public.registrar_dinero(v_destino, v_monto, 'aporte', 'aporte', v_ref, v_nota);
  elsif v_tipo = 'retiro' then
    if v_origen is null or v_origen = v_personal then raise exception 'Elige de qué cuenta de la tienda sale.'; end if;
    perform public.registrar_dinero(v_origen, -v_monto, 'retiro', 'retiro', v_ref, v_nota);
    perform public.registrar_dinero(v_personal, v_monto, 'retiro', 'retiro', v_ref, v_nota);
  elsif v_tipo = 'correccion' then
    -- «Conté la caja y hay $X»: se registra la diferencia.
    if v_destino is null then raise exception 'Elige la cuenta.'; end if;
    select coalesce(sum(monto), 0) into v_saldo from public.movimientos_dinero where cuenta_id = v_destino;
    perform public.registrar_dinero(v_destino, v_monto - v_saldo,
      case when exists (select 1 from public.movimientos_dinero where cuenta_id = v_destino) then 'correccion' else 'saldo_inicial' end,
      'correccion', v_ref, v_nota);
  else
    raise exception 'Movimiento de dinero no válido.';
  end if;
  perform public.registrar_evento(auth.uid(), 'mover_dinero', 'cuenta_dinero', coalesce(v_destino, v_origen)::text, p);
end;
$$;

-- -----------------------------------------------------------------------------
-- Proveedores y lugares de compra
-- -----------------------------------------------------------------------------
create table public.proveedores (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null check (trim(nombre) <> ''),
  tipo        text not null default 'otro'
              check (tipo in ('distribuidor', 'mayorista', 'mercado', 'supermercado', 'otro')),
  ruc         text not null default '',
  contacto    text not null default '',
  telefono    text not null default '',
  direccion   text not null default '',
  dias_visita smallint[] not null default '{}', -- 1 = lunes … 7 = domingo
  condiciones text not null default '',
  notas       text not null default '',
  activo      boolean not null default true,
  creado_en   timestamptz not null default now()
);
create unique index proveedores_nombre on public.proveedores (public.normalizar(nombre));

create function public.guardar_proveedor(p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_ruc text := regexp_replace(coalesce(p ->> 'ruc', ''), '\s', '', 'g');
  v_dias smallint[] := coalesce((select array_agg(d::smallint order by d::smallint)
                                 from jsonb_array_elements_text(coalesce(p -> 'dias_visita', '[]')) d), '{}');
begin
  perform public.exigir_permiso('proveedores.gestionar');
  if coalesce(trim(p ->> 'nombre'), '') = '' then raise exception 'Escribe el nombre del proveedor o lugar.'; end if;
  if v_ruc <> '' and v_ruc !~ '^\d{13}$' then raise exception 'El RUC debe tener 13 números.'; end if;
  if exists (select 1 from unnest(v_dias) d where d not between 1 and 7) then raise exception 'Día de visita no válido.'; end if;
  if exists (select 1 from public.proveedores
             where public.normalizar(nombre) = public.normalizar(p ->> 'nombre') and id is distinct from v_id) then
    raise exception 'Ya existe un proveedor o lugar con ese nombre.';
  end if;

  if v_id is null then
    insert into public.proveedores (nombre, tipo, ruc, contacto, telefono, direccion, dias_visita, condiciones, notas)
    values (trim(p ->> 'nombre'), coalesce(nullif(p ->> 'tipo', ''), 'otro'), v_ruc,
            coalesce(trim(p ->> 'contacto'), ''), coalesce(trim(p ->> 'telefono'), ''),
            coalesce(trim(p ->> 'direccion'), ''), v_dias, coalesce(trim(p ->> 'condiciones'), ''),
            coalesce(trim(p ->> 'notas'), ''))
    returning id into v_id;
  else
    update public.proveedores
       set nombre = trim(p ->> 'nombre'), tipo = coalesce(nullif(p ->> 'tipo', ''), tipo), ruc = v_ruc,
           contacto = coalesce(trim(p ->> 'contacto'), ''), telefono = coalesce(trim(p ->> 'telefono'), ''),
           direccion = coalesce(trim(p ->> 'direccion'), ''), dias_visita = v_dias,
           condiciones = coalesce(trim(p ->> 'condiciones'), ''), notas = coalesce(trim(p ->> 'notas'), ''),
           activo = coalesce((p ->> 'activo')::boolean, activo)
     where id = v_id;
    if not found then raise exception 'No se encontró el proveedor.'; end if;
  end if;
  perform public.registrar_evento(auth.uid(), 'guardar_proveedor', 'proveedor', v_id::text, p);
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Viajes de compras
-- -----------------------------------------------------------------------------
create table public.viajes (
  id           uuid primary key, -- lo genera el celular
  inicio       timestamptz not null default now(),
  estado       text not null default 'en_curso' check (estado in ('en_curso', 'recibido', 'anulado')),
  usuario_id   uuid references public.perfiles (id) on delete set null,
  recibido_en  timestamptz,
  recibido_por uuid references public.perfiles (id) on delete set null,
  nota         text not null default ''
);

-- Lista de lo que hay que comprar en el viaje (se va tachando).
create table public.viaje_lista (
  viaje_id    uuid not null references public.viajes (id) on delete cascade,
  producto_id uuid not null references public.productos (id) on delete cascade,
  cantidad    numeric(12, 3), -- sugerida, en unidad base
  tachado     boolean not null default false,
  primary key (viaje_id, producto_id)
);

-- -----------------------------------------------------------------------------
-- Compras
-- -----------------------------------------------------------------------------
create table public.compras (
  id             uuid primary key, -- lo genera el dispositivo
  fecha          timestamptz not null default now(),
  proveedor_id   uuid references public.proveedores (id),
  viaje_id       uuid references public.viajes (id),
  estado         text not null check (estado in ('por_recibir', 'recibida', 'anulada')),
  con_factura    boolean not null default false,
  numero_factura text not null default '',
  foto_ruta      text,
  pago           text not null check (pago in ('contado', 'credito')),
  cuenta_id      uuid references public.cuentas_dinero (id),
  vence          date,
  total          numeric(12, 4) not null check (total >= 0),
  nota           text not null default '',
  usuario_id     uuid references public.perfiles (id) on delete set null,
  recibida_en    timestamptz,
  recibida_por   uuid references public.perfiles (id) on delete set null,
  check (pago = 'credito' or cuenta_id is not null)
);
create index compras_fecha on public.compras (fecha desc);
create index compras_viaje on public.compras (viaje_id);
create index compras_proveedor on public.compras (proveedor_id, fecha desc);

-- Cada línea está en la presentación comprada (2 jabas); el stock se mueve en unidad base.
create table public.compra_lineas (
  id              bigint generated always as identity primary key,
  compra_id       uuid not null references public.compras (id) on delete cascade,
  producto_id     uuid not null references public.productos (id),
  presentacion_id uuid not null references public.presentaciones (id),
  factor          numeric(12, 3) not null check (factor > 0),
  cantidad        numeric(12, 3) not null check (cantidad >= 0),
  costo_total     numeric(12, 4) not null check (costo_total >= 0),
  bonificacion    numeric(12, 3) not null default 0 check (bonificacion >= 0),
  danados         numeric(12, 3) not null default 0 check (danados >= 0),
  recibido        numeric(12, 3) check (recibido >= 0), -- lo que de verdad llegó (si no, = cantidad)
  vence           date,
  check (cantidad > 0 or bonificacion > 0)
);
create index compra_lineas_compra on public.compra_lineas (compra_id);
create index compra_lineas_producto on public.compra_lineas (producto_id);

create table public.pagos_proveedor (
  id         bigint generated always as identity primary key,
  compra_id  uuid not null references public.compras (id),
  fecha      timestamptz not null default now(),
  monto      numeric(12, 4) not null check (monto > 0),
  cuenta_id  uuid not null references public.cuentas_dinero (id),
  nota       text not null default '',
  usuario_id uuid references public.perfiles (id) on delete set null
);
create index pagos_proveedor_compra on public.pagos_proveedor (compra_id);

-- -----------------------------------------------------------------------------
-- Lotes con fecha de caducidad. Lo que sale del stock se descuenta primero del
-- lote que vence antes; los lotes nunca suman más que el stock.
-- -----------------------------------------------------------------------------
create table public.lotes (
  id               bigint generated always as identity primary key,
  producto_id      uuid not null references public.productos (id) on delete cascade,
  vence            date not null,
  cantidad         numeric(12, 3) not null check (cantidad >= 0),
  cantidad_inicial numeric(12, 3) not null check (cantidad_inicial > 0),
  compra_id        uuid references public.compras (id) on delete set null,
  creado_en        timestamptz not null default now()
);
create index lotes_vigentes on public.lotes (producto_id, vence) where cantidad > 0;

create function public.cuadrar_lotes() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_exceso numeric;
  v_lote record;
begin
  select coalesce(sum(l.cantidad), 0) - greatest(coalesce(max(e.cantidad), 0), 0) into v_exceso
  from public.lotes l
  left join public.existencias e on e.producto_id = l.producto_id
  where l.producto_id = new.producto_id and l.cantidad > 0;
  if v_exceso <= 0 then return null; end if;
  for v_lote in
    select id, cantidad from public.lotes
    where producto_id = new.producto_id and cantidad > 0
    order by vence, id
  loop
    exit when v_exceso <= 0;
    update public.lotes set cantidad = cantidad - least(cantidad, v_exceso) where id = v_lote.id;
    v_exceso := v_exceso - least(v_lote.cantidad, v_exceso);
  end loop;
  return null;
end;
$$;
create trigger cuadrar_lotes after insert on public.movimientos_stock
  for each row when (new.cantidad < 0) execute function public.cuadrar_lotes();

-- Registrar a mano un lote de algo que ya está en la tienda (ej. la leche de la refri).
create function public.registrar_lote(p_producto uuid, p_vence date, p_cantidad numeric) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_libre numeric;
begin
  perform public.exigir_permiso('inventario.ajustar');
  if p_vence is null then raise exception 'Escribe la fecha de caducidad.'; end if;
  if p_cantidad is null or p_cantidad <= 0 then raise exception 'Escribe una cantidad mayor que 0.'; end if;
  select coalesce(max(e.cantidad), 0) - coalesce((select sum(cantidad) from public.lotes where producto_id = p_producto), 0)
    into v_libre from public.existencias e where e.producto_id = p_producto;
  if coalesce(v_libre, 0) < p_cantidad then
    raise exception 'Solo hay % sin fecha anotada. Si llegó más, regístralo como compra.', greatest(coalesce(v_libre, 0), 0);
  end if;
  insert into public.lotes (producto_id, vence, cantidad, cantidad_inicial) values (p_producto, p_vence, p_cantidad, p_cantidad);
  update public.productos set maneja_caducidad = true where id = p_producto and not maneja_caducidad;
end;
$$;

-- -----------------------------------------------------------------------------
-- Entrada al stock de una compra (uso interno). Devuelve los productos cuyo costo
-- subió y si en otro lugar estaba más barato.
-- -----------------------------------------------------------------------------
create function public.entrar_compra(p_compra uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_linea record;
  v_unidades numeric;
  v_costo numeric;
  v_antes numeric;
  v_barato record;
  v_avisos jsonb := '[]';
  v_lugar text;
begin
  select coalesce(p.nombre, '') into v_lugar
  from public.compras c left join public.proveedores p on p.id = c.proveedor_id where c.id = p_compra;

  for v_linea in
    select l.*, pr.nombre as producto
    from public.compra_lineas l join public.productos pr on pr.id = l.producto_id
    where l.compra_id = p_compra order by l.id
  loop
    v_unidades := round(coalesce(v_linea.recibido, v_linea.cantidad) * v_linea.factor, 3);
    v_costo := case when v_linea.cantidad > 0
                    then round(v_linea.costo_total / (v_linea.cantidad * v_linea.factor), 4) end;
    select ultimo_costo into v_antes from public.producto_costos where producto_id = v_linea.producto_id;

    if v_unidades > 0 then
      perform public.registrar_movimiento(v_linea.producto_id, 'compra', v_unidades, v_costo, 'compra', p_compra::text,
        case when v_lugar <> '' then 'Compra en ' || v_lugar else 'Compra' end);
    end if;
    if v_linea.bonificacion > 0 then
      perform public.registrar_movimiento(v_linea.producto_id, 'bonificacion', round(v_linea.bonificacion * v_linea.factor, 3), 0,
        'compra', p_compra::text, 'Bonificación');
    end if;
    if v_linea.danados > 0 then
      perform public.registrar_movimiento(v_linea.producto_id, 'merma', -round(v_linea.danados * v_linea.factor, 3), null,
        'compra', p_compra::text, 'Llegó dañado');
    end if;
    if v_linea.vence is not null and v_unidades + v_linea.bonificacion * v_linea.factor - v_linea.danados * v_linea.factor > 0 then
      insert into public.lotes (producto_id, vence, cantidad, cantidad_inicial, compra_id)
      values (v_linea.producto_id, v_linea.vence,
              round(v_unidades + (v_linea.bonificacion - v_linea.danados) * v_linea.factor, 3),
              round(v_unidades + (v_linea.bonificacion - v_linea.danados) * v_linea.factor, 3), p_compra);
      update public.productos set maneja_caducidad = true where id = v_linea.producto_id and not maneja_caducidad;
    end if;

    if v_costo is not null and v_costo > 0 then
      if v_antes is distinct from v_costo then
        insert into public.historial_precios (producto_id, tipo, antes, despues, usuario_id, origen)
        values (v_linea.producto_id, 'costo', v_antes, v_costo, auth.uid(), 'compra');
      end if;
      -- ¿Más barato en otro lugar? (último precio pagado en cada lugar)
      select x.lugar, x.costo into v_barato from (
        select distinct on (c.proveedor_id) p.nombre as lugar,
               round(l.costo_total / (l.cantidad * l.factor), 4) as costo
        from public.compra_lineas l
        join public.compras c on c.id = l.compra_id
        join public.proveedores p on p.id = c.proveedor_id
        where l.producto_id = v_linea.producto_id and l.cantidad > 0 and c.estado <> 'anulada'
          and c.id <> p_compra and c.proveedor_id is distinct from (select proveedor_id from public.compras where id = p_compra)
        order by c.proveedor_id, c.fecha desc
      ) x order by x.costo limit 1;
      if (v_antes is not null and v_costo > v_antes) or (v_barato.costo is not null and v_barato.costo < v_costo) then
        v_avisos := v_avisos || jsonb_build_object(
          'producto_id', v_linea.producto_id, 'producto', v_linea.producto,
          'antes', v_antes, 'ahora', v_costo,
          'mas_barato_en', v_barato.lugar, 'costo_mas_barato', v_barato.costo);
      end if;
    end if;
  end loop;

  update public.compras set estado = 'recibida', recibida_en = now(), recibida_por = auth.uid() where id = p_compra;
  return v_avisos;
end;
$$;

-- Valida y guarda las líneas de una compra (uso interno). Devuelve la suma de costos.
create function public.guardar_lineas_compra(p_compra uuid, p_lineas jsonb) returns numeric
language plpgsql security definer set search_path = '' as $$
declare
  v_l jsonb;
  v_factor numeric;
  v_cantidad numeric;
  v_bonif numeric;
  v_costo numeric;
  v_suma numeric := 0;
begin
  delete from public.compra_lineas where compra_id = p_compra;
  for v_l in select * from jsonb_array_elements(coalesce(p_lineas, '[]')) loop
    select factor into v_factor from public.presentaciones
    where id = (v_l ->> 'presentacion_id')::uuid and producto_id = (v_l ->> 'producto_id')::uuid;
    if not found then raise exception 'Una línea de la compra tiene un producto o presentación que no existe.'; end if;
    v_cantidad := coalesce(nullif(v_l ->> 'cantidad', '')::numeric, 0);
    v_bonif := coalesce(nullif(v_l ->> 'bonificacion', '')::numeric, 0);
    v_costo := coalesce(nullif(v_l ->> 'costo_total', '')::numeric, 0);
    if v_cantidad < 0 or v_bonif < 0 or v_costo < 0 then raise exception 'Las cantidades y costos no pueden ser negativos.'; end if;
    if v_cantidad = 0 and v_bonif = 0 then raise exception 'Cada línea necesita una cantidad.'; end if;
    if coalesce(nullif(v_l ->> 'danados', '')::numeric, 0) > v_cantidad + v_bonif then
      raise exception 'Los dañados no pueden ser más que lo que llegó.';
    end if;
    insert into public.compra_lineas
      (compra_id, producto_id, presentacion_id, factor, cantidad, costo_total, bonificacion, danados, vence)
    values (p_compra, (v_l ->> 'producto_id')::uuid, (v_l ->> 'presentacion_id')::uuid, v_factor, v_cantidad,
            round(v_costo, 4), v_bonif, coalesce(nullif(v_l ->> 'danados', '')::numeric, 0),
            nullif(v_l ->> 'vence', '')::date);
    v_suma := v_suma + v_costo;
  end loop;
  return round(v_suma, 4);
end;
$$;

-- -----------------------------------------------------------------------------
-- Registrar una compra (suelta, distribuidor o dentro de un viaje).
-- Sin viaje: entra al stock de una vez. En un viaje: queda «por recibir» y entra
-- al stock al «Recibir en tienda». El dinero sale en el momento (si es de contado).
-- En un viaje se puede guardar solo el total y detallar después.
-- -----------------------------------------------------------------------------
create function public.registrar_compra(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := (p ->> 'id')::uuid;
  v_viaje uuid := nullif(p ->> 'viaje_id', '')::uuid;
  v_pago text := coalesce(nullif(p ->> 'pago', ''), 'contado');
  v_cuenta uuid := nullif(p ->> 'cuenta_id', '')::uuid;
  v_suma numeric;
  v_total numeric;
  v_hay_lineas boolean := jsonb_array_length(coalesce(p -> 'lineas', '[]')) > 0;
  v_avisos jsonb := '[]';
  v_lugar text;
begin
  if not (public.tiene_permiso('compras.registrar') or public.tiene_permiso('compras.recibir')) then
    raise exception 'No tienes permiso para hacer esto.' using errcode = '42501';
  end if;
  if v_id is null then raise exception 'Falta el identificador de la compra.'; end if;
  -- Reintento del mismo dispositivo (se fue la señal): no se duplica.
  if exists (select 1 from public.compras where id = v_id) then
    return jsonb_build_object('id', v_id, 'repetida', true, 'avisos', '[]'::jsonb);
  end if;
  if v_viaje is not null and not exists (select 1 from public.viajes where id = v_viaje and estado = 'en_curso') then
    raise exception 'Ese viaje ya terminó.';
  end if;
  if v_pago not in ('contado', 'credito') then raise exception 'Forma de pago no válida.'; end if;
  if v_pago = 'contado' and v_cuenta is null then raise exception 'Elige de qué cuenta salió el dinero.'; end if;
  if v_pago = 'credito' and nullif(p ->> 'proveedor_id', '') is null then
    raise exception 'Para comprar a crédito elige el proveedor.';
  end if;
  if not v_hay_lineas and v_viaje is null then raise exception 'Agrega al menos un producto.'; end if;

  insert into public.compras (id, fecha, proveedor_id, viaje_id, estado, con_factura, numero_factura, foto_ruta,
                              pago, cuenta_id, vence, total, nota, usuario_id)
  values (v_id, coalesce(nullif(p ->> 'fecha', '')::timestamptz, now()), nullif(p ->> 'proveedor_id', '')::uuid, v_viaje,
          'por_recibir', coalesce((p ->> 'con_factura')::boolean, false), coalesce(trim(p ->> 'numero_factura'), ''),
          nullif(p ->> 'foto_ruta', ''), v_pago, case when v_pago = 'contado' then v_cuenta end,
          case when v_pago = 'credito' then nullif(p ->> 'vence', '')::date end, 0,
          coalesce(trim(p ->> 'nota'), ''), auth.uid());

  v_suma := public.guardar_lineas_compra(v_id, p -> 'lineas');
  v_total := case when v_hay_lineas then v_suma else round(coalesce(nullif(p ->> 'total', '')::numeric, 0), 4) end;
  if v_total <= 0 and not v_hay_lineas then raise exception 'Escribe el total de la compra.'; end if;
  update public.compras set total = v_total where id = v_id;

  select coalesce(nullif(nombre, ''), 'Compra') into v_lugar from public.proveedores where id = nullif(p ->> 'proveedor_id', '')::uuid;
  if v_pago = 'contado' and v_total > 0 then
    perform public.registrar_dinero(v_cuenta, -v_total, 'compra', 'compra', v_id::text, coalesce('Compra en ' || v_lugar, 'Compra'));
  end if;
  if v_viaje is null then
    v_avisos := public.entrar_compra(v_id);
  end if;
  perform public.registrar_evento(auth.uid(), 'registrar_compra', 'compra', v_id::text,
    jsonb_build_object('total', v_total, 'pago', v_pago, 'viaje', v_viaje, 'lineas', jsonb_array_length(coalesce(p -> 'lineas', '[]'))));
  return jsonb_build_object('id', v_id, 'repetida', false, 'avisos', v_avisos);
end;
$$;

-- Detallar o corregir las líneas de una compra que todavía no entra al stock.
-- El total ya pagado no cambia: las líneas tienen que sumar ese total.
create function public.detallar_compra(p_compra uuid, p_lineas jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_total numeric;
  v_suma numeric;
begin
  perform public.exigir_permiso('compras.registrar');
  select total into v_total from public.compras where id = p_compra and estado = 'por_recibir' for update;
  if not found then raise exception 'Esa compra ya entró al stock y no se puede cambiar.'; end if;
  v_suma := public.guardar_lineas_compra(p_compra, p_lineas);
  if abs(v_suma - v_total) >= 0.01 then
    raise exception 'Los productos suman $% pero pagaste $%. Revisa los costos.', round(v_suma, 2), round(v_total, 2);
  end if;
end;
$$;

-- Pagar (o abonar) una compra a crédito.
create function public.pagar_compra(p jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_compra uuid := (p ->> 'compra_id')::uuid;
  v_monto numeric := nullif(p ->> 'monto', '')::numeric;
  v_cuenta uuid := nullif(p ->> 'cuenta_id', '')::uuid;
  v_saldo numeric;
  v_lugar text;
begin
  perform public.exigir_permiso('compras.registrar');
  select c.total - coalesce((select sum(monto) from public.pagos_proveedor where compra_id = c.id), 0), coalesce(pr.nombre, '')
    into v_saldo, v_lugar
  from public.compras c left join public.proveedores pr on pr.id = c.proveedor_id
  where c.id = v_compra and c.pago = 'credito' and c.estado <> 'anulada' for update of c;
  if not found then raise exception 'No se encontró esa compra a crédito.'; end if;
  if v_monto is null or v_monto <= 0 then raise exception 'Escribe un monto mayor que 0.'; end if;
  if v_monto > v_saldo + 0.001 then raise exception 'Solo se deben $%.', round(v_saldo, 2); end if;
  if v_cuenta is null then raise exception 'Elige de qué cuenta sale el pago.'; end if;
  insert into public.pagos_proveedor (compra_id, monto, cuenta_id, nota, usuario_id)
  values (v_compra, round(v_monto, 4), v_cuenta, coalesce(trim(p ->> 'nota'), ''), auth.uid());
  perform public.registrar_dinero(v_cuenta, -v_monto, 'pago_proveedor', 'compra', v_compra::text, 'Pago a ' || v_lugar);
  perform public.registrar_evento(auth.uid(), 'pagar_compra', 'compra', v_compra::text, p);
end;
$$;

create function public.cuentas_por_pagar()
returns table (compra_id uuid, fecha timestamptz, proveedor text, telefono text, numero_factura text,
               total numeric, pagado numeric, saldo numeric, vence date)
language sql stable security definer set search_path = '' as $$
  select c.id, c.fecha, coalesce(p.nombre, ''), coalesce(p.telefono, ''), c.numero_factura, c.total,
         coalesce(sum(pg.monto), 0), c.total - coalesce(sum(pg.monto), 0), c.vence
  from public.compras c
  left join public.proveedores p on p.id = c.proveedor_id
  left join public.pagos_proveedor pg on pg.compra_id = c.id
  where c.pago = 'credito' and c.estado <> 'anulada'
    and (public.tiene_permiso('compras.registrar') or public.tiene_permiso('costos.ver'))
  group by c.id, p.nombre, p.telefono
  having c.total - coalesce(sum(pg.monto), 0) > 0.001
  order by c.vence nulls last, c.fecha;
$$;

-- Comparador: último precio pagado (por unidad base) en cada lugar.
create function public.precios_por_lugar(p_producto uuid)
returns table (proveedor_id uuid, lugar text, costo numeric, fecha timestamptz)
language sql stable security definer set search_path = '' as $$
  select x.proveedor_id, x.lugar, x.costo, x.fecha from (
    select distinct on (c.proveedor_id) c.proveedor_id, coalesce(p.nombre, 'Sin lugar') as lugar,
           round(l.costo_total / (l.cantidad * l.factor), 4) as costo, c.fecha
    from public.compra_lineas l
    join public.compras c on c.id = l.compra_id
    left join public.proveedores p on p.id = c.proveedor_id
    where l.producto_id = p_producto and l.cantidad > 0 and c.estado <> 'anulada'
      and public.tiene_permiso('costos.ver')
    order by c.proveedor_id, c.fecha desc
  ) x order by x.costo;
$$;

-- -----------------------------------------------------------------------------
-- Gastos (lo básico para el viaje; la fase 6 agrega recurrentes y reportes)
-- -----------------------------------------------------------------------------
create table public.categorias_gasto (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null check (trim(nombre) <> ''),
  es_transporte boolean not null default false,
  activa        boolean not null default true,
  orden         int not null default 0
);
create unique index categorias_gasto_nombre on public.categorias_gasto (public.normalizar(nombre));
insert into public.categorias_gasto (nombre, es_transporte, orden) values
  ('Gasolina', true, 1),
  ('Parqueadero', true, 2),
  ('Peajes', true, 3),
  ('Cargador o estibador', true, 4),
  ('Fundas y empaques', false, 5),
  ('Otros del viaje', true, 6),
  ('Arriendo', false, 10),
  ('Luz', false, 11),
  ('Agua', false, 12),
  ('Internet y teléfono', false, 13),
  ('Sueldos', false, 14),
  ('Otros', false, 99);

create table public.gastos (
  id           uuid primary key, -- lo genera el dispositivo
  fecha        timestamptz not null default now(),
  categoria_id uuid not null references public.categorias_gasto (id),
  descripcion  text not null default '',
  monto        numeric(12, 4) not null check (monto > 0),
  cuenta_id    uuid not null references public.cuentas_dinero (id),
  viaje_id     uuid references public.viajes (id),
  foto_ruta    text,
  usuario_id   uuid references public.perfiles (id) on delete set null
);
create index gastos_fecha on public.gastos (fecha desc);
create index gastos_viaje on public.gastos (viaje_id);

create function public.registrar_gasto(p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := (p ->> 'id')::uuid;
  v_viaje uuid := nullif(p ->> 'viaje_id', '')::uuid;
  v_monto numeric := nullif(p ->> 'monto', '')::numeric;
  v_categoria text;
begin
  if not (public.tiene_permiso('gastos.registrar') or (v_viaje is not null and public.tiene_permiso('compras.registrar'))) then
    raise exception 'No tienes permiso para hacer esto.' using errcode = '42501';
  end if;
  if v_id is null then raise exception 'Falta el identificador del gasto.'; end if;
  if exists (select 1 from public.gastos where id = v_id) then return v_id; end if;
  if v_monto is null or v_monto <= 0 then raise exception 'Escribe un monto mayor que 0.'; end if;
  select nombre into v_categoria from public.categorias_gasto where id = (p ->> 'categoria_id')::uuid;
  if not found then raise exception 'Elige qué fue el gasto.'; end if;
  if v_viaje is not null and not exists (select 1 from public.viajes where id = v_viaje and estado = 'en_curso') then
    raise exception 'Ese viaje ya terminó.';
  end if;
  insert into public.gastos (id, fecha, categoria_id, descripcion, monto, cuenta_id, viaje_id, foto_ruta, usuario_id)
  values (v_id, coalesce(nullif(p ->> 'fecha', '')::timestamptz, now()), (p ->> 'categoria_id')::uuid,
          coalesce(trim(p ->> 'descripcion'), ''), round(v_monto, 4), (p ->> 'cuenta_id')::uuid, v_viaje,
          nullif(p ->> 'foto_ruta', ''), auth.uid());
  perform public.registrar_dinero((p ->> 'cuenta_id')::uuid, -v_monto, 'gasto', 'gasto', v_id::text,
    v_categoria || coalesce(nullif(' · ' || trim(p ->> 'descripcion'), ' · '), ''));
  perform public.registrar_evento(auth.uid(), 'registrar_gasto', 'gasto', v_id::text, p);
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Viaje: iniciar, tachar y recibir en tienda
-- -----------------------------------------------------------------------------
create function public.iniciar_viaje(p_id uuid, p_lista jsonb default '[]') returns uuid
language plpgsql security definer set search_path = '' as $$
begin
  perform public.exigir_permiso('compras.registrar');
  if exists (select 1 from public.viajes where id = p_id) then return p_id; end if;
  insert into public.viajes (id, usuario_id) values (p_id, auth.uid());
  insert into public.viaje_lista (viaje_id, producto_id, cantidad)
  select p_id, (x ->> 'producto_id')::uuid, nullif(x ->> 'cantidad', '')::numeric
  from jsonb_array_elements(coalesce(p_lista, '[]')) x
  on conflict do nothing;
  perform public.registrar_evento(auth.uid(), 'iniciar_viaje', 'viaje', p_id::text, '{}');
  return p_id;
end;
$$;

create function public.marcar_lista_viaje(p_viaje uuid, p_producto uuid, p_tachado boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.exigir_permiso('compras.registrar');
  insert into public.viaje_lista (viaje_id, producto_id, tachado) values (p_viaje, p_producto, p_tachado)
  on conflict (viaje_id, producto_id) do update set tachado = excluded.tachado;
end;
$$;

-- Al llegar a la tienda: confirma cuánto llegó y cuánto vino dañado, y todo entra al stock.
-- p_lineas: [{ linea_id, recibido, danados }] (las que no vengan se reciben completas).
create function public.recibir_viaje(p_viaje uuid, p_lineas jsonb default '[]') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_x jsonb;
  v_compra record;
  v_avisos jsonb := '[]';
  v_sin_detalle text;
begin
  perform public.exigir_permiso('compras.registrar');
  perform 1 from public.viajes where id = p_viaje and estado = 'en_curso' for update;
  if not found then raise exception 'Ese viaje ya fue recibido.'; end if;

  select string_agg(coalesce(p.nombre, 'una compra'), ', ') into v_sin_detalle
  from public.compras c left join public.proveedores p on p.id = c.proveedor_id
  where c.viaje_id = p_viaje and c.estado = 'por_recibir'
    and not exists (select 1 from public.compra_lineas l where l.compra_id = c.id);
  if v_sin_detalle is not null then
    raise exception 'Falta detallar qué compraste en: %.', v_sin_detalle;
  end if;

  for v_x in select * from jsonb_array_elements(coalesce(p_lineas, '[]')) loop
    update public.compra_lineas l
       set recibido = nullif(v_x ->> 'recibido', '')::numeric,
           danados = coalesce(nullif(v_x ->> 'danados', '')::numeric, l.danados)
      from public.compras c
     where l.id = (v_x ->> 'linea_id')::bigint and c.id = l.compra_id and c.viaje_id = p_viaje;
  end loop;

  for v_compra in select id from public.compras where viaje_id = p_viaje and estado = 'por_recibir' order by fecha loop
    v_avisos := v_avisos || public.entrar_compra(v_compra.id);
  end loop;
  update public.viajes set estado = 'recibido', recibido_en = now(), recibido_por = auth.uid() where id = p_viaje;
  perform public.registrar_evento(auth.uid(), 'recibir_viaje', 'viaje', p_viaje::text, '{}');
  return v_avisos;
end;
$$;

-- -----------------------------------------------------------------------------
-- Seguridad
-- -----------------------------------------------------------------------------
alter table public.cuentas_dinero enable row level security;
alter table public.movimientos_dinero enable row level security;
alter table public.proveedores enable row level security;
alter table public.viajes enable row level security;
alter table public.viaje_lista enable row level security;
alter table public.compras enable row level security;
alter table public.compra_lineas enable row level security;
alter table public.pagos_proveedor enable row level security;
alter table public.lotes enable row level security;
alter table public.categorias_gasto enable row level security;
alter table public.gastos enable row level security;

create policy "ver cuentas" on public.cuentas_dinero for select to authenticated using (true);
create policy "libro de dinero" on public.movimientos_dinero for select to authenticated
  using (public.tiene_permiso('dinero.ver'));
create policy "ver proveedores" on public.proveedores for select to authenticated
  using (public.tiene_permiso('compras.registrar') or public.tiene_permiso('compras.recibir')
         or public.tiene_permiso('proveedores.gestionar') or public.tiene_permiso('costos.ver'));
create policy "ver viajes" on public.viajes for select to authenticated using (public.tiene_permiso('compras.registrar'));
create policy "ver lista del viaje" on public.viaje_lista for select to authenticated using (public.tiene_permiso('compras.registrar'));
create policy "ver compras" on public.compras for select to authenticated
  using (public.tiene_permiso('compras.registrar') or public.tiene_permiso('costos.ver'));
create policy "ver líneas de compra" on public.compra_lineas for select to authenticated
  using (public.tiene_permiso('compras.registrar') or public.tiene_permiso('costos.ver'));
create policy "ver pagos a proveedores" on public.pagos_proveedor for select to authenticated
  using (public.tiene_permiso('compras.registrar') or public.tiene_permiso('costos.ver'));
create policy "ver lotes" on public.lotes for select to authenticated using (public.tiene_permiso('productos.ver'));
create policy "ver categorías de gasto" on public.categorias_gasto for select to authenticated using (true);
create policy "ver gastos" on public.gastos for select to authenticated
  using (public.tiene_permiso('gastos.registrar') or public.tiene_permiso('reportes.ver')
         or (viaje_id is not null and public.tiene_permiso('compras.registrar')));

revoke insert, update, delete, truncate on
  public.cuentas_dinero, public.movimientos_dinero, public.proveedores, public.viajes, public.viaje_lista,
  public.compras, public.compra_lineas, public.pagos_proveedor, public.lotes, public.categorias_gasto, public.gastos
from anon, authenticated;
revoke all on
  public.cuentas_dinero, public.movimientos_dinero, public.proveedores, public.viajes, public.viaje_lista,
  public.compras, public.compra_lineas, public.pagos_proveedor, public.lotes, public.categorias_gasto, public.gastos
from anon;

revoke execute on function
  public.registrar_dinero(uuid, numeric, text, text, text, text),
  public.entrar_compra(uuid),
  public.guardar_lineas_compra(uuid, jsonb),
  public.cuadrar_lotes()
from public, anon, authenticated;

revoke execute on function
  public.saldos_cuentas(), public.guardar_cuenta(jsonb), public.mover_dinero(jsonb), public.guardar_proveedor(jsonb),
  public.registrar_lote(uuid, date, numeric), public.registrar_compra(jsonb), public.detallar_compra(uuid, jsonb),
  public.pagar_compra(jsonb), public.cuentas_por_pagar(), public.precios_por_lugar(uuid), public.registrar_gasto(jsonb),
  public.iniciar_viaje(uuid, jsonb), public.marcar_lista_viaje(uuid, uuid, boolean), public.recibir_viaje(uuid, jsonb)
from public, anon;
grant execute on function
  public.saldos_cuentas(), public.guardar_cuenta(jsonb), public.mover_dinero(jsonb), public.guardar_proveedor(jsonb),
  public.registrar_lote(uuid, date, numeric), public.registrar_compra(jsonb), public.detallar_compra(uuid, jsonb),
  public.pagar_compra(jsonb), public.cuentas_por_pagar(), public.precios_por_lugar(uuid), public.registrar_gasto(jsonb),
  public.iniciar_viaje(uuid, jsonb), public.marcar_lista_viaje(uuid, uuid, boolean), public.recibir_viaje(uuid, jsonb)
to authenticated;

-- Fotos de recibos y facturas (privadas: solo quien registra compras o gastos).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recibos', 'recibos', false, 3145728, array['image/jpeg', 'image/png', 'image/webp']);
create policy "subir recibos" on storage.objects for insert to authenticated
  with check (bucket_id = 'recibos' and (public.tiene_permiso('compras.registrar') or public.tiene_permiso('compras.recibir')
                                         or public.tiene_permiso('gastos.registrar')));
create policy "ver recibos" on storage.objects for select to authenticated
  using (bucket_id = 'recibos' and (public.tiene_permiso('compras.registrar') or public.tiene_permiso('costos.ver')
                                    or public.tiene_permiso('gastos.registrar')));
