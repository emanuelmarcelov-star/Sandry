-- =============================================================================
-- Fase 5 — Punto de venta: formas de pago, caja (apertura, cierre y arqueo),
-- clientes y fiados, ventas con su costo del momento, anulaciones y
-- devoluciones con autorización, y productos pendientes.
--
-- Decisiones (29/10/2026): una sola caja para todas; sin stock se deja vender
-- con aviso (configurable); pagos: efectivo, Deuna, transferencia y fiado.
-- =============================================================================

insert into public.permisos (codigo, grupo, descripcion, orden) values
  ('clientes.fiar_sobre_limite', 'Clientes', 'Fiar por encima del límite del cliente', 31);

alter table public.ajustes
  add column venta_sin_stock text not null default 'avisar' check (venta_sin_stock in ('avisar', 'bloquear')),
  add column deuna_qr_ruta text,
  add column banco jsonb not null default '{}', -- { banco, tipo, numero, titular, identificacion }
  add column ticket_ancho int not null default 80 check (ticket_ancho in (58, 80)),
  add column ticket_mensaje text not null default '¡Gracias por su compra!',
  add column alcohol_desde time,
  add column alcohol_hasta time;

create function public.guardar_ajustes_venta(p jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.exigir_permiso('ajustes.gestionar');
  update public.ajustes set
    venta_sin_stock = coalesce(nullif(p ->> 'venta_sin_stock', ''), venta_sin_stock),
    deuna_qr_ruta = case when p ? 'deuna_qr_ruta' then nullif(p ->> 'deuna_qr_ruta', '') else deuna_qr_ruta end,
    banco = coalesce(p -> 'banco', banco),
    ticket_ancho = coalesce(nullif(p ->> 'ticket_ancho', '')::int, ticket_ancho),
    ticket_mensaje = coalesce(p ->> 'ticket_mensaje', ticket_mensaje),
    alcohol_desde = case when p ? 'alcohol_desde' then nullif(p ->> 'alcohol_desde', '')::time else alcohol_desde end,
    alcohol_hasta = case when p ? 'alcohol_hasta' then nullif(p ->> 'alcohol_hasta', '')::time else alcohol_hasta end,
    actualizado_en = now()
  where id = 1;
  perform public.registrar_evento(auth.uid(), 'cambiar_ajustes', 'ajustes', '1', p);
end;
$$;

-- -----------------------------------------------------------------------------
-- Formas de pago (cada una entra a una cuenta de dinero; el fiado no)
-- -----------------------------------------------------------------------------
create table public.formas_pago (
  id         text primary key,
  nombre     text not null,
  cuenta_id  uuid references public.cuentas_dinero (id),
  activa     boolean not null default true,
  orden      int not null default 0,
  codigo_sri text not null default '01'
);
insert into public.formas_pago (id, nombre, cuenta_id, activa, orden, codigo_sri) values
  ('efectivo', 'Efectivo', (select id from public.cuentas_dinero where tipo = 'caja' order by orden limit 1), true, 1, '01'),
  ('deuna', 'Deuna', (select id from public.cuentas_dinero where tipo = 'deuna' order by orden limit 1), true, 2, '20'),
  ('transferencia', 'Transferencia', (select id from public.cuentas_dinero where tipo = 'banco' order by orden limit 1), true, 3, '20'),
  ('tarjeta', 'Tarjeta', (select id from public.cuentas_dinero where tipo = 'banco' order by orden limit 1), false, 4, '19'),
  ('fiado', 'Fiado', null, true, 5, '01');

create function public.guardar_forma_pago(p_id text, p_cuenta uuid, p_activa boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.exigir_permiso('ajustes.gestionar');
  update public.formas_pago set cuenta_id = case when p_id = 'fiado' then null else p_cuenta end, activa = p_activa where id = p_id;
  if not found then raise exception 'Forma de pago no válida.'; end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Autorización con PIN (anular, descuento mayor, fiar sobre el límite).
-- 5 PIN equivocados en 15 minutos bloquean a quien está pidiendo.
-- -----------------------------------------------------------------------------
create table public.intentos_autorizacion (
  id         bigint generated always as identity primary key,
  usuario_id uuid not null,
  fecha      timestamptz not null default now()
);

create function public.usuario_tiene_permiso(p_usuario uuid, p_permiso text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.perfiles pf join public.roles r on r.id = pf.rol_id
    where pf.id = p_usuario and pf.estado = 'activo'
      and (r.es_administradora or exists (select 1 from public.rol_permisos rp where rp.rol_id = r.id and rp.permiso = p_permiso))
  );
$$;

-- Devuelve quién autoriza (yo mismo si tengo el permiso; si no, el dueño del PIN).
create function public.autorizar(p_permiso text, p_pin text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_usuario uuid;
begin
  if public.tiene_permiso(p_permiso) then return auth.uid(); end if;
  if coalesce(p_pin, '') = '' then
    raise exception 'Hace falta el PIN de la administradora.' using errcode = 'P0001', hint = 'pin';
  end if;
  if (select count(*) from public.intentos_autorizacion
      where usuario_id = auth.uid() and fecha > now() - interval '15 minutes') >= 5 then
    raise exception 'Demasiados PIN equivocados. Espera 15 minutos.';
  end if;
  select p.usuario_id into v_usuario
  from public.pines p
  where p.pin_hash = extensions.crypt(p_pin, p.pin_hash)
    and public.usuario_tiene_permiso(p.usuario_id, p_permiso)
  limit 1;
  if v_usuario is null then
    insert into public.intentos_autorizacion (usuario_id) values (auth.uid());
    raise exception 'PIN incorrecto.' using errcode = 'P0001', hint = 'pin';
  end if;
  return v_usuario;
end;
$$;

-- -----------------------------------------------------------------------------
-- Caja (una sola abierta a la vez)
-- -----------------------------------------------------------------------------
create table public.cajas (
  id           uuid primary key default gen_random_uuid(),
  abierta_por  uuid references public.perfiles (id) on delete set null,
  abierta_en   timestamptz not null default now(),
  fondo        numeric(12, 4) not null check (fondo >= 0),
  estado       text not null default 'abierta' check (estado in ('abierta', 'cerrada')),
  cerrada_por  uuid references public.perfiles (id) on delete set null,
  cerrada_en   timestamptz,
  conteo       jsonb,
  contado      numeric(12, 4),
  esperado     numeric(12, 4),
  diferencia   numeric(12, 4),
  nota         text not null default ''
);
create unique index cajas_una_abierta on public.cajas (estado) where estado = 'abierta';

create function public.cuenta_caja() returns uuid
language sql stable security definer set search_path = '' as $$
  select cuenta_id from public.formas_pago where id = 'efectivo';
$$;

create function public.saldo_cuenta(p_cuenta uuid) returns numeric
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(monto), 0) from public.movimientos_dinero where cuenta_id = p_cuenta;
$$;

-- Abre la caja con lo que se contó. Si no cuadra con la cuenta Caja, se corrige.
create function public.abrir_caja(p_fondo numeric) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_saldo numeric;
begin
  perform public.exigir_permiso('caja.abrir_cerrar');
  if p_fondo is null or p_fondo < 0 then raise exception 'Escribe cuánto dinero hay en la caja.'; end if;
  if exists (select 1 from public.cajas where estado = 'abierta') then raise exception 'La caja ya está abierta.'; end if;
  insert into public.cajas (abierta_por, fondo) values (auth.uid(), round(p_fondo, 4)) returning id into v_id;
  v_saldo := public.saldo_cuenta(public.cuenta_caja());
  if round(p_fondo - v_saldo, 4) <> 0 then
    perform public.registrar_dinero(public.cuenta_caja(), p_fondo - v_saldo, 'correccion', 'caja', v_id::text,
      case when p_fondo > v_saldo then 'Sobrante al abrir caja' else 'Faltante al abrir caja' end);
  end if;
  perform public.registrar_evento(auth.uid(), 'abrir_caja', 'caja', v_id::text, jsonb_build_object('fondo', p_fondo));
  return v_id;
end;
$$;

-- Resumen de la caja: lo vendido por forma de pago, abonos y el efectivo esperado.
create function public.resumen_caja(p_caja uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_caja public.cajas;
  v_resultado jsonb;
begin
  if not (public.tiene_permiso('caja.abrir_cerrar') or public.tiene_permiso('reportes.ver')) then
    raise exception 'No tienes permiso para hacer esto.' using errcode = '42501';
  end if;
  select * into v_caja from public.cajas
  where (p_caja is null and estado = 'abierta') or id = p_caja
  order by abierta_en desc limit 1;
  if not found then return null; end if;
  select jsonb_build_object(
    'id', v_caja.id, 'estado', v_caja.estado, 'abierta_en', v_caja.abierta_en, 'cerrada_en', v_caja.cerrada_en,
    'fondo', v_caja.fondo, 'contado', v_caja.contado, 'diferencia', v_caja.diferencia,
    'abierta_por', (select nombre_completo from public.perfiles where id = v_caja.abierta_por),
    'ventas', (select count(*) from public.ventas where caja_id = v_caja.id and estado = 'normal'),
    'total_ventas', (select coalesce(sum(total), 0) from public.ventas where caja_id = v_caja.id and estado = 'normal'),
    'por_forma', coalesce((
      select jsonb_object_agg(forma_pago_id, monto) from (
        select vp.forma_pago_id, sum(vp.monto) as monto
        from public.venta_pagos vp join public.ventas v on v.id = vp.venta_id
        where v.caja_id = v_caja.id and v.estado = 'normal'
        group by vp.forma_pago_id) x), '{}'),
    'abonos', (select coalesce(sum(monto), 0) from public.abonos where caja_id = v_caja.id),
    'esperado', case when v_caja.estado = 'abierta' then public.saldo_cuenta(public.cuenta_caja()) else v_caja.esperado end
  ) into v_resultado;
  return v_resultado;
end;
$$;

-- Cierra con el arqueo: p_conteo = { "20": 3, "0.25": 8, ... } (denominación → cantidad).
create function public.cerrar_caja(p_conteo jsonb, p_nota text default '') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_caja public.cajas;
  v_contado numeric := 0;
  v_esperado numeric;
  v_x record;
begin
  perform public.exigir_permiso('caja.abrir_cerrar');
  select * into v_caja from public.cajas where estado = 'abierta' for update;
  if not found then raise exception 'La caja no está abierta.'; end if;
  for v_x in select key, value from jsonb_each_text(coalesce(p_conteo, '{}')) loop
    if v_x.key::numeric not in (100, 50, 20, 10, 5, 2, 1, 0.5, 0.25, 0.1, 0.05, 0.01) then
      raise exception 'Denominación no válida: %.', v_x.key;
    end if;
    if nullif(v_x.value, '')::int < 0 then raise exception 'Las cantidades no pueden ser negativas.'; end if;
    v_contado := v_contado + v_x.key::numeric * coalesce(nullif(v_x.value, '')::int, 0);
  end loop;
  v_esperado := public.saldo_cuenta(public.cuenta_caja());
  if round(v_contado - v_esperado, 4) <> 0 then
    perform public.registrar_dinero(public.cuenta_caja(), v_contado - v_esperado, 'correccion', 'caja', v_caja.id::text,
      case when v_contado > v_esperado then 'Sobrante al cerrar caja' else 'Faltante al cerrar caja' end);
  end if;
  update public.cajas
     set estado = 'cerrada', cerrada_por = auth.uid(), cerrada_en = now(), conteo = p_conteo,
         contado = v_contado, esperado = v_esperado, diferencia = v_contado - v_esperado, nota = coalesce(p_nota, '')
   where id = v_caja.id;
  perform public.registrar_evento(auth.uid(), 'cerrar_caja', 'caja', v_caja.id::text,
    jsonb_build_object('contado', v_contado, 'esperado', v_esperado));
  return jsonb_build_object('id', v_caja.id, 'contado', v_contado, 'esperado', v_esperado, 'diferencia', v_contado - v_esperado);
end;
$$;

-- Solo la administradora (permiso caja.reabrir) y solo la última caja.
create function public.reabrir_caja() returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  perform public.exigir_permiso('caja.reabrir');
  if exists (select 1 from public.cajas where estado = 'abierta') then raise exception 'Ya hay una caja abierta.'; end if;
  select id into v_id from public.cajas order by abierta_en desc limit 1;
  if v_id is null then raise exception 'No hay cajas para reabrir.'; end if;
  update public.cajas set estado = 'abierta', cerrada_por = null, cerrada_en = null where id = v_id;
  perform public.registrar_evento(auth.uid(), 'reabrir_caja', 'caja', v_id::text, '{}');
end;
$$;

-- -----------------------------------------------------------------------------
-- Clientes y fiados
-- -----------------------------------------------------------------------------
create table public.clientes (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null check (trim(nombre) <> ''),
  identificacion text not null default '',
  telefono       text not null default '',
  correo         text not null default '',
  direccion      text not null default '',
  limite_credito numeric(12, 4) not null default 0 check (limite_credito >= 0),
  notas          text not null default '',
  activo         boolean not null default true,
  creado_en      timestamptz not null default now()
);
create index clientes_nombre on public.clientes (public.normalizar(nombre));
create unique index clientes_identificacion on public.clientes (identificacion) where identificacion <> '';

create function public.guardar_cliente(p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_limite numeric := coalesce(nullif(p ->> 'limite_credito', '')::numeric, 0);
begin
  perform public.exigir_permiso('clientes.gestionar');
  if coalesce(trim(p ->> 'nombre'), '') = '' then raise exception 'Escribe el nombre del cliente.'; end if;
  if v_limite < 0 then raise exception 'El límite no puede ser negativo.'; end if;
  if exists (select 1 from public.clientes where identificacion = trim(coalesce(p ->> 'identificacion', ''))
             and identificacion <> '' and id is distinct from v_id) then
    raise exception 'Ya hay un cliente con esa cédula o RUC.';
  end if;
  -- Subir el límite de crédito es decisión de la administradora.
  if v_limite > coalesce((select limite_credito from public.clientes where id = v_id), 0)
     and not public.tiene_permiso('clientes.fiar_sobre_limite') then
    raise exception 'Solo la administradora puede subir el límite de crédito.';
  end if;
  if v_id is null then
    insert into public.clientes (nombre, identificacion, telefono, correo, direccion, limite_credito, notas)
    values (trim(p ->> 'nombre'), trim(coalesce(p ->> 'identificacion', '')), trim(coalesce(p ->> 'telefono', '')),
            trim(coalesce(p ->> 'correo', '')), trim(coalesce(p ->> 'direccion', '')), v_limite, coalesce(p ->> 'notas', ''))
    returning id into v_id;
  else
    update public.clientes set nombre = trim(p ->> 'nombre'), identificacion = trim(coalesce(p ->> 'identificacion', '')),
      telefono = trim(coalesce(p ->> 'telefono', '')), correo = trim(coalesce(p ->> 'correo', '')),
      direccion = trim(coalesce(p ->> 'direccion', '')), limite_credito = v_limite, notas = coalesce(p ->> 'notas', ''),
      activo = coalesce((p ->> 'activo')::boolean, activo)
    where id = v_id;
    if not found then raise exception 'No se encontró el cliente.'; end if;
  end if;
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Ventas
-- -----------------------------------------------------------------------------
create table public.ventas (
  id               uuid primary key, -- lo genera el dispositivo
  numero           bigint generated always as identity unique,
  fecha            timestamptz not null default now(),
  usuario_id       uuid references public.perfiles (id) on delete set null,
  caja_id          uuid references public.cajas (id),
  cliente_id       uuid references public.clientes (id),
  subtotal         numeric(12, 4) not null,
  descuento        numeric(12, 4) not null default 0,
  total            numeric(12, 4) not null check (total >= 0),
  estado           text not null default 'normal' check (estado in ('normal', 'anulada')),
  autorizado_por   uuid references public.perfiles (id) on delete set null,
  anulada_por      uuid references public.perfiles (id) on delete set null,
  anulada_en       timestamptz,
  motivo_anulacion text,
  nota             text not null default ''
);
create index ventas_fecha on public.ventas (fecha desc);
create index ventas_cliente on public.ventas (cliente_id);
create index ventas_caja on public.ventas (caja_id);

create table public.venta_lineas (
  id              bigint generated always as identity primary key,
  venta_id        uuid not null references public.ventas (id) on delete cascade,
  producto_id     uuid references public.productos (id),
  presentacion_id uuid references public.presentaciones (id),
  descripcion     text not null,
  cantidad        numeric(12, 3) not null check (cantidad > 0),
  factor          numeric(12, 3) not null default 1,
  precio          numeric(12, 4) not null check (precio >= 0), -- por presentación
  descuento       numeric(12, 4) not null default 0 check (descuento >= 0),
  total           numeric(12, 4) not null,
  devuelto        numeric(12, 3) not null default 0, -- en la presentación
  revisar         boolean not null default false -- «Varios»: cobrado sin producto
);
create index venta_lineas_venta on public.venta_lineas (venta_id);
create index venta_lineas_producto on public.venta_lineas (producto_id);

-- PRIVADO: el costo de cada línea en el momento de la venta (para la ganancia real).
create table public.venta_linea_costos (
  linea_id       bigint primary key references public.venta_lineas (id) on delete cascade,
  costo_unitario numeric(12, 4) not null, -- por unidad base
  costo_total    numeric(12, 4) not null
);

create table public.venta_pagos (
  id            bigint generated always as identity primary key,
  venta_id      uuid not null references public.ventas (id) on delete cascade,
  forma_pago_id text not null references public.formas_pago (id),
  monto         numeric(12, 4) not null check (monto > 0),
  referencia    text not null default '', -- nº de transacción Deuna, comprobante, voucher
  recibido      numeric(12, 4), -- efectivo entregado por el cliente
  cambio        numeric(12, 4)
);
create index venta_pagos_venta on public.venta_pagos (venta_id);

create table public.abonos (
  id            bigint generated always as identity primary key,
  cliente_id    uuid not null references public.clientes (id),
  fecha         timestamptz not null default now(),
  monto         numeric(12, 4) not null check (monto > 0),
  forma_pago_id text not null references public.formas_pago (id),
  caja_id       uuid references public.cajas (id),
  nota          text not null default '',
  usuario_id    uuid references public.perfiles (id) on delete set null
);
create index abonos_cliente on public.abonos (cliente_id);

create table public.devoluciones (
  id             bigint generated always as identity primary key,
  venta_id       uuid not null references public.ventas (id),
  fecha          timestamptz not null default now(),
  monto          numeric(12, 4) not null,
  cuenta_id      uuid references public.cuentas_dinero (id),
  motivo         text not null,
  lineas         jsonb not null,
  autorizado_por uuid references public.perfiles (id) on delete set null,
  usuario_id     uuid references public.perfiles (id) on delete set null
);

-- Saldo de fiado por cliente: lo fiado en ventas válidas menos lo abonado y lo devuelto.
create function public.saldo_fiado(p_cliente uuid) returns numeric
language sql stable security definer set search_path = '' as $$
  select coalesce((select sum(vp.monto) from public.venta_pagos vp join public.ventas v on v.id = vp.venta_id
                   where v.cliente_id = p_cliente and v.estado = 'normal' and vp.forma_pago_id = 'fiado'), 0)
       - coalesce((select sum(monto) from public.abonos where cliente_id = p_cliente), 0)
       - coalesce((select sum(d.monto) from public.devoluciones d join public.ventas v on v.id = d.venta_id
                   where v.cliente_id = p_cliente and d.cuenta_id is null), 0);
$$;

create function public.clientes_con_saldo()
returns table (id uuid, nombre text, identificacion text, telefono text, limite_credito numeric, saldo numeric,
               ultima_compra timestamptz, activo boolean)
language sql stable security definer set search_path = '' as $$
  select c.id, c.nombre, c.identificacion, c.telefono, c.limite_credito, public.saldo_fiado(c.id),
         (select max(fecha) from public.ventas where cliente_id = c.id and estado = 'normal'), c.activo
  from public.clientes c
  where public.tiene_permiso('clientes.gestionar') or public.tiene_permiso('ventas.vender')
  order by c.nombre;
$$;

create function public.registrar_abono(p jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_cliente uuid := (p ->> 'cliente_id')::uuid;
  v_monto numeric := nullif(p ->> 'monto', '')::numeric;
  v_forma public.formas_pago;
  v_nombre text;
begin
  perform public.exigir_permiso('clientes.gestionar');
  select nombre into v_nombre from public.clientes where id = v_cliente;
  if not found then raise exception 'No se encontró el cliente.'; end if;
  if v_monto is null or v_monto <= 0 then raise exception 'Escribe un monto mayor que 0.'; end if;
  if v_monto > public.saldo_fiado(v_cliente) + 0.001 then
    raise exception 'Solo debe $%.', round(public.saldo_fiado(v_cliente), 2);
  end if;
  select * into v_forma from public.formas_pago where id = p ->> 'forma_pago_id' and activa and id <> 'fiado';
  if not found then raise exception 'Elige cómo pagó.'; end if;
  insert into public.abonos (cliente_id, monto, forma_pago_id, caja_id, nota, usuario_id)
  values (v_cliente, round(v_monto, 4), v_forma.id, (select id from public.cajas where estado = 'abierta'),
          coalesce(p ->> 'nota', ''), auth.uid());
  perform public.registrar_dinero(v_forma.cuenta_id, v_monto, 'abono_cliente', 'cliente', v_cliente::text, 'Abono de ' || v_nombre);
  perform public.registrar_evento(auth.uid(), 'registrar_abono', 'cliente', v_cliente::text, p);
end;
$$;

-- Producto vendido sin estar registrado: la cajera lo crea con nombre y precio,
-- y la administradora lo completa después.
create function public.crear_producto_pendiente(p_nombre text, p_precio numeric, p_codigo text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_pres uuid;
begin
  perform public.exigir_permiso('ventas.vender');
  if coalesce(trim(p_nombre), '') = '' then raise exception 'Escribe qué es el producto.'; end if;
  if p_precio is null or p_precio <= 0 then raise exception 'Escribe el precio.'; end if;
  insert into public.productos (nombre, pendiente) values (trim(p_nombre), true) returning id into v_id;
  insert into public.presentaciones (producto_id, nombre, factor, precio_venta, es_base, para_venta, para_compra, orden)
  values (v_id, 'Unidad', 1, round(p_precio, 4), true, true, true, 0) returning id into v_pres;
  if nullif(trim(coalesce(p_codigo, '')), '') is not null
     and not exists (select 1 from public.codigos_barras where codigo = trim(p_codigo)) then
    insert into public.codigos_barras (codigo, producto_id, presentacion_id) values (trim(p_codigo), v_id, v_pres);
  end if;
  perform public.registrar_evento(auth.uid(), 'crear_producto_pendiente', 'producto', v_id::text,
    jsonb_build_object('nombre', p_nombre, 'precio', p_precio));
  return jsonb_build_object('producto_id', v_id, 'presentacion_id', v_pres);
end;
$$;

-- -----------------------------------------------------------------------------
-- Registrar una venta. Los precios salen de la base de datos (no del celular),
-- salvo en «Varios». Descuentos mayores al límite y fiado sobre el límite
-- necesitan autorización.
--
-- p = { id, cliente_id, nota, descuento, pin,
--       lineas: [{ producto_id, presentacion_id, cantidad, descuento } | { descripcion, precio, cantidad }],
--       pagos: [{ forma, monto, referencia, recibido }] }
-- -----------------------------------------------------------------------------
create function public.registrar_venta(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := (p ->> 'id')::uuid;
  v_caja uuid;
  v_cliente uuid := nullif(p ->> 'cliente_id', '')::uuid;
  v_ajustes public.ajustes;
  v_l jsonb;
  v_pago jsonb;
  v_pres record;
  v_cantidad numeric;
  v_precio numeric;
  v_desc_linea numeric;
  v_total_linea numeric;
  v_subtotal numeric := 0;
  v_desc_lineas numeric := 0;
  v_bruto numeric := 0;
  v_descuento numeric := coalesce(nullif(p ->> 'descuento', '')::numeric, 0);
  v_total numeric;
  v_pagado numeric := 0;
  v_fiado numeric := 0;
  v_linea_id bigint;
  v_costo numeric;
  v_stock numeric;
  v_forma public.formas_pago;
  v_autoriza uuid;
  v_numero bigint;
  v_cambio numeric := 0;
  v_avisos jsonb := '[]';
begin
  perform public.exigir_permiso('ventas.vender');
  if v_id is null then raise exception 'Falta el identificador de la venta.'; end if;
  select numero into v_numero from public.ventas where id = v_id;
  if found then return jsonb_build_object('id', v_id, 'numero', v_numero, 'repetida', true); end if;
  select id into v_caja from public.cajas where estado = 'abierta';
  if v_caja is null then raise exception 'Abre la caja antes de vender.'; end if;
  if jsonb_array_length(coalesce(p -> 'lineas', '[]')) = 0 then raise exception 'No hay nada para cobrar.'; end if;
  select * into v_ajustes from public.ajustes where id = 1;
  if v_cliente is not null and not exists (select 1 from public.clientes where id = v_cliente) then
    raise exception 'No se encontró el cliente.';
  end if;

  insert into public.ventas (id, usuario_id, caja_id, cliente_id, subtotal, descuento, total, nota)
  values (v_id, auth.uid(), v_caja, v_cliente, 0, 0, 0, coalesce(p ->> 'nota', ''))
  returning numero into v_numero;

  for v_l in select * from jsonb_array_elements(p -> 'lineas') loop
    v_cantidad := nullif(v_l ->> 'cantidad', '')::numeric;
    if v_cantidad is null or v_cantidad <= 0 then raise exception 'Hay una cantidad no válida.'; end if;
    v_desc_linea := coalesce(nullif(v_l ->> 'descuento', '')::numeric, 0);
    if v_desc_linea < 0 then raise exception 'El descuento no puede ser negativo.'; end if;

    if nullif(v_l ->> 'producto_id', '') is null then
      -- «Varios / venta libre»: monto escrito a mano, queda para revisar.
      v_precio := nullif(v_l ->> 'precio', '')::numeric;
      if v_precio is null or v_precio <= 0 then raise exception 'Escribe el monto de «Varios».'; end if;
      v_total_linea := round(v_cantidad * v_precio, 2) - v_desc_linea;
      insert into public.venta_lineas (venta_id, descripcion, cantidad, precio, descuento, total, revisar)
      values (v_id, coalesce(nullif(trim(v_l ->> 'descripcion'), ''), 'Varios'), v_cantidad, v_precio, v_desc_linea, v_total_linea, true);
    else
      select pr.id, pr.factor, pr.precio_venta, pr.nombre as presentacion, p2.nombre, p2.activo
        into v_pres
      from public.presentaciones pr join public.productos p2 on p2.id = pr.producto_id
      where pr.id = (v_l ->> 'presentacion_id')::uuid and pr.producto_id = (v_l ->> 'producto_id')::uuid and pr.activa;
      if not found then raise exception 'Un producto del carrito ya no existe. Quítalo y vuelve a agregarlo.'; end if;
      if v_pres.precio_venta is null then raise exception '«%» no tiene precio de venta.', v_pres.nombre; end if;
      v_precio := v_pres.precio_venta;
      v_total_linea := round(v_cantidad * v_precio, 2) - v_desc_linea;
      if v_total_linea < 0 then raise exception 'El descuento de «%» es mayor que su precio.', v_pres.nombre; end if;

      select cantidad into v_stock from public.existencias where producto_id = (v_l ->> 'producto_id')::uuid;
      if coalesce(v_stock, 0) < v_cantidad * v_pres.factor then
        if v_ajustes.venta_sin_stock = 'bloquear' then
          raise exception 'No hay suficiente «%» (hay %).', v_pres.nombre, coalesce(v_stock, 0);
        end if;
        v_avisos := v_avisos || to_jsonb(v_pres.nombre);
      end if;

      insert into public.venta_lineas (venta_id, producto_id, presentacion_id, descripcion, cantidad, factor, precio, descuento, total)
      values (v_id, (v_l ->> 'producto_id')::uuid, v_pres.id,
              v_pres.nombre || case when v_pres.factor <> 1 then ' (' || v_pres.presentacion || ')' else '' end,
              v_cantidad, v_pres.factor, v_precio, v_desc_linea, v_total_linea)
      returning id into v_linea_id;

      select costo_promedio into v_costo from public.producto_costos where producto_id = (v_l ->> 'producto_id')::uuid;
      insert into public.venta_linea_costos (linea_id, costo_unitario, costo_total)
      values (v_linea_id, coalesce(v_costo, 0), round(coalesce(v_costo, 0) * v_cantidad * v_pres.factor, 4));
      perform public.registrar_movimiento((v_l ->> 'producto_id')::uuid, 'venta', -round(v_cantidad * v_pres.factor, 3),
        null, 'venta', v_id::text, 'Venta #' || v_numero);
    end if;
    v_subtotal := v_subtotal + v_total_linea;
    v_desc_lineas := v_desc_lineas + v_desc_linea;
    v_bruto := v_bruto + v_total_linea + v_desc_linea;
  end loop;

  if v_descuento < 0 or v_descuento > v_subtotal then raise exception 'El descuento no es válido.'; end if;
  v_total := round(v_subtotal - v_descuento, 2);

  -- Descuento mayor al límite: autoriza la administradora.
  if v_bruto > 0 and (v_desc_lineas + v_descuento) / v_bruto * 100 > v_ajustes.descuento_max_sin_autorizacion + 0.001 then
    v_autoriza := public.autorizar('ventas.descuento_mayor', p ->> 'pin');
  end if;

  for v_pago in select * from jsonb_array_elements(coalesce(p -> 'pagos', '[]')) loop
    select * into v_forma from public.formas_pago where id = v_pago ->> 'forma' and activa;
    if not found then raise exception 'Forma de pago no válida.'; end if;
    if nullif(v_pago ->> 'monto', '')::numeric is null or (v_pago ->> 'monto')::numeric <= 0 then
      raise exception 'Hay un pago sin monto.';
    end if;
    if v_forma.id = 'efectivo' and nullif(v_pago ->> 'recibido', '') is not null then
      if (v_pago ->> 'recibido')::numeric < (v_pago ->> 'monto')::numeric then
        raise exception 'El cliente entregó menos de lo que paga en efectivo.';
      end if;
      v_cambio := (v_pago ->> 'recibido')::numeric - (v_pago ->> 'monto')::numeric;
    end if;
    insert into public.venta_pagos (venta_id, forma_pago_id, monto, referencia, recibido, cambio)
    values (v_id, v_forma.id, round((v_pago ->> 'monto')::numeric, 4), coalesce(trim(v_pago ->> 'referencia'), ''),
            case when v_forma.id = 'efectivo' then nullif(v_pago ->> 'recibido', '')::numeric end,
            case when v_forma.id = 'efectivo' and nullif(v_pago ->> 'recibido', '') is not null then v_cambio end);
    if v_forma.id = 'fiado' then
      v_fiado := v_fiado + (v_pago ->> 'monto')::numeric;
    else
      perform public.registrar_dinero(v_forma.cuenta_id, (v_pago ->> 'monto')::numeric, 'venta', 'venta', v_id::text,
        'Venta #' || v_numero);
    end if;
    v_pagado := v_pagado + (v_pago ->> 'monto')::numeric;
  end loop;
  if abs(v_pagado - v_total) >= 0.005 then
    raise exception 'Los pagos suman $% pero la venta es de $%.', round(v_pagado, 2), round(v_total, 2);
  end if;

  if v_fiado > 0 then
    if v_cliente is null then raise exception 'Para fiar elige el cliente.'; end if;
    if public.saldo_fiado(v_cliente) > (select limite_credito from public.clientes where id = v_cliente) + 0.001 then
      v_autoriza := coalesce(public.autorizar('clientes.fiar_sobre_limite', p ->> 'pin'), v_autoriza);
    end if;
  end if;

  update public.ventas set subtotal = v_subtotal, descuento = v_descuento, total = v_total, autorizado_por = v_autoriza
  where id = v_id;
  if v_autoriza is not null and v_autoriza <> auth.uid() then
    perform public.registrar_evento(auth.uid(), 'autorizar_venta', 'venta', v_id::text, jsonb_build_object('autorizo', v_autoriza));
  end if;
  return jsonb_build_object('id', v_id, 'numero', v_numero, 'total', v_total, 'cambio', v_cambio,
                            'sin_stock', v_avisos, 'repetida', false);
end;
$$;

-- -----------------------------------------------------------------------------
-- Devolución (parcial) o anulación (todo). Siempre con motivo y autorización.
-- p = { venta_id, motivo, pin, cuenta_id (de dónde sale el dinero), lineas: [{ linea_id, cantidad }] | null = todo }
-- -----------------------------------------------------------------------------
create function public.devolver_venta(p jsonb) returns numeric
language plpgsql security definer set search_path = '' as $$
declare
  v_venta public.ventas;
  v_autoriza uuid;
  v_todo boolean := p -> 'lineas' is null or jsonb_typeof(p -> 'lineas') = 'null';
  v_linea record;
  v_cant numeric;
  v_monto numeric := 0;
  v_detalle jsonb := '[]';
  v_pago record;
  v_costo numeric;
  v_cuenta uuid := nullif(p ->> 'cuenta_id', '')::uuid;
begin
  perform public.exigir_permiso('ventas.vender');
  if coalesce(trim(p ->> 'motivo'), '') = '' then raise exception 'Escribe el motivo.'; end if;
  select * into v_venta from public.ventas where id = (p ->> 'venta_id')::uuid for update;
  if not found then raise exception 'No se encontró la venta.'; end if;
  if v_venta.estado = 'anulada' then raise exception 'Esa venta ya está anulada.'; end if;
  v_autoriza := public.autorizar('ventas.anular', p ->> 'pin');

  for v_linea in select * from public.venta_lineas where venta_id = v_venta.id order by id loop
    if v_todo then
      v_cant := v_linea.cantidad - v_linea.devuelto;
    else
      select coalesce(sum((x ->> 'cantidad')::numeric), 0) into v_cant
      from jsonb_array_elements(p -> 'lineas') x where (x ->> 'linea_id')::bigint = v_linea.id;
    end if;
    continue when v_cant <= 0;
    if v_cant > v_linea.cantidad - v_linea.devuelto + 0.0001 then
      raise exception 'No se puede devolver más de lo vendido de «%».', v_linea.descripcion;
    end if;
    update public.venta_lineas set devuelto = devuelto + v_cant where id = v_linea.id;
    v_monto := v_monto + round(v_linea.total * v_cant / v_linea.cantidad, 2);
    v_detalle := v_detalle || jsonb_build_object('linea_id', v_linea.id, 'cantidad', v_cant);
    if v_linea.producto_id is not null then
      select costo_unitario into v_costo from public.venta_linea_costos where linea_id = v_linea.id;
      perform public.registrar_movimiento(v_linea.producto_id, 'devolucion', round(v_cant * v_linea.factor, 3),
        nullif(v_costo, 0), 'venta', v_venta.id::text, 'Devolución venta #' || v_venta.numero);
    end if;
  end loop;
  if v_monto <= 0 then raise exception 'Elige qué se devuelve.'; end if;

  if v_todo then
    -- Anulación: se revierte cada pago en su cuenta (el fiado se borra solo).
    for v_pago in select vp.*, f.cuenta_id from public.venta_pagos vp join public.formas_pago f on f.id = vp.forma_pago_id
                  where vp.venta_id = v_venta.id loop
      if v_pago.cuenta_id is not null then
        perform public.registrar_dinero(v_pago.cuenta_id, -v_pago.monto, 'venta', 'venta', v_venta.id::text,
          'Anulación venta #' || v_venta.numero);
      end if;
    end loop;
    update public.ventas set estado = 'anulada', anulada_por = v_autoriza, anulada_en = now(),
           motivo_anulacion = trim(p ->> 'motivo') where id = v_venta.id;
    perform public.registrar_evento(auth.uid(), 'anular_venta', 'venta', v_venta.id::text,
      jsonb_build_object('motivo', p ->> 'motivo', 'autorizo', v_autoriza));
  else
    -- Devolución parcial: el dinero sale de la cuenta elegida (sin cuenta = se descuenta del fiado).
    if v_cuenta is null and not exists (select 1 from public.venta_pagos where venta_id = v_venta.id and forma_pago_id = 'fiado') then
      raise exception 'Elige de qué cuenta sale el dinero que se devuelve.';
    end if;
    insert into public.devoluciones (venta_id, monto, cuenta_id, motivo, lineas, autorizado_por, usuario_id)
    values (v_venta.id, v_monto, v_cuenta, trim(p ->> 'motivo'), v_detalle, v_autoriza, auth.uid());
    if v_cuenta is not null then
      perform public.registrar_dinero(v_cuenta, -v_monto, 'venta', 'venta', v_venta.id::text, 'Devolución venta #' || v_venta.numero);
    end if;
    perform public.registrar_evento(auth.uid(), 'devolver_venta', 'venta', v_venta.id::text,
      jsonb_build_object('motivo', p ->> 'motivo', 'monto', v_monto, 'autorizo', v_autoriza));
  end if;
  return v_monto;
end;
$$;

-- Favoritos: lo más vendido en 30 días, con más peso a lo que se vende a esta hora.
create function public.productos_favoritos(p_limite int default 24)
returns table (producto_id uuid, puntos numeric)
language sql stable security definer set search_path = '' as $$
  select l.producto_id,
         sum(l.cantidad * l.factor * case when abs(extract(hour from (v.fecha at time zone 'America/Guayaquil'))
                                                   - extract(hour from (now() at time zone 'America/Guayaquil'))) <= 1
                                          then 3 else 1 end) as puntos
  from public.venta_lineas l
  join public.ventas v on v.id = l.venta_id
  join public.productos p on p.id = l.producto_id
  where v.estado = 'normal' and v.fecha > now() - interval '30 days' and p.activo
    and public.tiene_permiso('ventas.vender')
  group by l.producto_id
  order by puntos desc
  limit p_limite;
$$;

-- -----------------------------------------------------------------------------
-- Seguridad
-- -----------------------------------------------------------------------------
alter table public.formas_pago enable row level security;
alter table public.intentos_autorizacion enable row level security;
alter table public.cajas enable row level security;
alter table public.clientes enable row level security;
alter table public.ventas enable row level security;
alter table public.venta_lineas enable row level security;
alter table public.venta_linea_costos enable row level security;
alter table public.venta_pagos enable row level security;
alter table public.abonos enable row level security;
alter table public.devoluciones enable row level security;

create function public.puede_ver_venta(p_usuario uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.tiene_permiso('ventas.ver_todas') or public.tiene_permiso('reportes.ver')
         or (public.tiene_permiso('ventas.ver_propias') and p_usuario = auth.uid());
$$;

create policy "ver formas de pago" on public.formas_pago for select to authenticated using (true);
create policy "ver cajas" on public.cajas for select to authenticated
  using (public.tiene_permiso('caja.abrir_cerrar') or public.tiene_permiso('reportes.ver'));
create policy "ver clientes" on public.clientes for select to authenticated
  using (public.tiene_permiso('clientes.gestionar') or public.tiene_permiso('ventas.vender'));
create policy "ver ventas" on public.ventas for select to authenticated using (public.puede_ver_venta(usuario_id));
create policy "ver líneas de venta" on public.venta_lineas for select to authenticated
  using (exists (select 1 from public.ventas v where v.id = venta_id and public.puede_ver_venta(v.usuario_id)));
create policy "costos de venta: solo quien ve costos" on public.venta_linea_costos for select to authenticated
  using (public.tiene_permiso('costos.ver'));
create policy "ver pagos de venta" on public.venta_pagos for select to authenticated
  using (exists (select 1 from public.ventas v where v.id = venta_id and public.puede_ver_venta(v.usuario_id)));
create policy "ver abonos" on public.abonos for select to authenticated using (public.tiene_permiso('clientes.gestionar'));
create policy "ver devoluciones" on public.devoluciones for select to authenticated
  using (public.tiene_permiso('ventas.ver_todas') or public.tiene_permiso('reportes.ver'));

revoke insert, update, delete, truncate on
  public.formas_pago, public.intentos_autorizacion, public.cajas, public.clientes, public.ventas, public.venta_lineas,
  public.venta_linea_costos, public.venta_pagos, public.abonos, public.devoluciones
from anon, authenticated;
revoke all on
  public.formas_pago, public.intentos_autorizacion, public.cajas, public.clientes, public.ventas, public.venta_lineas,
  public.venta_linea_costos, public.venta_pagos, public.abonos, public.devoluciones
from anon;
revoke all on public.intentos_autorizacion from authenticated;

revoke execute on function
  public.usuario_tiene_permiso(uuid, text), public.autorizar(text, text), public.cuenta_caja(), public.saldo_cuenta(uuid),
  public.saldo_fiado(uuid), public.puede_ver_venta(uuid)
from public, anon, authenticated;
grant execute on function public.puede_ver_venta(uuid) to authenticated; -- la usan las reglas de lectura

revoke execute on function
  public.guardar_ajustes_venta(jsonb), public.guardar_forma_pago(text, uuid, boolean), public.abrir_caja(numeric),
  public.resumen_caja(uuid), public.cerrar_caja(jsonb, text), public.reabrir_caja(), public.guardar_cliente(jsonb),
  public.clientes_con_saldo(), public.registrar_abono(jsonb), public.crear_producto_pendiente(text, numeric, text),
  public.registrar_venta(jsonb), public.devolver_venta(jsonb), public.productos_favoritos(int)
from public, anon;
grant execute on function
  public.guardar_ajustes_venta(jsonb), public.guardar_forma_pago(text, uuid, boolean), public.abrir_caja(numeric),
  public.resumen_caja(uuid), public.cerrar_caja(jsonb, text), public.reabrir_caja(), public.guardar_cliente(jsonb),
  public.clientes_con_saldo(), public.registrar_abono(jsonb), public.crear_producto_pendiente(text, numeric, text),
  public.registrar_venta(jsonb), public.devolver_venta(jsonb), public.productos_favoritos(int)
to authenticated;

-- QR de Deuna (público: es para que el cliente lo escanee) y otras imágenes de la tienda.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tienda', 'tienda', true, 2097152, array['image/jpeg', 'image/png', 'image/webp']);
create policy "subir imágenes de la tienda" on storage.objects for insert to authenticated
  with check (bucket_id = 'tienda' and public.tiene_permiso('ajustes.gestionar'));
create policy "reemplazar imágenes de la tienda" on storage.objects for update to authenticated
  using (bucket_id = 'tienda' and public.tiene_permiso('ajustes.gestionar'));
