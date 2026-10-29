-- =============================================================================
-- Fase 2 · Usuarios, roles, permisos, PIN y bitácora
--
-- Reglas:
--  * RLS activado en TODAS las tablas.
--  * Los cambios sensibles (aprobar, cambiar rol, permisos, PIN) solo se hacen
--    con funciones que revisan el permiso y dejan constancia en la bitácora.
--  * El PIN vive en una tabla aparte sin acceso directo para nadie.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- Roles y permisos
-- -----------------------------------------------------------------------------
create table public.roles (
  id                text primary key,
  nombre            text not null,
  descripcion       text not null default '',
  es_administradora boolean not null default false,
  orden             int not null default 0
);

create table public.permisos (
  codigo      text primary key,
  grupo       text not null,
  descripcion text not null,
  orden       int not null default 0
);

create table public.rol_permisos (
  rol_id  text not null references public.roles (id) on delete cascade,
  permiso text not null references public.permisos (codigo) on delete cascade,
  primary key (rol_id, permiso)
);

insert into public.roles (id, nombre, descripcion, es_administradora, orden) values
  ('administradora', 'Administradora', 'La dueña. Tiene acceso a todo.', true, 1),
  ('cajera', 'Trabajadora / Cajera', 'Vende, abre y cierra su caja, registra clientes y fiados.', false, 2),
  ('inventario', 'Encargada de inventario', 'Registra compras, recibe mercadería y cuenta inventario.', false, 3);

insert into public.permisos (codigo, grupo, descripcion, orden) values
  ('ventas.vender',            'Ventas',     'Vender en el punto de venta', 10),
  ('ventas.ver_propias',       'Ventas',     'Ver sus propias ventas del día', 11),
  ('ventas.ver_todas',         'Ventas',     'Ver las ventas de todas', 12),
  ('ventas.anular',            'Ventas',     'Anular ventas y hacer devoluciones', 13),
  ('ventas.descuento_mayor',   'Ventas',     'Dar descuentos mayores al límite sin PIN de la administradora', 14),
  ('caja.abrir_cerrar',        'Caja',       'Abrir y cerrar su caja', 20),
  ('caja.reabrir',             'Caja',       'Reabrir una caja cerrada', 21),
  ('clientes.gestionar',       'Clientes',   'Registrar clientes y fiados (hasta el límite de cada cliente)', 30),
  ('productos.ver',            'Productos',  'Buscar productos y ver stock y precios de venta', 40),
  ('productos.editar',         'Productos',  'Crear y editar productos y categorías', 41),
  ('precios.cambiar',          'Productos',  'Cambiar precios de venta', 42),
  ('costos.ver',               'Productos',  'Ver costos de compra', 43),
  ('compras.registrar',        'Compras',    'Registrar compras y viajes de compras', 50),
  ('compras.recibir',          'Compras',    'Recibir la mercadería de un distribuidor', 51),
  ('inventario.contar',        'Inventario', 'Hacer conteos de inventario', 60),
  ('inventario.ajustar',       'Inventario', 'Ajustar stock (mermas, daños, autoconsumo)', 61),
  ('gastos.registrar',         'Gastos',     'Registrar gastos del negocio', 70),
  ('reportes.ver',             'Reportes',   'Ver ganancias y reportes del negocio', 80),
  ('usuarios.gestionar',       'Ajustes',    'Aprobar usuarias, cambiar roles y permisos', 90),
  ('ajustes.gestionar',        'Ajustes',    'Cambiar los ajustes de la tienda', 91),
  ('bitacora.ver',             'Ajustes',    'Ver la bitácora de cambios', 92);

-- La administradora tiene todo por ser administradora; igual se guardan sus
-- casillas para que la pantalla las muestre marcadas.
insert into public.rol_permisos (rol_id, permiso)
select 'administradora', codigo from public.permisos;

insert into public.rol_permisos (rol_id, permiso) values
  ('cajera', 'ventas.vender'),
  ('cajera', 'ventas.ver_propias'),
  ('cajera', 'caja.abrir_cerrar'),
  ('cajera', 'clientes.gestionar'),
  ('cajera', 'productos.ver'),
  ('inventario', 'productos.ver'),
  ('inventario', 'costos.ver'),
  ('inventario', 'compras.registrar'),
  ('inventario', 'compras.recibir'),
  ('inventario', 'inventario.contar'),
  ('inventario', 'inventario.ajustar');

