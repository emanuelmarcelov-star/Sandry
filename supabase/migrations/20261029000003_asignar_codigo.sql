-- Pone un código de barras interno (EAN-13 que empieza con 29) a la
-- presentación base de un producto que no tiene ninguno. Si ya tiene, lo devuelve.
create function public.asignar_codigo_interno(p_producto uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_base uuid;
  v_codigo text;
begin
  perform public.exigir_permiso('productos.editar');
  select id into v_base from public.presentaciones where producto_id = p_producto and es_base and activa;
  if v_base is null then raise exception 'No se encontró el producto.'; end if;

  select codigo into v_codigo from public.codigos_barras
   where producto_id = p_producto and (presentacion_id = v_base or presentacion_id is null)
   order by es_interno, creado_en limit 1;
  if v_codigo is not null then return v_codigo; end if;

  v_codigo := public.generar_codigo_interno();
  insert into public.codigos_barras (codigo, producto_id, presentacion_id, es_interno)
  values (v_codigo, p_producto, v_base, true);
  perform public.registrar_evento(auth.uid(), 'asignar_codigo_interno', 'producto', p_producto::text,
    jsonb_build_object('codigo', v_codigo));
  return v_codigo;
end;
$$;

revoke execute on function public.asignar_codigo_interno(uuid) from public, anon;
grant execute on function public.asignar_codigo_interno(uuid) to authenticated;
