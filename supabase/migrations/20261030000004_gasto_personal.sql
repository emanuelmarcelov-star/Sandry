-- Gasto personal pagado con plata de la tienda = retiro de la dueña: sale de la cuenta y
-- entra a «Dinero personal» (igual que «La dueña sacó dinero»). Pagado desde «Dinero
-- personal» no toca la tienda. Anular revierte exactamente lo que se movió.
create or replace function public.registrar_gasto(p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := (p ->> 'id')::uuid;
  v_viaje uuid := nullif(p ->> 'viaje_id', '')::uuid;
  v_monto numeric := nullif(p ->> 'monto', '')::numeric;
  v_personal boolean := coalesce((p ->> 'personal')::boolean, false);
  v_categoria text;
  v_texto text;
begin
  if not (public.tiene_permiso('gastos.registrar') or (v_viaje is not null and public.tiene_permiso('compras.registrar'))) then
    raise exception 'No tienes permiso para hacer esto.' using errcode = '42501';
  end if;
  if v_id is null then raise exception 'Falta el identificador del gasto.'; end if;
  if exists (select 1 from public.gastos where id = v_id) then return v_id; end if;
  if v_monto is null or v_monto <= 0 then raise exception 'Escribe un monto mayor que 0.'; end if;
  select nombre into v_categoria from public.categorias_gasto where id = (p ->> 'categoria_id')::uuid;
  if not found then raise exception 'Elige qué fue el gasto.'; end if;
  if nullif(p ->> 'cuenta_id', '') is null then raise exception 'Elige de qué cuenta salió el dinero.'; end if;
  if v_viaje is not null and not exists (select 1 from public.viajes where id = v_viaje and estado = 'en_curso') then
    raise exception 'Ese viaje ya terminó.';
  end if;
  insert into public.gastos (id, fecha, categoria_id, descripcion, monto, cuenta_id, viaje_id, foto_ruta, usuario_id,
                             personal, vehiculo_id, galones, kilometraje, recurrente_id)
  values (v_id, coalesce(nullif(p ->> 'fecha', '')::timestamptz, now()), (p ->> 'categoria_id')::uuid,
          coalesce(trim(p ->> 'descripcion'), ''), round(v_monto, 4), (p ->> 'cuenta_id')::uuid, v_viaje,
          nullif(p ->> 'foto_ruta', ''), auth.uid(), v_personal, nullif(p ->> 'vehiculo_id', '')::uuid,
          nullif(p ->> 'galones', '')::numeric, nullif(p ->> 'kilometraje', '')::int, nullif(p ->> 'recurrente_id', '')::uuid);
  v_texto := v_categoria || coalesce(nullif(' · ' || trim(p ->> 'descripcion'), ' · '), '');
  if not v_personal then
    perform public.registrar_dinero((p ->> 'cuenta_id')::uuid, -v_monto, 'gasto', 'gasto', v_id::text, v_texto);
  elsif (p ->> 'cuenta_id')::uuid is distinct from (select id from public.cuentas_dinero where tipo = 'personal') then
    -- Lo personal pagado con plata de la tienda es un retiro de la dueña, no un gasto del negocio.
    perform public.registrar_dinero((p ->> 'cuenta_id')::uuid, -v_monto, 'retiro', 'gasto', v_id::text, v_texto || ' (personal)');
    perform public.registrar_dinero((select id from public.cuentas_dinero where tipo = 'personal'), v_monto, 'retiro', 'gasto', v_id::text, v_texto || ' (personal)');
  end if;
  -- Pagado desde «Dinero personal»: no toca la plata de la tienda; solo queda anotado.
  perform public.registrar_evento(auth.uid(), 'registrar_gasto', 'gasto', v_id::text, p);
  return v_id;
end;
$$;

create or replace function public.anular_gasto(p_gasto uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_gasto public.gastos;
  v_mov record;
begin
  perform public.exigir_permiso('gastos.registrar');
  select * into v_gasto from public.gastos where id = p_gasto and not anulado for update;
  if not found then raise exception 'Ese gasto ya está anulado.'; end if;
  update public.gastos set anulado = true where id = p_gasto;
  -- Se revierte exactamente lo que se movió al registrarlo.
  for v_mov in select cuenta_id, monto, motivo from public.movimientos_dinero
               where referencia_tipo = 'gasto' and referencia_id = p_gasto::text loop
    perform public.registrar_dinero(v_mov.cuenta_id, -v_mov.monto, v_mov.motivo, 'gasto', p_gasto::text, 'Anulación de gasto');
  end loop;
  perform public.registrar_evento(auth.uid(), 'anular_gasto', 'gasto', p_gasto::text, '{}');
end;
$$;
