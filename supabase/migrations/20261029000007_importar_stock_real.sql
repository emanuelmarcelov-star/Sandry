-- =============================================================================
-- Importar Excel (decisión del 29/10/2026): para productos que YA existen,
-- «Cuántos tengo» es el stock REAL. Si cambió, se registra como corrección de
-- conteo; si es igual, no pasa nada. Así se puede descargar el Excel, editarlo
-- y volver a importarlo sin duplicar el stock.
-- Cada producto puede traer 'stock_real' (en unidad base); los nuevos siguen
-- usando 'stock_inicial'.
-- =============================================================================
create or replace function public.importar_productos(p_productos jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_fila jsonb;
  v_id uuid;
  v_stock numeric;
  v_real numeric;
  v_creados int := 0;
  v_actualizados int := 0;
  v_corregidos int := 0;
begin
  perform public.exigir_permiso('productos.editar');
  for v_fila in select * from jsonb_array_elements(p_productos) loop
    if nullif(v_fila ->> 'id', '') is null then v_creados := v_creados + 1; else v_actualizados := v_actualizados + 1; end if;
    v_id := public.guardar_producto(v_fila - 'stock_real', 'importacion');

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
  end loop;
  perform public.registrar_evento(auth.uid(), 'importar_productos', 'producto', null,
    jsonb_build_object('creados', v_creados, 'actualizados', v_actualizados, 'stock_corregido', v_corregidos));
  return jsonb_build_object('creados', v_creados, 'actualizados', v_actualizados, 'stock_corregido', v_corregidos);
end;
$$;
