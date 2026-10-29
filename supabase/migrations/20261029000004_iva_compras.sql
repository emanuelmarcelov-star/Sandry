-- =============================================================================
-- IVA solo en las compras (decisión del 29/10/2026)
-- La tienda pone el precio de venta libremente. El IVA importa solo para saber
-- el costo REAL: costo de compra × (1 + iva_compras) cuando la compra tiene IVA.
-- =============================================================================

alter table public.ajustes
  add column iva_compras numeric(5, 2) not null default 15 check (iva_compras between 0 and 100);

-- Cada producto recuerda si normalmente se compra con IVA (para sugerirlo en compras).
alter table public.productos
  add column compra_con_iva boolean not null default false;

drop function public.actualizar_ajustes(int, numeric, numeric);
create function public.actualizar_ajustes(
  p_minutos_inactividad int, p_descuento_max numeric, p_redondeo_precio numeric default null,
  p_iva_compras numeric default null
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
         iva_compras = coalesce(p_iva_compras, iva_compras),
         actualizado_en = now()
   where id = 1;
  perform public.registrar_evento(auth.uid(), 'cambiar_ajustes', 'ajustes', '1',
    jsonb_build_object('antes', antes - 'actualizado_en',
      'despues', (select to_jsonb(a) - 'actualizado_en' from public.ajustes a where id = 1)));
end;
$$;
revoke execute on function public.actualizar_ajustes(int, numeric, numeric, numeric) from public, anon;
grant execute on function public.actualizar_ajustes(int, numeric, numeric, numeric) to authenticated;

-- guardar_producto: ahora también guarda compra_con_iva.
create or replace function public.guardar_producto(p jsonb, p_origen text default 'manual') returns uuid
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
                                  stock_minimo, maneja_caducidad, retornable, solo_mayores, ubicacion, activo, compra_con_iva)
    values (
      trim(p ->> 'nombre'), coalesce(trim(p ->> 'marca'), ''), nullif(p ->> 'categoria_id', '')::uuid, v_plu,
      coalesce(array(select trim(x) from jsonb_array_elements_text(coalesce(p -> 'sinonimos', '[]')) x where trim(x) <> ''), '{}'),
      nullif(p ->> 'foto_ruta', ''), coalesce(nullif(p ->> 'unidad_base', ''), 'unidad'),
      coalesce(nullif(p ->> 'tarifa_iva', ''), '15'), coalesce(nullif(p ->> 'stock_minimo', '')::numeric, 0),
      coalesce((p ->> 'maneja_caducidad')::boolean, false), coalesce((p ->> 'retornable')::boolean, false),
      coalesce((p ->> 'solo_mayores')::boolean, false), coalesce(trim(p ->> 'ubicacion'), ''),
      coalesce((p ->> 'activo')::boolean, true), coalesce((p ->> 'compra_con_iva')::boolean, false)
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
      compra_con_iva = coalesce((p ->> 'compra_con_iva')::boolean, compra_con_iva),
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