-- -----------------------------------------------------------------------------
-- Ajustes de la tienda (una sola fila)
-- -----------------------------------------------------------------------------
create table public.ajustes (
  id                             smallint primary key default 1 check (id = 1),
  nombre_tienda                  text not null default 'Sandry',
  minutos_inactividad            int not null default 30 check (minutos_inactividad between 1 and 480),
  descuento_max_sin_autorizacion numeric(5, 2) not null default 5
    check (descuento_max_sin_autorizacion between 0 and 100),
  actualizado_en                 timestamptz not null default now()
);
insert into public.ajustes (id) values (1);

-- -----------------------------------------------------------------------------
-- Perfiles de las personas
-- -----------------------------------------------------------------------------
create type public.estado_usuario as enum ('pendiente', 'activo', 'desactivado');

create table public.perfiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  nombre_completo text not null,
  correo          text not null,
  telefono        text not null default '',
  cedula          text check (cedula is null or cedula ~ '^[0-9]{10}$'),
  foto_ruta       text,
  rol_id          text references public.roles (id),
  estado          public.estado_usuario not null default 'pendiente',
  creado_en       timestamptz not null default now(),
  aprobado_por    uuid references public.perfiles (id),
  aprobado_en     timestamptz,
  constraint activo_requiere_rol check (estado <> 'activo' or rol_id is not null)
);
create unique index perfiles_cedula_unica on public.perfiles (cedula) where cedula is not null;
create index perfiles_telefono on public.perfiles (telefono);

-- El PIN va aparte: nadie lo puede leer, ni siquiera su dueña.
create table public.pines (
  usuario_id       uuid primary key references public.perfiles (id) on delete cascade,
  pin_hash         text not null,
  intentos_fallidos int not null default 0,
  bloqueado_hasta  timestamptz,
  actualizado_en   timestamptz not null default now()
);

-- Qué personas han iniciado sesión con contraseña en cada dispositivo
-- (solo esas pueden cambiar de usuario con PIN en ese dispositivo).
create table public.dispositivo_usuarios (
  dispositivo_id uuid not null,
  usuario_id     uuid not null references public.perfiles (id) on delete cascade,
  ultimo_acceso  timestamptz not null default now(),
  primary key (dispositivo_id, usuario_id)
);

-- Límite de intentos para "Olvidé mi correo".
create table public.intentos_recuperar_correo (
  id    bigint generated always as identity primary key,
  clave text not null,
  fecha timestamptz not null default now()
);
create index intentos_recuperar_correo_clave on public.intentos_recuperar_correo (clave, fecha);

-- -----------------------------------------------------------------------------
-- Bitácora de auditoría
-- -----------------------------------------------------------------------------
create table public.bitacora (
  id         bigint generated always as identity primary key,
  fecha      timestamptz not null default now(),
  usuario_id uuid references public.perfiles (id) on delete set null,
  accion     text not null,
  entidad    text,
  entidad_id text,
  detalle    jsonb not null default '{}'
);
create index bitacora_fecha on public.bitacora (fecha desc);

-- -----------------------------------------------------------------------------
-- Funciones de ayuda para las reglas de acceso
-- -----------------------------------------------------------------------------
create function public.usuario_activo() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.perfiles where id = auth.uid() and estado = 'activo'
  );
$$;

create function public.tiene_permiso(p_permiso text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.perfiles pf
    join public.roles r on r.id = pf.rol_id
    where pf.id = auth.uid()
      and pf.estado = 'activo'
      and (
        r.es_administradora
        or exists (
          select 1 from public.rol_permisos rp
          where rp.rol_id = r.id and rp.permiso = p_permiso
        )
      )
  );
$$;

create function public.mis_permisos() returns setof text
language sql stable security definer set search_path = '' as $$
  select p.codigo
  from public.permisos p
  where public.tiene_permiso(p.codigo);
$$;

-- Uso interno: deja una línea en la bitácora.
create function public.registrar_evento(
  p_usuario uuid, p_accion text, p_entidad text, p_entidad_id text, p_detalle jsonb default '{}'
) returns void
language sql security definer set search_path = '' as $$
  insert into public.bitacora (usuario_id, accion, entidad, entidad_id, detalle)
  values (p_usuario, p_accion, p_entidad, p_entidad_id, coalesce(p_detalle, '{}'));
$$;

create function public.cantidad_administradoras_activas() returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int
  from public.perfiles pf join public.roles r on r.id = pf.rol_id
  where pf.estado = 'activo' and r.es_administradora;
$$;

