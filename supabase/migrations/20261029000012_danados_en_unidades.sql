-- Los dañados de una compra se cuentan en UNIDADES BASE ("1 botella rota"),
-- no en la presentación comprada (antes había que escribir 1/12 de jaba).
comment on column public.compra_lineas.danados is 'Dañados, en unidad base';

create or replace function public.entrar_compra(p_compra uuid) returns jsonb
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
      perform public.registrar_movimiento(v_linea.producto_id, 'merma', -v_linea.danados, null,
        'compra', p_compra::text, 'Llegó dañado');
    end if;
    if v_linea.vence is not null and v_unidades + v_linea.bonificacion * v_linea.factor - v_linea.danados > 0 then
      insert into public.lotes (producto_id, vence, cantidad, cantidad_inicial, compra_id)
      values (v_linea.producto_id, v_linea.vence,
              round(v_unidades + v_linea.bonificacion * v_linea.factor - v_linea.danados, 3),
              round(v_unidades + v_linea.bonificacion * v_linea.factor - v_linea.danados, 3), p_compra);
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

create or replace function public.guardar_lineas_compra(p_compra uuid, p_lineas jsonb) returns numeric
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
    if coalesce(nullif(v_l ->> 'danados', '')::numeric, 0) > (v_cantidad + v_bonif) * v_factor then
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
