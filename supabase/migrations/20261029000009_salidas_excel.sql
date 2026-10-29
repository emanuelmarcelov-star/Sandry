-- =============================================================================
-- Importar Excel: hoja «Salidas» (lo que salió que no es venta).
-- Cada producto puede traer 'salidas': [{ tipo, cantidad (unidad base), nota }]
-- con tipo en merma, caducado, autoconsumo, regalo o robo. Se RESTA del stock.
-- Orden por producto: guardar → corregir stock real → sumar compras → restar salidas.
-- =============================================================================
create or replace function public.importar_productos(p_productos jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_fila jsonb;
  v_salida jsonb;
  v_id uuid;
  v_stock numeric;
  v_real numeric;
  v_sumar numeric;
  v_cantidad numeric;
  v_creados int := 0;
  v_actualizados int := 0;
  v_corregidos int := 0;
  v_comprados int := 0;
  v_salidas int := 0;
begin
  perform public.exigir_permiso('productos.editar');
  for v_fila in select * from jsonb_array_elements(p_productos) loop
    if nullif(v_fila ->> 'id', '') is null then v_creados := v_creados + 1; else v_actualizados := v_actualizados + 1; end if;
    v_id := public.guardar_producto(v_fila - 'stock_real' - 'stock_sumar' - 'costo_sumar' - 'salidas', 'importacion');

    v_real := nullif(v_fila ->> 'stock_real', '')::numeric;
    if v_real is not null then
      if v_real < 0 then raise exception 'El stock no puede ser negativo.'; end if;
      select cantidad into v_stock from public.existencias where producto_id = v_id;
      if v_real <> coalesce(v_stock, 0) then
        perform public.exigir_permiso('inventario.ajustar');
        perform public.registrar_movimiento(v_id, 'conteo', v_real - coalesce(v_stock, 0), null,
          'importacion', null, 'Corregido desde Excel');
        v_corregidos := v_corregidos + 1;
      end if;
    end if;

    v_sumar := nullif(v_fila ->> 'stock_sumar', '')::numeric;
    if v_sumar is not null and v_sumar > 0 then
      perform public.exigir_permiso('compras.registrar');
      perform public.registrar_movimiento(v_id, 'compra', v_sumar,
        coalesce(nullif(v_fila ->> 'costo_sumar', '')::numeric,
                 (select nullif(costo_promedio, 0) from public.producto_costos where producto_id = v_id)),
        'importacion', null, 'Compra desde Excel');
      v_comprados := v_comprados + 1;
    end if;

    for v_salida in select * from jsonb_array_elements(coalesce(v_fila -> 'salidas', '[]')) loop
      v_cantidad := (v_salida ->> 'cantidad')::numeric;
      if v_salida ->> 'tipo' not in ('merma', 'caducado', 'autoconsumo', 'regalo', 'robo') then
        raise exception 'Motivo de salida no válido.';
      end if;
      if v_cantidad is null or v_cantidad <= 0 then raise exception 'La cantidad que salió debe ser mayor que 0.'; end if;
      perform public.exigir_permiso('inventario.ajustar');
      perform public.registrar_movimiento(v_id, v_salida ->> 'tipo', -v_cantidad, null,
        'importacion', null, coalesce(nullif(v_salida ->> 'nota', ''), 'Salida desde Excel'));
      v_salidas := v_salidas + 1;
    end loop;
  end loop;
  perform public.registrar_evento(auth.uid(), 'importar_productos', 'producto', null,
    jsonb_build_object('creados', v_creados, 'actualizados', v_actualizados,
                       'stock_corregido', v_corregidos, 'compras', v_comprados, 'salidas', v_salidas));
  return jsonb_build_object('creados', v_creados, 'actualizados', v_actualizados,
                            'stock_corregido', v_corregidos, 'compras', v_comprados, 'salidas', v_salidas);
end;
$$;