-- -----------------------------------------------------------------------------
-- Al registrarse: crear el perfil. La primera persona queda como administradora.
-- -----------------------------------------------------------------------------
create function public.crear_perfil_nuevo_usuario() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  es_primera boolean;
begin
  -- Evita que dos registros simultáneos queden ambos como "primera".
  perform pg_advisory_xact_lock(hashtext('sandry_primer_usuario'));
  select not exists (select 1 from public.perfiles) into es_primera;

  insert into public.perfiles (id, nombre_completo, correo, telefono, cedula, rol_id, estado, aprobado_en)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'nombre_completo'), ''), split_part(coalesce(new.email, ''), '@', 1)),
    coalesce(new.email, ''),
    coalesce(trim(new.raw_user_meta_data ->> 'telefono'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'cedula'), ''),
    case when es_primera then 'administradora' end,
    case when es_primera then 'activo'::public.estado_usuario else 'pendiente'::public.estado_usuario end,
    case when es_primera then now() end
  );

  perform public.registrar_evento(
    new.id,
    case when es_primera then 'registro_primera_administradora' else 'registro' end,
    'usuario', new.id::text, '{}'
  );
  return new;
end;
$$;

create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.crear_perfil_nuevo_usuario();

-- Si cambia el correo de inicio de sesión, se actualiza en el perfil.
create function public.sincronizar_correo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.email is distinct from old.email then
    update public.perfiles set correo = coalesce(new.email, '') where id = new.id;
  end if;
  return new;
end;
$$;

create trigger al_cambiar_correo
  after update of email on auth.users
  for each row execute function public.sincronizar_correo();

-- -----------------------------------------------------------------------------
-- Acciones de la administradora (revisan permiso y dejan bitácora)
-- -----------------------------------------------------------------------------
create function public.exigir_permiso(p_permiso text) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.tiene_permiso(p_permiso) then
    raise exception 'No tienes permiso para hacer esto.' using errcode = '42501';
  end if;
end;
$$;

