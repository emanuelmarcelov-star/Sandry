-- Corrige generar_codigo_interno: la variable se nombraba de una forma que
-- PostgreSQL no acepta dentro de la consulta.
create or replace function public.generar_codigo_interno() returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_doce text;
  v_codigo text;
begin
  perform public.exigir_permiso('productos.editar');
  loop
    v_doce := '29' || lpad(nextval('public.codigo_interno_seq')::text, 10, '0');
    v_codigo := v_doce || public.ean13_verificador(v_doce);
    exit when not exists (select 1 from public.codigos_barras c where c.codigo = v_codigo);
  end loop;
  return v_codigo;
end;
$$;
