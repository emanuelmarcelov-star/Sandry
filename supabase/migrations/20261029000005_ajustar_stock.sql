-- =============================================================================
-- Ajuste rápido de stock desde la ficha del producto (antes de la fase 4).
--
--  * 'compra'  : sumar mercadería que llegó (p_cantidad > 0, costo real opcional
--                por unidad base → recalcula el costo promedio).
--  * 'conteo'  : p_cantidad = lo que realmente hay; se registra la diferencia.
--  * 'merma', 'caducado', 'robo', 'autoconsumo', 'regalo': sacar p_cantidad (> 0).
-- Todo queda en el kardex y en la bitácora. Las cantidades van en unidad base.
-- =============================================================================
create function public.ajustar_stock(
  p_producto uuid, p_tipo text, p_cantidad numeric, p_costo numeric default null, p_nota text default ''
) returns numeric
language plpgsql security definer set search_path = '' as $$
declare
  v_stock numeric;
  v_diferencia numeric;
  v_saldo numeric;
  v_nombre text;
begin
  if p_tipo = 'compra' then
    perform public.exigir_permiso('compras.registrar');
  else
    perform public.exigir_permiso('inventario.ajustar');
  end if;
  if p_tipo not in ('compra', 'conteo', 'merma', 'caducado', 'robo', 'autoconsumo', 'regalo') then
    raise exception 'Tipo de ajuste no válido.';
  end if;
  if p_cantidad is null or p_cantidad < 0 or (p_tipo <> 'conteo' and p_cantidad = 0) then
    raise exception 'Escribe una cantidad mayor que 0.';
  end if;
  if p_costo is not null and p_costo < 0 then
    raise exception 'El costo no puede ser negativo.';
  end if;

  select nombre into v_nombre from public.productos where id = p_producto;
  if not found then raise exception 'No se encontró el producto.'; end if;
  select cantidad into v_stock from public.existencias where producto_id = p_producto;
  v_stock := coalesce(v_stock, 0);

  if p_tipo = 'compra' then
    v_diferencia := p_cantidad;
  elsif p_tipo = 'conteo' then
    v_diferencia := p_cantidad - v_stock;
    if v_diferencia = 0 then return v_stock; end if;
  else
    v_diferencia := -p_cantidad;
  end if;

  v_saldo := public.registrar_movimiento(
    p_producto, p_tipo, v_diferencia,
    case when p_tipo = 'compra' then p_costo end,
    'ajuste', null, coalesce(p_nota, ''));

  perform public.registrar_evento(auth.uid(), 'ajustar_stock', 'producto', p_producto::text,
    jsonb_build_object('producto', v_nombre, 'tipo', p_tipo, 'cantidad', v_diferencia,
                       'antes', v_stock, 'despues', v_saldo, 'nota', coalesce(p_nota, '')));
  return v_saldo;
end;
$$;

revoke execute on function public.ajustar_stock(uuid, text, numeric, numeric, text) from public, anon;
grant execute on function public.ajustar_stock(uuid, text, numeric, numeric, text) to authenticated;
