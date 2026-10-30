-- El correo al que llega el resumen del día al cerrar la caja (vacío = el de la administradora).
create or replace function public.guardar_ajustes_venta(p jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.exigir_permiso('ajustes.gestionar');
  if coalesce(trim(p ->> 'correo_resumen'), '') <> '' and trim(p ->> 'correo_resumen') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'El correo no es válido.';
  end if;
  update public.ajustes set
    venta_sin_stock = coalesce(nullif(p ->> 'venta_sin_stock', ''), venta_sin_stock),
    deuna_qr_ruta = case when p ? 'deuna_qr_ruta' then nullif(p ->> 'deuna_qr_ruta', '') else deuna_qr_ruta end,
    banco = coalesce(p -> 'banco', banco),
    ticket_ancho = coalesce(nullif(p ->> 'ticket_ancho', '')::int, ticket_ancho),
    ticket_mensaje = coalesce(p ->> 'ticket_mensaje', ticket_mensaje),
    alcohol_desde = case when p ? 'alcohol_desde' then nullif(p ->> 'alcohol_desde', '')::time else alcohol_desde end,
    alcohol_hasta = case when p ? 'alcohol_hasta' then nullif(p ->> 'alcohol_hasta', '')::time else alcohol_hasta end,
    correo_resumen = case when p ? 'correo_resumen' then trim(p ->> 'correo_resumen') else correo_resumen end,
    actualizado_en = now()
  where id = 1;
  perform public.registrar_evento(auth.uid(), 'cambiar_ajustes', 'ajustes', '1', p);
end;
$$;

-- A quién mandar el resumen: el correo configurado o el de la primera administradora activa.
create function public.correo_resumen_dia() returns text
language sql stable security definer set search_path = '' as $$
  select coalesce(
    nullif((select correo_resumen from public.ajustes where id = 1), ''),
    (select pf.correo from public.perfiles pf join public.roles r on r.id = pf.rol_id
     where r.es_administradora and pf.estado = 'activo' order by pf.creado_en limit 1))
  where public.tiene_permiso('caja.abrir_cerrar');
$$;
revoke execute on function public.correo_resumen_dia() from public, anon;
grant execute on function public.correo_resumen_dia() to authenticated;
