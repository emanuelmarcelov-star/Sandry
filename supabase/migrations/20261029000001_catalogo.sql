-- =============================================================================
-- Fase 3 · Catálogo: categorías, productos, presentaciones, códigos de barras,
-- costos (privados), existencias, kardex, historial de precios y etiquetas.
--
-- Reglas:
--  * El stock SIEMPRE está en la unidad base del producto.
--  * Los costos viven en tablas aparte que solo ve quien tiene "costos.ver".
--  * Nadie escribe directo en las tablas: todo pasa por funciones que revisan
--    permisos y dejan constancia (bitácora / historial).
-- =============================================================================

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- Texto en minúsculas, sin tildes ni signos: "Coca-Cola 3L" → "coca cola 3l".
create function public.normalizar(p_texto text) returns text
language sql immutable parallel safe set search_path = '' as $$
  select trim(regexp_replace(
    lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(p_texto, ''))),
    '[^a-z0-9ñ]+', ' ', 'g'));
$$;

-- -----------------------------------------------------------------------------
-- Ajustes nuevos
-- -----------------------------------------------------------------------------
alter table public.ajustes
  add column redondeo_precio numeric(6, 2) not null default 0.05 check (redondeo_precio > 0);

drop function public.actualizar_ajustes(int, numeric);
create function public.actualizar_ajustes(
  p_minutos_inactividad int, p_descuento_max numeric, p_redondeo_precio numeric default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  antes jsonb;
begin
  perform public.exigir_permiso('ajustes.gestionar');
  select to_jsonb(a) into antes from public.ajustes a where id = 1;
  update public.ajustes
     set minutos_inactividad = p_minutos_inactividad,
         descuento_max_sin_autorizacion = p_descuento_max,
         redondeo_precio = coalesce(p_redondeo_precio, redondeo_precio),
         actualizado_en = now()
   where id = 1;
  perform public.registrar_evento(auth.uid(), 'cambiar_ajustes', 'ajustes', '1',
    jsonb_build_object('antes', antes - 'actualizado_en',
      'despues', (select to_jsonb(a) - 'actualizado_en' from public.ajustes a where id = 1)));
end;
$$;

-- -----------------------------------------------------------------------------
-- Categorías (árbol)
-- -----------------------------------------------------------------------------
create table public.categorias (
  id              uuid primary key default gen_random_uuid(),
  nombre          text not null check (trim(nombre) <> ''),
  padre_id        uuid references public.categorias (id) on delete restrict,
  color           text not null default '#64748b' check (color ~ '^#[0-9a-fA-F]{6}$'),
  icono           text,
  tarifa_iva      text check (tarifa_iva in ('15', '0', 'exento')),       -- null = la del padre
  margen_objetivo numeric(7, 2) check (margen_objetivo >= 0),              -- null = el del padre
  orden           int not null default 0,
  activa          boolean not null default true,
  creado_en       timestamptz not null default now()
);
create unique index categorias_nombre_unico
  on public.categorias (coalesce(padre_id, '00000000-0000-0000-0000-000000000000'::uuid), public.normalizar(nombre));

-- IVA y margen que realmente aplican (si la categoría no los define, los hereda).
create function public.valores_categoria(p_categoria uuid)
returns table (tarifa_iva text, margen_objetivo numeric)
language sql stable security definer set search_path = '' as $$
  with recursive cadena as (
    select c.id, c.padre_id, c.tarifa_iva, c.margen_objetivo, 0 as nivel
    from public.categorias c where c.id = p_categoria
    union all
    select p.id, p.padre_id, p.tarifa_iva, p.margen_objetivo, cadena.nivel + 1
    from public.categorias p join cadena on p.id = cadena.padre_id
  )
  select
    coalesce((select c.tarifa_iva from cadena c where c.tarifa_iva is not null order by nivel limit 1), '15'),
    coalesce((select c.margen_objetivo from cadena c where c.margen_objetivo is not null order by nivel limit 1), 25);
$$;

create function public.categoria_y_descendientes(p_categoria uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$
  with recursive arbol as (
    select id from public.categorias where id = p_categoria
    union all
    select c.id from public.categorias c join arbol on c.padre_id = arbol.id
  )
  select id from arbol;
$$;

-- -----------------------------------------------------------------------------
-- Productos
-- -----------------------------------------------------------------------------
create table public.productos (
  id               uuid primary key default gen_random_uuid(),
  nombre           text not null check (trim(nombre) <> ''),
  marca            text not null default '',
  categoria_id     uuid references public.categorias (id) on delete set null,
  plu              text unique check (plu ~ '^[1-9][0-9]{0,3}$'),
  sinonimos        text[] not null default '{}',
  foto_ruta        text,
  unidad_base      text not null default 'unidad' check (unidad_base in ('unidad', 'libra', 'kilo', 'litro')),
  tarifa_iva       text not null default '15' check (tarifa_iva in ('15', '0', 'exento')),
  stock_minimo     numeric(12, 3) not null default 0 check (stock_minimo >= 0),
  maneja_caducidad boolean not null default false,
  retornable       boolean not null default false,
  solo_mayores     boolean not null default false,
  ubicacion        text not null default '',
  activo           boolean not null default true,
  pendiente        boolean not null default false,
  texto_busqueda   text not null default '',
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now()
);
create index productos_busqueda on public.productos using gin (texto_busqueda extensions.gin_trgm_ops);
create index productos_categoria on public.productos (categoria_id);

-- Texto para buscar: nombre + marca + apodos, también "pegado" (cocacola = coca cola).
create function public.actualizar_texto_busqueda() returns trigger
language plpgsql set search_path = '' as $$
declare
  base text := public.normalizar(new.nombre || ' ' || new.marca || ' ' || array_to_string(new.sinonimos, ' '));
begin
  new.texto_busqueda := base || ' ' || replace(base, ' ', '');
  new.actualizado_en := now();
  return new;
end;
$$;
create trigger productos_texto_busqueda
  before insert or update of nombre, marca, sinonimos on public.productos
  for each row execute function public.actualizar_texto_busqueda();

-- Presentaciones: cómo se vende/compra (unidad, funda, jaba x12, libra...).
create table public.presentaciones (
  id           uuid primary key default gen_random_uuid(),
  producto_id  uuid not null references public.productos (id) on delete cascade,
  nombre       text not null check (trim(nombre) <> ''),
  factor       numeric(12, 4) not null check (factor > 0),     -- cuántas unidades base trae
  precio_venta numeric(12, 4) check (precio_venta >= 0),       -- con IVA incluido
  para_venta   boolean not null default true,
  para_compra  boolean not null default true,
  es_base      boolean not null default false,
  orden        int not null default 0,
  activa       boolean not null default true,
  unique (producto_id, id),
  constraint base_con_factor_1 check (not es_base or factor = 1)
);
create unique index presentaciones_una_base on public.presentaciones (producto_id) where es_base and activa;
create unique index presentaciones_nombre_unico on public.presentaciones (producto_id, public.normalizar(nombre)) where activa;

create table public.codigos_barras (
  codigo          text primary key check (codigo ~ '^[0-9A-Za-z.\-]{3,64}$'),
  producto_id     uuid not null references public.productos (id) on delete cascade,
  presentacion_id uuid,
  es_interno      boolean not null default false,
  creado_en       timestamptz not null default now(),
  foreign key (producto_id, presentacion_id) references public.presentaciones (producto_id, id) on delete cascade
);
create index codigos_barras_producto on public.codigos_barras (producto_id);

-- Costo por unidad base (PRIVADO: solo "costos.ver").
create table public.producto_costos (
  producto_id    uuid primary key references public.productos (id) on delete cascade,
  costo_promedio numeric(12, 4) not null default 0 check (costo_promedio >= 0),
  ultimo_costo   numeric(12, 4),
  actualizado_en timestamptz not null default now()
);

-- Stock actual en unidad base.
create table public.existencias (
  producto_id    uuid primary key references public.productos (id) on delete cascade,
  cantidad       numeric(12, 3) not null default 0,
  actualizado_en timestamptz not null default now()
);

-- Kardex: cada entrada o salida, con su saldo (en unidad base).
create table public.movimientos_stock (
  id              bigint generated always as identity primary key,
  fecha           timestamptz not null default now(),
  producto_id     uuid not null references public.productos (id) on delete cascade,
  tipo            text not null check (tipo in (
                    'inventario_inicial', 'importacion', 'compra', 'bonificacion', 'venta', 'devolucion',
                    'ajuste_entrada', 'ajuste_salida', 'merma', 'caducado', 'robo', 'autoconsumo', 'regalo', 'conteo')),
  cantidad        numeric(12, 3) not null check (cantidad <> 0),
  costo_unitario  numeric(12, 4),
  saldo           numeric(12, 3) not null,
  usuario_id      uuid references public.perfiles (id) on delete set null,
  referencia_tipo text,
  referencia_id   text,
  nota            text not null default ''
);
create index movimientos_stock_producto on public.movimientos_stock (producto_id, fecha desc);

create table public.historial_precios (
  id              bigint generated always as identity primary key,
  fecha           timestamptz not null default now(),
  producto_id     uuid not null references public.productos (id) on delete cascade,
  presentacion_id uuid references public.presentaciones (id) on delete set null,
  tipo            text not null check (tipo in ('venta', 'costo')),
  antes           numeric(12, 4),
  despues         numeric(12, 4),
  usuario_id      uuid references public.perfiles (id) on delete set null,
  origen          text not null default 'manual' check (origen in ('manual', 'importacion', 'compra', 'masivo'))
);
create index historial_precios_producto on public.historial_precios (producto_id, fecha desc);

-- Presentaciones cuyo precio cambió y necesitan etiqueta nueva.
create table public.etiquetas_pendientes (
  presentacion_id uuid primary key references public.presentaciones (id) on delete cascade,
  producto_id     uuid not null references public.productos (id) on delete cascade,
  desde           timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Códigos internos y PLU
-- -----------------------------------------------------------------------------
create function public.ean13_verificador(p_doce text) returns int
language sql immutable set search_path = '' as $$
  select (10 - (sum(substr(p_doce, i, 1)::int * case when i % 2 = 0 then 3 else 1 end) % 10)) % 10
  from generate_series(1, 12) i;
$$;

create sequence public.codigo_interno_seq;

-- EAN-13 de uso interno: 29 + 10 dígitos + verificador. Nunca repite.
create function public.generar_codigo_interno() returns text
language plpgsql security definer set search_path = '' as $$
declare
  doce text;
  codigo text;
begin
  perform public.exigir_permiso('productos.editar');
  loop
    doce := '29' || lpad(nextval('public.codigo_interno_seq')::text, 10, '0');
    codigo := doce || public.ean13_verificador(doce);
    exit when not exists (select 1 from public.codigos_barras where codigos_barras.codigo = generar_codigo_interno.codigo);
  end loop;
  return codigo;
end;
$$;

-- El PLU (código corto) libre más pequeño.
create function public.siguiente_plu() returns text
language sql stable security definer set search_path = '' as $$
  select min(n)::text from generate_series(1, 9999) n
  where not exists (select 1 from public.productos where plu = n::text);
$$;

-- -----------------------------------------------------------------------------
-- Movimiento de stock (uso interno). Recalcula el costo promedio ponderado.
-- Las entradas con costo 0 (bonificaciones) bajan el promedio.
-- -----------------------------------------------------------------------------
create function public.registrar_movimiento(
  p_producto uuid, p_tipo text, p_cantidad numeric, p_costo numeric,
  p_referencia_tipo text default null, p_referencia_id text default null, p_nota text default ''
) returns numeric
language plpgsql security definer set search_path = '' as $$
declare
  v_stock numeric;
  v_promedio numeric;
  v_saldo numeric;
begin
  select cantidad into v_stock from public.existencias where producto_id = p_producto for update;
  if not found then
    insert into public.existencias (producto_id) values (p_producto);
    v_stock := 0;
  end if;
  v_saldo := v_stock + p_cantidad;

  if p_cantidad > 0 and p_costo is not null then
    select costo_promedio into v_promedio from public.producto_costos where producto_id = p_producto for update;
    if not found then
      insert into public.producto_costos (producto_id) values (p_producto);
      v_promedio := 0;
    end if;
    if v_stock <= 0 then
      v_promedio := p_costo;
    else
      v_promedio := round((v_stock * v_promedio + p_cantidad * p_costo) / (v_stock + p_cantidad), 4);
    end if;
    update public.producto_costos
       set costo_promedio = v_promedio,
           ultimo_costo = case when p_costo > 0 then p_costo else ultimo_costo end,
           actualizado_en = now()
     where producto_id = p_producto;
  end if;

  update public.existencias set cantidad = v_saldo, actualizado_en = now() where producto_id = p_producto;
  insert into public.movimientos_stock
    (producto_id, tipo, cantidad, costo_unitario, saldo, usuario_id, referencia_tipo, referencia_id, nota)
  values
    (p_producto, p_tipo, p_cantidad, p_costo, v_saldo, auth.uid(), p_referencia_tipo, p_referencia_id, coalesce(p_nota, ''));
  return v_saldo;
end;
$$;

-- -----------------------------------------------------------------------------
-- Guardar categoría
-- -----------------------------------------------------------------------------
create function public.guardar_categoria(p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_padre uuid := nullif(p ->> 'padre_id', '')::uuid;
begin
  perform public.exigir_permiso('productos.editar');
  if coalesce(trim(p ->> 'nombre'), '') = '' then
    raise exception 'El nombre de la categoría no puede quedar vacío.';
  end if;
  if v_id is not null and v_padre is not null
     and v_padre in (select public.categoria_y_descendientes(v_id)) then
    raise exception 'Una categoría no puede quedar dentro de sí misma.';
  end if;
  if exists (
    select 1 from public.categorias
    where coalesce(padre_id, '00000000-0000-0000-0000-000000000000'::uuid)
          = coalesce(v_padre, '00000000-0000-0000-0000-000000000000'::uuid)
      and public.normalizar(nombre) = public.normalizar(p ->> 'nombre')
      and id is distinct from v_id
  ) then
    raise exception 'Ya existe una categoría «%» en ese lugar.', trim(p ->> 'nombre');
  end if;

  if v_id is null then
    insert into public.categorias (nombre, padre_id, color, icono, tarifa_iva, margen_objetivo, orden, activa)
    values (
      trim(p ->> 'nombre'), v_padre,
      coalesce(nullif(p ->> 'color', ''), '#64748b'), nullif(p ->> 'icono', ''),
      nullif(p ->> 'tarifa_iva', ''), nullif(p ->> 'margen_objetivo', '')::numeric,
      coalesce((p ->> 'orden')::int, 0), coalesce((p ->> 'activa')::boolean, true)
    ) returning id into v_id;
    perform public.registrar_evento(auth.uid(), 'crear_categoria', 'categoria', v_id::text,
      jsonb_build_object('nombre', trim(p ->> 'nombre')));
  else
    update public.categorias set
      nombre = trim(p ->> 'nombre'), padre_id = v_padre,
      color = coalesce(nullif(p ->> 'color', ''), color), icono = nullif(p ->> 'icono', ''),
      tarifa_iva = nullif(p ->> 'tarifa_iva', ''), margen_objetivo = nullif(p ->> 'margen_objetivo', '')::numeric,
      orden = coalesce((p ->> 'orden')::int, orden), activa = coalesce((p ->> 'activa')::boolean, activa)
    where id = v_id;
    if not found then raise exception 'No se encontró la categoría.'; end if;
    perform public.registrar_evento(auth.uid(), 'editar_categoria', 'categoria', v_id::text,
      jsonb_build_object('nombre', trim(p ->> 'nombre')));
  end if;
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Guardar producto (con sus presentaciones, códigos, costo y stock inicial)
--
-- p = { id?, nombre, marca, categoria_id, plu, sinonimos[], foto_ruta, unidad_base,
--       tarifa_iva, stock_minimo, maneja_caducidad, retornable, solo_mayores,
--       ubicacion, activo,
--       presentaciones: [{ id?, nombre, factor, precio_venta, para_venta,
--                          para_compra, es_base, orden, codigos: [text] }],
--       costo_unitario?  (por unidad base; requiere "costos.ver"),
--       stock_inicial? }
-- p_origen: 'manual' o 'importacion' (en importación, el stock de un producto
-- que ya existe se SUMA como una compra y su costo entra al promedio).
-- -----------------------------------------------------------------------------
create function public.guardar_producto(p jsonb, p_origen text default 'manual') returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_nuevo boolean := nullif(p ->> 'id', '') is null;
  v_pres jsonb;
  v_pres_id uuid;
  v_precio_antes numeric;
  v_precio_nuevo numeric;
  v_ids_pres uuid[] := '{}';
  v_codigos text[] := '{}';
  v_codigo text;
  v_dueno text;
  v_plu text := nullif(trim(p ->> 'plu'), '');
  v_costo numeric := nullif(p ->> 'costo_unitario', '')::numeric;
  v_costo_antes numeric;
  v_stock numeric := nullif(p ->> 'stock_inicial', '')::numeric;
  v_sumar_como_compra boolean;
  v_puede_precio boolean := public.tiene_permiso('precios.cambiar');
  v_nombre_pres text;
begin
  perform public.exigir_permiso('productos.editar');
  if p_origen not in ('manual', 'importacion') then raise exception 'Origen inválido.'; end if;

  -- Validaciones
  if coalesce(trim(p ->> 'nombre'), '') = '' then
    raise exception 'El nombre del producto no puede quedar vacío.';
  end if;
  if (select count(*) from jsonb_array_elements(coalesce(p -> 'presentaciones', '[]')) e
      where coalesce((e ->> 'es_base')::boolean, false)) <> 1 then
    raise exception 'El producto necesita exactamente una presentación base (la unidad en la que se cuenta el stock).';
  end if;
  if exists (select 1 from jsonb_array_elements(p -> 'presentaciones') e
             where coalesce((e ->> 'factor')::numeric, 0) <= 0) then
    raise exception 'El factor de cada presentación debe ser mayor que 0.';
  end if;
  if exists (select 1 from jsonb_array_elements(p -> 'presentaciones') e
             where coalesce((e ->> 'es_base')::boolean, false) and (e ->> 'factor')::numeric <> 1) then
    raise exception 'La presentación base debe tener factor 1.';
  end if;
  if v_plu is not null then
    select nombre into v_dueno from public.productos where plu = v_plu and id is distinct from v_id;
    if found then raise exception 'El código corto (PLU) % ya lo usa «%».', v_plu, v_dueno; end if;
  end if;
  if v_costo is not null then
    if not public.tiene_permiso('costos.ver') then raise exception 'No tienes permiso para poner costos.'; end if;
    if v_costo < 0 then raise exception 'El costo no puede ser negativo.'; end if;
  end if;
  if v_stock is not null and v_stock < 0 then raise exception 'El stock no puede ser negativo.'; end if;

  -- Producto
  if v_nuevo then
    insert into public.productos (nombre, marca, categoria_id, plu, sinonimos, foto_ruta, unidad_base, tarifa_iva,
                                  stock_minimo, maneja_caducidad, retornable, solo_mayores, ubicacion, activo)
    values (
      trim(p ->> 'nombre'), coalesce(trim(p ->> 'marca'), ''), nullif(p ->> 'categoria_id', '')::uuid, v_plu,
      coalesce(array(select trim(x) from jsonb_array_elements_text(coalesce(p -> 'sinonimos', '[]')) x where trim(x) <> ''), '{}'),
      nullif(p ->> 'foto_ruta', ''), coalesce(nullif(p ->> 'unidad_base', ''), 'unidad'),
      coalesce(nullif(p ->> 'tarifa_iva', ''), '15'), coalesce(nullif(p ->> 'stock_minimo', '')::numeric, 0),
      coalesce((p ->> 'maneja_caducidad')::boolean, false), coalesce((p ->> 'retornable')::boolean, false),
      coalesce((p ->> 'solo_mayores')::boolean, false), coalesce(trim(p ->> 'ubicacion'), ''),
      coalesce((p ->> 'activo')::boolean, true)
    ) returning id into v_id;
    insert into public.existencias (producto_id) values (v_id);
    insert into public.producto_costos (producto_id) values (v_id);
  else
    update public.productos set
      nombre = trim(p ->> 'nombre'), marca = coalesce(trim(p ->> 'marca'), ''),
      categoria_id = nullif(p ->> 'categoria_id', '')::uuid, plu = v_plu,
      sinonimos = coalesce(array(select trim(x) from jsonb_array_elements_text(coalesce(p -> 'sinonimos', '[]')) x where trim(x) <> ''), '{}'),
      foto_ruta = case when p ? 'foto_ruta' then nullif(p ->> 'foto_ruta', '') else foto_ruta end,
      unidad_base = coalesce(nullif(p ->> 'unidad_base', ''), unidad_base),
      tarifa_iva = coalesce(nullif(p ->> 'tarifa_iva', ''), tarifa_iva),
      stock_minimo = coalesce(nullif(p ->> 'stock_minimo', '')::numeric, stock_minimo),
      maneja_caducidad = coalesce((p ->> 'maneja_caducidad')::boolean, maneja_caducidad),
      retornable = coalesce((p ->> 'retornable')::boolean, retornable),
      solo_mayores = coalesce((p ->> 'solo_mayores')::boolean, solo_mayores),
      ubicacion = coalesce(trim(p ->> 'ubicacion'), ubicacion),
      activo = coalesce((p ->> 'activo')::boolean, activo),
      pendiente = false
    where id = v_id;
    if not found then raise exception 'No se encontró el producto.'; end if;
    -- Se vuelve a marcar la base con lo que venga.
    update public.presentaciones set es_base = false where producto_id = v_id;
  end if;

  -- Presentaciones y códigos
  for v_pres in select * from jsonb_array_elements(p -> 'presentaciones') loop
    v_pres_id := nullif(v_pres ->> 'id', '')::uuid;
    v_precio_nuevo := nullif(v_pres ->> 'precio_venta', '')::numeric;
    v_nombre_pres := trim(v_pres ->> 'nombre');
    if coalesce(v_nombre_pres, '') = '' then raise exception 'Cada presentación necesita un nombre.'; end if;
    if v_precio_nuevo is not null and v_precio_nuevo < 0 then raise exception 'El precio no puede ser negativo.'; end if;

    if v_pres_id is null then
      v_precio_antes := null;
      if v_precio_nuevo is not null and not v_puede_precio then
        raise exception 'No tienes permiso para poner precios.';
      end if;
      insert into public.presentaciones (producto_id, nombre, factor, precio_venta, para_venta, para_compra, es_base, orden)
      values (
        v_id, v_nombre_pres, (v_pres ->> 'factor')::numeric, v_precio_nuevo,
        coalesce((v_pres ->> 'para_venta')::boolean, true), coalesce((v_pres ->> 'para_compra')::boolean, true),
        coalesce((v_pres ->> 'es_base')::boolean, false), coalesce((v_pres ->> 'orden')::int, 0)
      ) returning id into v_pres_id;
    else
      select precio_venta into v_precio_antes from public.presentaciones
       where id = v_pres_id and producto_id = v_id for update;
      if not found then raise exception 'Una de las presentaciones no pertenece a este producto.'; end if;
      if v_precio_nuevo is distinct from v_precio_antes and not v_puede_precio then
        raise exception 'No tienes permiso para cambiar precios.';
      end if;
      update public.presentaciones set
        nombre = v_nombre_pres, factor = (v_pres ->> 'factor')::numeric, precio_venta = v_precio_nuevo,
        para_venta = coalesce((v_pres ->> 'para_venta')::boolean, true),
        para_compra = coalesce((v_pres ->> 'para_compra')::boolean, true),
        es_base = coalesce((v_pres ->> 'es_base')::boolean, false),
        orden = coalesce((v_pres ->> 'orden')::int, 0), activa = true
      where id = v_pres_id;
    end if;

    if v_precio_nuevo is distinct from v_precio_antes then
      insert into public.historial_precios (producto_id, presentacion_id, tipo, antes, despues, usuario_id, origen)
      values (v_id, v_pres_id, 'venta', v_precio_antes, v_precio_nuevo, auth.uid(), p_origen);
      if v_precio_nuevo is not null then
        insert into public.etiquetas_pendientes (presentacion_id, producto_id) values (v_pres_id, v_id)
        on conflict (presentacion_id) do update set desde = now();
      end if;
      if not v_nuevo then
        perform public.registrar_evento(auth.uid(), 'cambiar_precio', 'producto', v_id::text,
          jsonb_build_object('producto', trim(p ->> 'nombre'), 'presentacion', v_nombre_pres,
                             'antes', v_precio_antes, 'despues', v_precio_nuevo));
      end if;
    end if;
    v_ids_pres := v_ids_pres || v_pres_id;

    for v_codigo in
      select trim(x) from jsonb_array_elements_text(coalesce(v_pres -> 'codigos', '[]')) x where trim(x) <> ''
    loop
      if v_codigo = any (v_codigos) then raise exception 'El código de barras % está repetido.', v_codigo; end if;
      select pr.nombre into v_dueno from public.codigos_barras c join public.productos pr on pr.id = c.producto_id
       where c.codigo = v_codigo and c.producto_id <> v_id;
      if found then raise exception 'El código de barras % ya pertenece a «%».', v_codigo, v_dueno; end if;
      insert into public.codigos_barras (codigo, producto_id, presentacion_id, es_interno)
      values (v_codigo, v_id, v_pres_id, v_codigo ~ '^29[0-9]{11}$')
      on conflict (codigo) do update set presentacion_id = excluded.presentacion_id;
      v_codigos := v_codigos || v_codigo;
    end loop;
  end loop;

  -- Lo que ya no viene se desactiva (se conserva para el historial).
  update public.presentaciones set activa = false, es_base = false
   where producto_id = v_id and not (id = any (v_ids_pres));
  delete from public.codigos_barras where producto_id = v_id and not (codigo = any (v_codigos));

  -- Costo y stock
  v_sumar_como_compra := not v_nuevo and p_origen = 'importacion' and coalesce(v_stock, 0) > 0;
  if v_costo is not null and not v_sumar_como_compra then
    select costo_promedio into v_costo_antes from public.producto_costos where producto_id = v_id for update;
    if v_nuevo or v_costo is distinct from v_costo_antes then
      update public.producto_costos
         set costo_promedio = v_costo, ultimo_costo = v_costo, actualizado_en = now()
       where producto_id = v_id;
      insert into public.historial_precios (producto_id, tipo, antes, despues, usuario_id, origen)
      values (v_id, 'costo', case when v_nuevo then null else v_costo_antes end, v_costo, auth.uid(), p_origen);
      if not v_nuevo then
        perform public.registrar_evento(auth.uid(), 'cambiar_costo', 'producto', v_id::text,
          jsonb_build_object('producto', trim(p ->> 'nombre'), 'antes', v_costo_antes, 'despues', v_costo));
      end if;
    end if;
  end if;

  if coalesce(v_stock, 0) > 0 then
    if v_sumar_como_compra then
      select costo_promedio into v_costo_antes from public.producto_costos where producto_id = v_id;
      perform public.registrar_movimiento(v_id, 'importacion', v_stock, v_costo, 'importacion', null, 'Importado desde Excel');
      if v_costo is not null then
        insert into public.historial_precios (producto_id, tipo, antes, despues, usuario_id, origen)
        select v_id, 'costo', v_costo_antes, costo_promedio, auth.uid(), 'importacion'
        from public.producto_costos where producto_id = v_id and costo_promedio is distinct from v_costo_antes;
      end if;
    elsif v_nuevo then
      perform public.registrar_movimiento(v_id, 'inventario_inicial', v_stock, v_costo, 'producto', v_id::text, 'Stock inicial');
    else
      raise exception 'El stock solo se pone al crear el producto. Para corregirlo usa un ajuste de inventario.';
    end if;
  end if;

  perform public.registrar_evento(auth.uid(), case when v_nuevo then 'crear_producto' else 'editar_producto' end,
    'producto', v_id::text, jsonb_build_object('nombre', trim(p ->> 'nombre'), 'origen', p_origen));
  return v_id;
end;
$$;

-- Importación: varios productos en una sola operación (todo o nada).
create function public.importar_productos(p_productos jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_fila jsonb;
  v_creados int := 0;
  v_actualizados int := 0;
begin
  perform public.exigir_permiso('productos.editar');
  for v_fila in select * from jsonb_array_elements(p_productos) loop
    if nullif(v_fila ->> 'id', '') is null then v_creados := v_creados + 1; else v_actualizados := v_actualizados + 1; end if;
    perform public.guardar_producto(v_fila, 'importacion');
  end loop;
  perform public.registrar_evento(auth.uid(), 'importar_productos', 'producto', null,
    jsonb_build_object('creados', v_creados, 'actualizados', v_actualizados));
  return jsonb_build_object('creados', v_creados, 'actualizados', v_actualizados);
end;
$$;

create function public.marcar_etiquetas_impresas(p_presentaciones uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.exigir_permiso('productos.editar');
  delete from public.etiquetas_pendientes where presentacion_id = any (p_presentaciones);
end;
$$;

-- Búsqueda tolerante a errores, tildes, mayúsculas y apodos; también por código o PLU.
create function public.buscar_productos(
  p_texto text, p_limite int default 40, p_categoria uuid default null, p_incluir_inactivos boolean default false
) returns setof public.productos
language sql stable security invoker set search_path = '' as $$
  with q as (
    select trim(coalesce(p_texto, '')) as crudo, public.normalizar(p_texto) as t
  )
  select pr.*
  from public.productos pr, q
  where (p_incluir_inactivos or pr.activo)
    and (p_categoria is null or pr.categoria_id in (select public.categoria_y_descendientes(p_categoria)))
    and (
      q.t = ''
      or pr.plu = q.crudo
      or exists (select 1 from public.codigos_barras c where c.producto_id = pr.id and c.codigo = q.crudo)
      or pr.texto_busqueda like '%' || q.t || '%'
      or pr.texto_busqueda like '%' || replace(q.t, ' ', '') || '%'
      or extensions.word_similarity(q.t, pr.texto_busqueda) >= 0.45
    )
  order by
    (pr.plu = q.crudo) desc,
    exists (select 1 from public.codigos_barras c where c.producto_id = pr.id and c.codigo = q.crudo) desc,
    (pr.texto_busqueda like q.t || '%') desc,
    extensions.word_similarity(q.t, pr.texto_busqueda) desc,
    pr.nombre
  limit p_limite;
$$;

-- -----------------------------------------------------------------------------
-- Reglas de acceso (RLS)
-- -----------------------------------------------------------------------------
alter table public.categorias enable row level security;
alter table public.productos enable row level security;
alter table public.presentaciones enable row level security;
alter table public.codigos_barras enable row level security;
alter table public.producto_costos enable row level security;
alter table public.existencias enable row level security;
alter table public.movimientos_stock enable row level security;
alter table public.historial_precios enable row level security;
alter table public.etiquetas_pendientes enable row level security;

create policy "ver categorías" on public.categorias for select to authenticated
  using (public.tiene_permiso('productos.ver'));
create policy "ver productos" on public.productos for select to authenticated
  using (public.tiene_permiso('productos.ver'));
create policy "ver presentaciones" on public.presentaciones for select to authenticated
  using (public.tiene_permiso('productos.ver'));
create policy "ver códigos" on public.codigos_barras for select to authenticated
  using (public.tiene_permiso('productos.ver'));
create policy "ver stock" on public.existencias for select to authenticated
  using (public.tiene_permiso('productos.ver'));
create policy "solo quien ve costos" on public.producto_costos for select to authenticated
  using (public.tiene_permiso('costos.ver'));
create policy "kardex: solo quien ve costos" on public.movimientos_stock for select to authenticated
  using (public.tiene_permiso('costos.ver'));
create policy "historial de precios de venta" on public.historial_precios for select to authenticated
  using ((tipo = 'venta' and (public.tiene_permiso('precios.cambiar') or public.tiene_permiso('costos.ver')))
         or (tipo = 'costo' and public.tiene_permiso('costos.ver')));
create policy "etiquetas pendientes" on public.etiquetas_pendientes for select to authenticated
  using (public.tiene_permiso('productos.editar'));

revoke insert, update, delete, truncate on
  public.categorias, public.productos, public.presentaciones, public.codigos_barras, public.producto_costos,
  public.existencias, public.movimientos_stock, public.historial_precios, public.etiquetas_pendientes
from anon, authenticated;
revoke all on
  public.categorias, public.productos, public.presentaciones, public.codigos_barras, public.producto_costos,
  public.existencias, public.movimientos_stock, public.historial_precios, public.etiquetas_pendientes
from anon;
revoke all on sequence public.codigo_interno_seq from anon, authenticated;

-- Las tablas nuevas de las próximas fases tampoco quedan abiertas por defecto.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke insert, update, delete, truncate on tables from authenticated;

revoke execute on all functions in schema public from public, anon;
revoke execute on function
  public.registrar_movimiento(uuid, text, numeric, numeric, text, text, text),
  public.ean13_verificador(text),
  public.actualizar_texto_busqueda()
from authenticated;

grant execute on function
  public.normalizar(text),
  public.actualizar_ajustes(int, numeric, numeric),
  public.valores_categoria(uuid),
  public.categoria_y_descendientes(uuid),
  public.generar_codigo_interno(),
  public.siguiente_plu(),
  public.guardar_categoria(jsonb),
  public.guardar_producto(jsonb, text),
  public.importar_productos(jsonb),
  public.marcar_etiquetas_impresas(uuid[]),
  public.buscar_productos(text, int, uuid, boolean)
to authenticated;

grant execute on function
  public.registrar_movimiento(uuid, text, numeric, numeric, text, text, text),
  public.ean13_verificador(text)
to service_role;

-- -----------------------------------------------------------------------------
-- Fotos de productos (carpeta pública para que el punto de venta cargue rápido;
-- solo quien edita productos puede subir).
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos-productos', 'fotos-productos', true, 3145728, array['image/jpeg', 'image/png', 'image/webp']);

create policy "subir fotos de productos" on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos-productos' and public.tiene_permiso('productos.editar'));
create policy "reemplazar fotos de productos" on storage.objects for update to authenticated
  using (bucket_id = 'fotos-productos' and public.tiene_permiso('productos.editar'));
create policy "borrar fotos de productos" on storage.objects for delete to authenticated
  using (bucket_id = 'fotos-productos' and public.tiene_permiso('productos.editar'));

-- -----------------------------------------------------------------------------
-- Categorías por defecto (se pueden cambiar). IVA y margen: valores iniciales
-- editables; el IVA debe revisarlo el contador antes de facturar (fase 7).
-- -----------------------------------------------------------------------------
do $$
declare
  raiz record;
  hija text;
  v_padre uuid;
  orden_raiz int := 0;
  orden_hija int;
begin
  for raiz in
    select * from (values
      ('Bebidas', '#2563eb', '15', 20::numeric, array['Gaseosas', 'Aguas', 'Jugos y néctares', 'Energizantes e hidratantes']),
      ('Cervezas y bebidas alcohólicas', '#b45309', '15', 15, array['Cervezas', 'Licores', 'Vinos']),
      ('Helados', '#db2777', '15', 25, array[]::text[]),
      ('Lácteos', '#0ea5e9', '0', 15, array['Leche', 'Yogurt', 'Quesos', 'Mantequilla']),
      ('Carnes y embutidos', '#dc2626', '0', 20, array['Pollo', 'Res', 'Cerdo', 'Embutidos']),
      ('Congelados y refrigerados', '#0891b2', '15', 20, array[]::text[]),
      ('Víveres', '#ca8a04', '0', 15, array['Arroz', 'Azúcar y endulzantes', 'Aceites', 'Granos', 'Fideos', 'Harinas', 'Enlatados', 'Huevos', 'Condimentos', 'Café e infusiones']),
      ('Panadería', '#a16207', '0', 25, array[]::text[]),
      ('Frutas y verduras', '#16a34a', '0', 30, array['Tubérculos (papas)', 'Verduras', 'Frutas']),
      ('Golosinas y snacks', '#9333ea', '15', 35, array['Caramelos', 'Chocolates', 'Galletas', 'Snacks']),
      ('Cigarrillos', '#57534e', '15', 10, array[]::text[]),
      ('Botiquín', '#e11d48', '0', 25, array[]::text[]),
      ('Limpieza y hogar', '#0d9488', '15', 25, array[]::text[]),
      ('Aseo personal', '#7c3aed', '15', 25, array[]::text[]),
      ('Ferretería', '#475569', '15', 30, array[]::text[]),
      ('Papelería y útiles', '#4f46e5', '15', 30, array[]::text[]),
      ('Mascotas', '#ea580c', '15', 25, array[]::text[]),
      ('Hielo', '#38bdf8', '15', 40, array[]::text[]),
      ('Varios', '#64748b', '15', 25, array[]::text[])
    ) as t(nombre, color, iva, margen, hijas)
  loop
    orden_raiz := orden_raiz + 1;
    insert into public.categorias (nombre, color, tarifa_iva, margen_objetivo, orden)
    values (raiz.nombre, raiz.color, raiz.iva, raiz.margen, orden_raiz) returning id into v_padre;
    orden_hija := 0;
    foreach hija in array raiz.hijas loop
      orden_hija := orden_hija + 1;
      insert into public.categorias (nombre, padre_id, color, orden) values (hija, v_padre, raiz.color, orden_hija);
    end loop;
  end loop;
  -- Dentro de Víveres, condimentos y café van con 15%.
  update public.categorias set tarifa_iva = '15'
   where nombre in ('Condimentos', 'Café e infusiones');
end;
$$;
