-- Decisión del 29/10/2026: sin IVA y sin volver a pedir el costo al sumar stock.
-- Si al sumar mercadería no se manda costo, se usa el costo que ya tiene el
-- producto (así el kardex sabe cuánto vale lo que entró y el promedio no cambia).
create or replace function public.ajustar_stock(
  p_producto uuid, p_tipo text, p_cantidad numeric, p_costo numeric default null, p_nota text default ''
) returns numeric
language plpgsql security definer set search_path = '' as $$
declare
  v_stock numeric;
  v_diferencia numeric;
  v_saldo numeric;
  v_nombre text;
  v_costo numeric := p_costo;
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
  if v_costo is not null and v_costo < 0 then
    raise exception 'El costo no puede ser negativo.';
  end if;

  select nombre into v_nombre from public.productos where id = p_producto;
  if not found then raise exception 'No se encontró el producto.'; end if;
  select cantidad into v_stock from public.existencias where producto_id = p_producto;
  v_stock := coalesce(v_stock, 0);

  if p_tipo = 'compra' then
    v_diferencia := p_cantidad;
    if v_costo is null then
      select nullif(costo_promedio, 0) into v_costo from public.producto_costos where producto_id = p_producto;
    end if;
  elsif p_tipo = 'conteo' then
    v_diferencia := p_cantidad - v_stock;
    if v_diferencia = 0 then return v_stock; end if;
  else
    v_diferencia := -p_cantidad;
  end if;

  v_saldo := public.registrar_movimiento(
    p_producto, p_tipo, v_diferencia,
    case when p_tipo = 'compra' then v_costo end,
    'ajuste', null, coalesce(p_nota, ''));

  perform public.registrar_evento(auth.uid(), 'ajustar_stock', 'producto', p_producto::text,
    jsonb_build_object('producto', v_nombre, 'tipo', p_tipo, 'cantidad', v_diferencia,
                       'antes', v_stock, 'despues', v_saldo, 'nota', coalesce(p_nota, '')));
  return v_saldo;
end;
$$;