create function public.aprobar_usuario(p_usuario uuid, p_rol text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.exigir_permiso('usuarios.gestionar');
  if not exists (select 1 from public.roles where id = p_rol) then
    raise exception 'Ese rol no existe.';
  end if;
  update public.perfiles
     set estado = 'activo', rol_id = p_rol, aprobado_por = auth.uid(), aprobado_en = now()
   where id = p_usuario and estado = 'pendiente';
  if not found then
    raise exception 'Esa persona no está pendiente de aprobación.';
  end if;
  perform public.registrar_evento(auth.uid(), 'aprobar_usuario', 'usuario', p_usuario::text,
    jsonb_build_object('rol', p_rol));
end;
$$;

create function public.cambiar_rol_usuario(p_usuario uuid, p_rol text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  rol_anterior text;
begin
  perform public.exigir_permiso('usuarios.gestionar');
  if p_usuario = auth.uid() then
    raise exception 'No puedes cambiar tu propio rol.';
  end if;
  if not exists (select 1 from public.roles where id = p_rol) then
    raise exception 'Ese rol no existe.';
  end if;
  select rol_id into rol_anterior from public.perfiles where id = p_usuario for update;
  if not found then
    raise exception 'No se encontró a esa persona.';
  end if;
  update public.perfiles set rol_id = p_rol where id = p_usuario;
  if public.cantidad_administradoras_activas() = 0 then
    raise exception 'Debe quedar al menos una administradora activa.';
  end if;
  perform public.registrar_evento(auth.uid(), 'cambiar_rol', 'usuario', p_usuario::text,
    jsonb_build_object('antes', rol_anterior, 'despues', p_rol));
end;
$$;

create function public.cambiar_estado_usuario(p_usuario uuid, p_activo boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  estado_actual public.estado_usuario;
begin
  perform public.exigir_permiso('usuarios.gestionar');
  if p_usuario = auth.uid() then
    raise exception 'No puedes desactivarte a ti misma.';
  end if;
  select estado into estado_actual from public.perfiles where id = p_usuario for update;
  if not found then
    raise exception 'No se encontró a esa persona.';
  end if;
  if p_activo and estado_actual <> 'desactivado' then
    raise exception 'Solo se puede reactivar a alguien desactivado.';
  end if;
  if not p_activo and estado_actual = 'desactivado' then
    raise exception 'Esa persona ya está desactivada.';
  end if;

  update public.perfiles
     set estado = case when p_activo then 'activo'::public.estado_usuario else 'desactivado'::public.estado_usuario end
   where id = p_usuario;
  if public.cantidad_administradoras_activas() = 0 then
    raise exception 'Debe quedar al menos una administradora activa.';
  end if;
  -- Quien se desactiva pierde también el acceso rápido con PIN.
  if not p_activo then
    delete from public.dispositivo_usuarios where usuario_id = p_usuario;
  end if;
  perform public.registrar_evento(auth.uid(),
    case when p_activo then 'reactivar_usuario' else 'desactivar_usuario' end,
    'usuario', p_usuario::text, '{}');
end;
$$;

create function public.actualizar_permisos_rol(p_rol text, p_permisos text[]) returns void
language plpgsql security definer set search_path = '' as $$
declare
  antes text[];
begin
  perform public.exigir_permiso('usuarios.gestionar');
  if exists (select 1 from public.roles where id = p_rol and es_administradora) then
    raise exception 'Los permisos de la administradora no se pueden quitar.';
  end if;
  if not exists (select 1 from public.roles where id = p_rol) then
    raise exception 'Ese rol no existe.';
  end if;
  if exists (select 1 from unnest(p_permisos) x where x not in (select codigo from public.permisos)) then
    raise exception 'Hay un permiso que no existe.';
  end if;

  select coalesce(array_agg(permiso order by permiso), '{}') into antes
    from public.rol_permisos where rol_id = p_rol;
  delete from public.rol_permisos where rol_id = p_rol;
  insert into public.rol_permisos (rol_id, permiso)
    select p_rol, x from (select distinct unnest(p_permisos) as x) s;

  perform public.registrar_evento(auth.uid(), 'cambiar_permisos', 'rol', p_rol,
    jsonb_build_object('antes', antes, 'despues', (select coalesce(array_agg(distinct x order by x), '{}') from unnest(p_permisos) x)));
end;
$$;

create function public.actualizar_ajustes(p_minutos_inactividad int, p_descuento_max numeric) returns void
language plpgsql security definer set search_path = '' as $$
declare
  antes jsonb;
begin
  perform public.exigir_permiso('ajustes.gestionar');
  select to_jsonb(a) into antes from public.ajustes a where id = 1;
  update public.ajustes
     set minutos_inactividad = p_minutos_inactividad,
         descuento_max_sin_autorizacion = p_descuento_max,
         actualizado_en = now()
   where id = 1;
  perform public.registrar_evento(auth.uid(), 'cambiar_ajustes', 'ajustes', '1',
    jsonb_build_object('antes', antes - 'actualizado_en',
      'despues', jsonb_build_object('minutos_inactividad', p_minutos_inactividad,
                                    'descuento_max_sin_autorizacion', p_descuento_max)));
end;
$$;

-- -----------------------------------------------------------------------------
-- Datos propios
-- -----------------------------------------------------------------------------
create function public.actualizar_mi_perfil(
  p_nombre_completo text, p_telefono text, p_cedula text, p_foto_ruta text
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión.';
  end if;
  if coalesce(trim(p_nombre_completo), '') = '' then
    raise exception 'El nombre no puede quedar vacío.';
  end if;
  update public.perfiles
     set nombre_completo = trim(p_nombre_completo),
         telefono = coalesce(trim(p_telefono), ''),
         cedula = nullif(trim(p_cedula), ''),
         foto_ruta = nullif(p_foto_ruta, '')
   where id = auth.uid();
end;
$$;

create function public.definir_mi_pin(p_pin text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.usuario_activo() then
    raise exception 'Tu cuenta no está activa.';
  end if;
  if p_pin !~ '^[0-9]{4,6}$' then
    raise exception 'El PIN debe tener de 4 a 6 números.';
  end if;
  insert into public.pines (usuario_id, pin_hash)
  values (auth.uid(), extensions.crypt(p_pin, extensions.gen_salt('bf')))
  on conflict (usuario_id) do update
    set pin_hash = excluded.pin_hash, intentos_fallidos = 0, bloqueado_hasta = null, actualizado_en = now();
  perform public.registrar_evento(auth.uid(), 'definir_pin', 'usuario', auth.uid()::text, '{}');
end;
$$;

create function public.tengo_pin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.pines where usuario_id = auth.uid());
$$;

create function public.resetear_pin(p_usuario uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.exigir_permiso('usuarios.gestionar');
  delete from public.pines where usuario_id = p_usuario;
  perform public.registrar_evento(auth.uid(), 'resetear_pin', 'usuario', p_usuario::text, '{}');
end;
$$;

-- Para el servidor: revisa un PIN. 5 errores seguidos bloquean 15 minutos.
-- Devuelve 'ok', 'incorrecto', 'bloqueado' o 'sin_pin'.
create function public.verificar_pin(p_usuario uuid, p_pin text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  fila public.pines;
begin
  select * into fila from public.pines where usuario_id = p_usuario for update;
  if not found then
    return 'sin_pin';
  end if;
  if fila.bloqueado_hasta is not null and fila.bloqueado_hasta > now() then
    return 'bloqueado';
  end if;
  if fila.pin_hash = extensions.crypt(coalesce(p_pin, ''), fila.pin_hash) then
    update public.pines set intentos_fallidos = 0, bloqueado_hasta = null where usuario_id = p_usuario;
    return 'ok';
  end if;
  update public.pines
     set intentos_fallidos = fila.intentos_fallidos + 1,
         bloqueado_hasta = case when fila.intentos_fallidos + 1 >= 5 then now() + interval '15 minutes' end
   where usuario_id = p_usuario;
  return case when fila.intentos_fallidos + 1 >= 5 then 'bloqueado' else 'incorrecto' end;
end;
$$;

-- Para el servidor: busca el correo por teléfono o cédula ("Olvidé mi correo").
create function public.buscar_correo_por_dato(p_dato text) returns text
language sql stable security definer set search_path = '' as $$
  select correo from public.perfiles
  where estado <> 'desactivado'
    and (cedula = p_dato or regexp_replace(telefono, '[^0-9]', '', 'g') = regexp_replace(p_dato, '[^0-9]', '', 'g'))
    and length(regexp_replace(p_dato, '[^0-9]', '', 'g')) >= 7
  order by creado_en
  limit 1;
$$;

-- -----------------------------------------------------------------------------
-- Reglas de acceso (RLS)
-- -----------------------------------------------------------------------------
alter table public.roles enable row level security;
alter table public.permisos enable row level security;
alter table public.rol_permisos enable row level security;
alter table public.ajustes enable row level security;
alter table public.perfiles enable row level security;
alter table public.pines enable row level security;
alter table public.dispositivo_usuarios enable row level security;
alter table public.intentos_recuperar_correo enable row level security;
alter table public.bitacora enable row level security;

create policy "usuarias activas ven los roles" on public.roles
  for select to authenticated using (public.usuario_activo());
create policy "usuarias activas ven los permisos" on public.permisos
  for select to authenticated using (public.usuario_activo());
create policy "usuarias activas ven los permisos por rol" on public.rol_permisos
  for select to authenticated using (public.usuario_activo());
create policy "usuarias activas ven los ajustes" on public.ajustes
  for select to authenticated using (public.usuario_activo());

create policy "cada una ve su perfil; quien gestiona usuarios ve todos" on public.perfiles
  for select to authenticated
  using (id = (select auth.uid()) or public.tiene_permiso('usuarios.gestionar'));

create policy "solo quien tiene permiso ve la bitácora" on public.bitacora
  for select to authenticated using (public.tiene_permiso('bitacora.ver'));

-- pines, dispositivo_usuarios e intentos_recuperar_correo: sin reglas = nadie
-- entra directo; solo las funciones de arriba y el servidor.

-- Nadie escribe directo en las tablas: todo pasa por las funciones.
revoke insert, update, delete, truncate on all tables in schema public from anon, authenticated;
revoke all on all tables in schema public from anon;

-- -----------------------------------------------------------------------------
-- Quién puede llamar a cada función
-- -----------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function
  public.usuario_activo(),
  public.tiene_permiso(text),
  public.mis_permisos(),
  public.aprobar_usuario(uuid, text),
  public.cambiar_rol_usuario(uuid, text),
  public.cambiar_estado_usuario(uuid, boolean),
  public.actualizar_permisos_rol(text, text[]),
  public.actualizar_ajustes(int, numeric),
  public.actualizar_mi_perfil(text, text, text, text),
  public.definir_mi_pin(text),
  public.tengo_pin(),
  public.resetear_pin(uuid)
to authenticated;

grant execute on function
  public.verificar_pin(uuid, text),
  public.buscar_correo_por_dato(text),
  public.registrar_evento(uuid, text, text, text, jsonb)
to service_role;

-- Las funciones nuevas que se creen después tampoco quedan abiertas por defecto.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Fotos de perfil (carpeta privada; cada una sube solo en su carpeta)
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos-perfil', 'fotos-perfil', false, 2097152, array['image/jpeg', 'image/png', 'image/webp']);

create policy "cada una sube su foto" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'fotos-perfil' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "cada una reemplaza su foto" on storage.objects
  for update to authenticated
  using (bucket_id = 'fotos-perfil' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "ver fotos: la propia o usuarias activas" on storage.objects
  for select to authenticated
  using (bucket_id = 'fotos-perfil'
         and ((storage.foldername(name))[1] = (select auth.uid())::text or public.usuario_activo()));
