-- =============================================================================
-- Decisión del 29/10/2026:
--  1) Sin subcategorías: solo categorías principales. Los productos que estaban
--     en una subcategoría pasan a su categoría principal.
--  2) Importar Excel: la hoja «Compras» SUMA lo que entró ('stock_sumar', en
--     unidad base, con su costo 'costo_sumar' por unidad base).
-- =============================================================================

-- 1) Subcategorías → categoría principal (de abajo hacia arriba por si hay varios niveles).
do $$
declare
  v_movidos int;
begin
  loop
    update public.productos p
       set categoria_id = c.padre_id
      from public.categorias c
     where p.categoria_id = c.id and c.padre_id is not null;
    get diagnostics v_movidos = row_count;
    delete from public.categorias c
     where c.padre_id is not null
       and not exists (select 1 from public.categorias h where h.padre_id = c.id);
    exit when not exists (select 1 from public.categorias where padre_id is not null);
  end loop;
end;
$$;

-- 2) Importar: después de guardar el producto y corregir el stock real, suma lo que entró.
create or replace function public.importar_productos(p_productos jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_fila jsonb;
  v_id uuid;
  v_stock numeric;
  v_real numeric;
  v_sumar numeric;
  v_creados int := 0;
  v_actualizados int := 0;
  v_corregidos int := 0;
  v_comprados int := 0;
begin
  perform public.exigir_permiso('productos.editar');
  for v_fila in select * from jsonb_array_elements(p_productos) loop
    if nullif(v_fila ->> 'id', '') is null then v_creados := v_creados + 1; else v_actualizados := v_actualizados + 1; end if;
    v_id := public.guardar_producto(v_fila - 'stock_real' - 'stock_sumar' - 'costo_sumar', 'importacion');

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
  end loop;
  perform public.registrar_evento(auth.uid(), 'importar_productos', 'producto', null,
    jsonb_build_object('creados', v_creados, 'actualizados', v_actualizados,
                       'stock_corregido', v_corregidos, 'compras', v_comprados));
  return jsonb_build_object('creados', v_creados, 'actualizados', v_actualizados,
                            'stock_corregido', v_corregidos, 'compras', v_comprados);
end;
$$;
