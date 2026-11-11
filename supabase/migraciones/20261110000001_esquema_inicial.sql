-- =====================================================================
-- LitroGo · Esquema inicial de la base de datos (Supabase / PostgreSQL)
-- Versión 1 · 10/11/2026
--
-- Cómo usarlo: Supabase → SQL Editor → pegar este archivo completo → Run.
-- Es idempotente solo en la creación inicial: está pensado para un
-- proyecto vacío. Los cambios posteriores irán en migraciones nuevas.
--
-- Principios:
--   * Las contraseñas las gestiona Supabase Auth (tabla auth.users).
--     Aquí no se guarda ninguna contraseña ni se duplica el correo.
--   * Todas las tablas tienen Row Level Security (RLS) activado.
--   * Los datos públicos (gasolineras, precios) solo se escriben desde
--     el servidor con la clave secreta, nunca desde el navegador.
--   * Las reglas de validación viven aquí (CHECK y disparadores), no
--     solo en el JavaScript.
-- =====================================================================

begin;  -- todo el script se aplica de una vez: si algo falla, no se crea nada

-- gen_random_uuid() viene incluido en PostgreSQL 13 o superior (Supabase usa 15+).

-- ---------------------------------------------------------------------
-- 0. Tipos
-- ---------------------------------------------------------------------
create type public.tipo_cuenta   as enum ('gratuita', 'premium');
create type public.estado_alerta as enum ('activa', 'pausada', 'cumplida');
create type public.tipo_alerta   as enum ('gasolinera', 'zona');
create type public.estado_opinion as enum ('publicada', 'oculta', 'pendiente');

-- ---------------------------------------------------------------------
-- 1. Catálogos
-- ---------------------------------------------------------------------

-- Combustibles: catálogo pequeño y ampliable (GNC, hidrógeno, AdBlue...)
create table public.combustibles (
  id               text primary key check (id ~ '^[a-z0-9_]{2,20}$'),
  nombre           text not null unique,
  campo_ministerio text unique,            -- nombre del campo en la API del Ministerio
  orden            smallint not null default 100
);

-- Servicios de una estación (lavado, tienda, aire...)
create table public.servicios (
  id     text primary key check (id ~ '^[a-z0-9_]{2,30}$'),
  nombre text not null unique
);

-- Límites por tipo de cuenta: así Premium se configura sin tocar código
create table public.limites_plan (
  plan           public.tipo_cuenta primary key,
  max_favoritos  integer not null check (max_favoritos >= 0),
  max_alertas    integer not null check (max_alertas >= 0),
  max_vehiculos  integer not null check (max_vehiculos >= 0)
);

-- ---------------------------------------------------------------------
-- 2. Datos públicos: gasolineras y precios
-- ---------------------------------------------------------------------

-- El identificador es el IDEESS del Ministerio: evita duplicados al importar
create table public.gasolineras (
  id              text primary key check (id ~ '^[0-9]{1,10}$'),
  rotulo          text not null default 'Sin marca' check (char_length(rotulo) <= 120),
  direccion       text not null check (char_length(direccion) <= 250),
  localidad       text,
  municipio       text,
  id_municipio    text,
  provincia       text,
  codigo_postal   text check (codigo_postal is null or codigo_postal ~ '^[0-9]{5}$'),
  lat             double precision not null check (lat between 27 and 44.5),   -- España, Canarias incluida
  lon             double precision not null check (lon between -18.5 and 4.6),
  horario         text check (char_length(horario) <= 300),
  tipo_venta      text check (tipo_venta in ('P', 'R')),   -- P: público general, R: restringida
  margen          text check (margen in ('D', 'I', 'N')),
  activa          boolean not null default true,            -- false si desaparece del listado oficial
  actualizado_en  timestamptz not null default now()
);
create index gasolineras_lat_lon_idx on public.gasolineras (lat, lon);
create index gasolineras_municipio_idx on public.gasolineras (id_municipio);

create table public.gasolinera_servicios (
  gasolinera_id text not null references public.gasolineras (id) on delete cascade,
  servicio_id   text not null references public.servicios (id) on delete cascade,
  fuente        text not null default 'usuarios' check (fuente in ('ministerio', 'usuarios', 'verificado')),
  primary key (gasolinera_id, servicio_id)
);

-- Precio vigente: una fila por gasolinera y combustible
create table public.precios_actuales (
  gasolinera_id   text not null references public.gasolineras (id) on delete cascade,
  combustible_id  text not null references public.combustibles (id),
  precio          numeric(5,3) not null check (precio > 0.2 and precio < 9.999),
  fecha_ministerio timestamptz not null,        -- la fecha que publica el Ministerio
  primary key (gasolinera_id, combustible_id)
);
create index precios_actuales_comb_idx on public.precios_actuales (combustible_id, precio);

-- Historial: se añade una fila SOLO cuando el precio cambia (disparador más abajo)
create table public.historial_precios (
  id               bigint generated always as identity primary key,
  gasolinera_id    text not null references public.gasolineras (id) on delete cascade,
  combustible_id   text not null references public.combustibles (id),
  precio           numeric(5,3) not null check (precio > 0.2 and precio < 9.999),
  fecha_actualizacion timestamptz not null,
  fuente           text not null default 'MITECO' check (fuente in ('MITECO', 'MITECO_HISTORICO')),
  unique (gasolinera_id, combustible_id, fecha_actualizacion)
);
create index historial_consulta_idx on public.historial_precios (gasolinera_id, combustible_id, fecha_actualizacion desc);

-- ---------------------------------------------------------------------
-- 3. Datos de cada usuario
-- ---------------------------------------------------------------------

-- Perfil: 1 a 1 con auth.users. El correo y la contraseña se quedan en auth.users.
create table public.perfiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  nombre          text not null default '' check (char_length(nombre) <= 60),
  preferencias    jsonb not null default '{}'::jsonb
                    check (jsonb_typeof(preferencias) = 'object' and pg_column_size(preferencias) < 4096),
  tipo_cuenta     public.tipo_cuenta not null default 'gratuita',
  premium_hasta   timestamptz,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);

create table public.vehiculos (
  id              uuid primary key default gen_random_uuid(),
  usuario_id      uuid not null default auth.uid() references public.perfiles (id) on delete cascade,
  marca           text not null check (char_length(marca) between 1 and 40),
  modelo          text not null check (char_length(modelo) between 1 and 60),
  anio            smallint check (anio between 1950 and 2100),
  combustible_id  text not null references public.combustibles (id),
  consumo_medio   numeric(4,2) check (consumo_medio between 1 and 40),     -- L/100 km declarado
  deposito_litros numeric(5,1) check (deposito_litros between 5 and 500),
  principal       boolean not null default false,
  creado_en       timestamptz not null default now(),
  unique (id, usuario_id)                                     -- para la FK compuesta de repostajes
);
create index vehiculos_usuario_idx on public.vehiculos (usuario_id);
create unique index vehiculos_un_principal on public.vehiculos (usuario_id) where principal;

create table public.favoritos (
  id              uuid primary key default gen_random_uuid(),
  usuario_id      uuid not null default auth.uid() references public.perfiles (id) on delete cascade,
  gasolinera_id   text not null references public.gasolineras (id) on delete cascade,
  creado_en       timestamptz not null default now(),
  unique (usuario_id, gasolinera_id)
);

create table public.repostajes (
  id                 uuid primary key default gen_random_uuid(),
  usuario_id         uuid not null default auth.uid() references public.perfiles (id) on delete cascade,
  vehiculo_id        uuid,
  gasolinera_id      text references public.gasolineras (id) on delete set null,
  combustible_id     text not null references public.combustibles (id),
  fecha              timestamptz not null default now() check (fecha <= now() + interval '1 day'),
  litros             numeric(6,2) not null check (litros > 0 and litros <= 500),
  precio_litro       numeric(5,3) not null check (precio_litro > 0.2 and precio_litro < 9.999),
  importe_total      numeric(8,2) not null check (importe_total > 0),
  kilometros         integer check (kilometros between 0 and 3000000),
  deposito_lleno     boolean not null default true,     -- necesario para calcular el consumo real
  precio_medio_zona  numeric(5,3) check (precio_medio_zona is null or (precio_medio_zona > 0.2 and precio_medio_zona < 9.999)),
  creado_en          timestamptz not null default now(),
  -- el vehículo tiene que ser del mismo usuario
  foreign key (vehiculo_id, usuario_id) references public.vehiculos (id, usuario_id) on delete cascade,
  -- no se puede pagar más que litros x precio (sí menos, por descuentos)
  check (importe_total <= round(litros * precio_litro * 1.01, 2) + 0.05)
);
create index repostajes_usuario_fecha_idx on public.repostajes (usuario_id, fecha desc);
create index repostajes_vehiculo_idx on public.repostajes (vehiculo_id, fecha);

create table public.alertas (
  id               uuid primary key default gen_random_uuid(),
  usuario_id       uuid not null default auth.uid() references public.perfiles (id) on delete cascade,
  tipo             public.tipo_alerta not null,
  gasolinera_id    text references public.gasolineras (id) on delete cascade,
  lat              double precision check (lat between 27 and 44.5),
  lon              double precision check (lon between -18.5 and 4.6),
  radio_km         numeric(4,1) check (radio_km between 1 and 50),
  nombre_zona      text check (char_length(nombre_zona) <= 120),
  combustible_id   text not null references public.combustibles (id),
  precio_objetivo  numeric(5,3) not null check (precio_objetivo > 0.2 and precio_objetivo < 9.999),
  estado           public.estado_alerta not null default 'activa',
  creado_en        timestamptz not null default now(),
  ultimo_aviso_en  timestamptz,
  ultimo_precio    numeric(5,3),
  check (
    (tipo = 'gasolinera' and gasolinera_id is not null and lat is null and lon is null and radio_km is null)
    or
    (tipo = 'zona' and gasolinera_id is null and lat is not null and lon is not null and radio_km is not null)
  )
);
create index alertas_usuario_idx on public.alertas (usuario_id);
create index alertas_activas_idx on public.alertas (combustible_id) where estado = 'activa';

create table public.opiniones (
  id              uuid primary key default gen_random_uuid(),
  usuario_id      uuid not null default auth.uid() references public.perfiles (id) on delete cascade,
  gasolinera_id   text not null references public.gasolineras (id) on delete cascade,
  valoracion      smallint not null check (valoracion between 1 and 5),
  comentario      text not null check (char_length(btrim(comentario)) between 10 and 600),
  estado          public.estado_opinion not null default 'publicada',
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),
  unique (usuario_id, gasolinera_id)                -- una opinión por persona y gasolinera
);
create index opiniones_gasolinera_idx on public.opiniones (gasolinera_id, creado_en desc) where estado = 'publicada';

create table public.reportes_opinion (
  opinion_id   uuid not null references public.opiniones (id) on delete cascade,
  usuario_id   uuid not null default auth.uid() references public.perfiles (id) on delete cascade,
  motivo       text not null check (motivo in ('spam', 'ofensiva', 'falsa', 'otra')),
  creado_en    timestamptz not null default now(),
  primary key (opinion_id, usuario_id)
);

-- Suscripciones a notificaciones push (Web Push)
create table public.suscripciones_push (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null default auth.uid() references public.perfiles (id) on delete cascade,
  endpoint    text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh      text not null check (char_length(p256dh) <= 200),
  auth_clave  text not null check (char_length(auth_clave) <= 100),
  creado_en   timestamptz not null default now()
);
create index suscripciones_usuario_idx on public.suscripciones_push (usuario_id);

-- ---------------------------------------------------------------------
-- 4. Preparado para monetización (sin pagos)
-- ---------------------------------------------------------------------

-- Gasolineras patrocinadas: se muestran en un espacio aparte, NUNCA cambian el orden por precio
create table public.patrocinios (
  id             uuid primary key default gen_random_uuid(),
  gasolinera_id  text not null references public.gasolineras (id) on delete cascade,
  desde          date not null,
  hasta          date not null check (hasta >= desde),
  texto          text not null check (char_length(texto) <= 140),
  creado_en      timestamptz not null default now()
);

create table public.ofertas (
  id             uuid primary key default gen_random_uuid(),
  gasolinera_id  text references public.gasolineras (id) on delete cascade,
  titulo         text not null check (char_length(titulo) <= 80),
  descripcion    text check (char_length(descripcion) <= 400),
  desde          date not null,
  hasta          date not null check (hasta >= desde),
  creado_en      timestamptz not null default now()
);

-- =====================================================================
-- 5. Funciones y disparadores
-- =====================================================================

-- 5.1 Crear el perfil automáticamente al registrarse
create or replace function public.crear_perfil_nuevo_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfiles (id, nombre)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'nombre', ''), 60))
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.crear_perfil_nuevo_usuario();

-- 5.2 Fecha de última modificación
create or replace function public.marcar_actualizado()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;
create trigger perfiles_actualizado before update on public.perfiles
  for each row execute function public.marcar_actualizado();
create trigger opiniones_actualizado before update on public.opiniones
  for each row execute function public.marcar_actualizado();

-- 5.3 Límites por tipo de cuenta (favoritos, alertas y vehículos)
create or replace function public.comprobar_limite_plan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan   public.tipo_cuenta;
  v_max    integer;
  v_actual integer;
begin
  select case when p.tipo_cuenta = 'premium' and (p.premium_hasta is null or p.premium_hasta > now())
              then 'premium'::public.tipo_cuenta else 'gratuita'::public.tipo_cuenta end
    into v_plan
    from public.perfiles p where p.id = new.usuario_id;

  if tg_table_name = 'favoritos' then
    select l.max_favoritos into v_max from public.limites_plan l where l.plan = v_plan;
    select count(*) into v_actual from public.favoritos where usuario_id = new.usuario_id;
  elsif tg_table_name = 'alertas' then
    select l.max_alertas into v_max from public.limites_plan l where l.plan = v_plan;
    select count(*) into v_actual from public.alertas where usuario_id = new.usuario_id and estado <> 'cumplida';
  else
    select l.max_vehiculos into v_max from public.limites_plan l where l.plan = v_plan;
    select count(*) into v_actual from public.vehiculos where usuario_id = new.usuario_id;
  end if;

  if v_max is not null and v_actual >= v_max then
    raise exception 'LIMITE_PLAN: tu cuenta % permite como máximo % en %', v_plan, v_max, tg_table_name
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger favoritos_limite before insert on public.favoritos for each row execute function public.comprobar_limite_plan();
create trigger alertas_limite   before insert on public.alertas   for each row execute function public.comprobar_limite_plan();
create trigger vehiculos_limite before insert on public.vehiculos for each row execute function public.comprobar_limite_plan();

-- 5.4 Antispam de opiniones: máximo 5 al día por usuario
create or replace function public.limitar_opiniones()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.opiniones
       where usuario_id = new.usuario_id and creado_en > now() - interval '24 hours') >= 5 then
    raise exception 'DEMASIADAS_OPINIONES: espera antes de publicar más opiniones' using errcode = 'P0001';
  end if;
  new.comentario := btrim(new.comentario);
  return new;
end;
$$;
create trigger opiniones_antispam before insert on public.opiniones for each row execute function public.limitar_opiniones();

-- 5.5 Ocultar automáticamente una opinión con 3 reportes
create or replace function public.revisar_reportes()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.reportes_opinion where opinion_id = new.opinion_id) >= 3 then
    update public.opiniones set estado = 'pendiente' where id = new.opinion_id and estado = 'publicada';
  end if;
  return new;
end;
$$;
create trigger reportes_revisar after insert on public.reportes_opinion for each row execute function public.revisar_reportes();

-- 5.6 Historial: guardar el precio solo cuando cambia
create or replace function public.registrar_historial()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.precio is distinct from old.precio then
    insert into public.historial_precios (gasolinera_id, combustible_id, precio, fecha_actualizacion)
    values (new.gasolinera_id, new.combustible_id, new.precio, new.fecha_ministerio)
    on conflict do nothing;
  end if;
  return new;
end;
$$;
create trigger precios_historial after insert or update on public.precios_actuales
  for each row execute function public.registrar_historial();

-- 5.7 Importe por defecto del repostaje
create or replace function public.completar_repostaje()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.importe_total is null then
    new.importe_total := round(new.litros * new.precio_litro, 2);
  end if;
  return new;
end;
$$;
create trigger repostajes_completar before insert or update on public.repostajes
  for each row execute function public.completar_repostaje();

-- 5.8 Distancia en km (fórmula del haversine)
create or replace function public.distancia_km(lat1 double precision, lon1 double precision,
                                               lat2 double precision, lon2 double precision)
returns double precision language sql immutable parallel safe set search_path = '' as $$
  select 2 * 6371 * asin(sqrt(
           power(sin(radians(lat2 - lat1) / 2), 2) +
           cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lon2 - lon1) / 2), 2)));
$$;

-- 5.9 Gasolineras cercanas con su precio (pública, sin registro)
create or replace function public.gasolineras_cercanas(
  p_lat double precision, p_lon double precision,
  p_radio_km double precision default 10, p_combustible text default 'g95')
returns table (
  id text, rotulo text, direccion text, municipio text, provincia text,
  lat double precision, lon double precision, horario text,
  precio numeric, fecha_ministerio timestamptz, distancia_km double precision)
language sql stable security invoker set search_path = '' as $$
  select g.id, g.rotulo, g.direccion, g.municipio, g.provincia, g.lat, g.lon, g.horario,
         p.precio, p.fecha_ministerio,
         public.distancia_km(p_lat, p_lon, g.lat, g.lon) as distancia_km
    from public.gasolineras g
    join public.precios_actuales p on p.gasolinera_id = g.id and p.combustible_id = p_combustible
   where g.activa
     and p_radio_km between 1 and 50
     -- filtro rápido por recuadro (usa el índice lat/lon) y después la distancia exacta
     and g.lat between p_lat - p_radio_km / 111.0 and p_lat + p_radio_km / 111.0
     and g.lon between p_lon - p_radio_km / (111.0 * cos(radians(p_lat))) and p_lon + p_radio_km / (111.0 * cos(radians(p_lat)))
     and public.distancia_km(p_lat, p_lon, g.lat, g.lon) <= p_radio_km
   order by p.precio, distancia_km
   limit 500;
$$;

-- 5.10 Opiniones públicas de una gasolinera, con el nombre del autor y sin datos personales
create or replace function public.opiniones_de(p_gasolinera text)
returns table (id uuid, autor text, valoracion smallint, comentario text, creado_en timestamptz, es_mia boolean)
language sql stable security definer set search_path = '' as $$
  select o.id,
         coalesce(nullif(p.nombre, ''), 'Conductor de LitroGo') as autor,
         o.valoracion, o.comentario, o.creado_en,
         o.usuario_id = auth.uid() as es_mia
    from public.opiniones o
    join public.perfiles p on p.id = o.usuario_id
   where o.gasolinera_id = p_gasolinera and o.estado = 'publicada'
   order by o.creado_en desc
   limit 100;
$$;

create or replace function public.valoracion_de(p_gasolinera text)
returns table (media numeric, total bigint)
language sql stable security definer set search_path = '' as $$
  select round(avg(valoracion)::numeric, 1), count(*)
    from public.opiniones where gasolinera_id = p_gasolinera and estado = 'publicada';
$$;

-- 5.11 Estadísticas de gasto y ahorro del usuario (solo las suyas, por RLS)
create or replace view public.gasto_mensual
with (security_invoker = true) as
select r.usuario_id,
       date_trunc('month', r.fecha)::date                     as mes,
       count(*)                                               as repostajes,
       sum(r.litros)                                          as litros,
       sum(r.importe_total)                                   as gasto,
       round(sum(r.importe_total) / nullif(sum(r.litros), 0), 3) as precio_medio,
       sum(case when r.precio_medio_zona is not null
                then round((r.precio_medio_zona * r.litros) - r.importe_total, 2) else 0 end) as ahorro
  from public.repostajes r
 group by r.usuario_id, date_trunc('month', r.fecha);

-- Consumo real: litros repostados entre depósitos llenos / km recorridos
create or replace function public.consumo_real(p_vehiculo uuid)
returns numeric language sql stable security invoker set search_path = '' as $$
  with llenos as (
    select fecha, kilometros, litros,
           row_number() over (order by fecha) as n
      from public.repostajes
     where vehiculo_id = p_vehiculo and kilometros is not null and deposito_lleno
  )
  select case when max(kilometros) > min(kilometros)
              then round(sum(litros) filter (where n > 1) / (max(kilometros) - min(kilometros)) * 100, 2) end
    from llenos;
$$;

-- 5.12 Datos del usuario (RGPD): exportar y borrar la cuenta
create or replace function public.exportar_mis_datos()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'perfil',      (select to_jsonb(p) from public.perfiles p where p.id = auth.uid()),
    'vehiculos',   coalesce((select jsonb_agg(v) from public.vehiculos v where v.usuario_id = auth.uid()), '[]'),
    'favoritos',   coalesce((select jsonb_agg(f) from public.favoritos f where f.usuario_id = auth.uid()), '[]'),
    'repostajes',  coalesce((select jsonb_agg(r) from public.repostajes r where r.usuario_id = auth.uid()), '[]'),
    'alertas',     coalesce((select jsonb_agg(a) from public.alertas a where a.usuario_id = auth.uid()), '[]'),
    'opiniones',   coalesce((select jsonb_agg(o) from public.opiniones o where o.usuario_id = auth.uid()), '[]'),
    'exportado_en', now());
$$;

create or replace function public.borrar_mi_cuenta()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'NO_AUTENTICADO' using errcode = '42501';
  end if;
  delete from auth.users where id = auth.uid();   -- borra en cascada todos sus datos
end;
$$;

-- 5.13 Importación de precios (solo el servidor, con la clave secreta)
-- p_datos: [{"id":"1234","rotulo":"...","direccion":"...","lat":40.4,"lon":-3.7,
--            "precios":{"g95":1.459,"diesel":1.399}, ...}]
create or replace function public.importar_precios(p_datos jsonb, p_fecha timestamptz)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_n integer := 0;
begin
  insert into public.gasolineras as g (id, rotulo, direccion, localidad, municipio, id_municipio, provincia,
                                       codigo_postal, lat, lon, horario, tipo_venta, margen, activa, actualizado_en)
  select e->>'id', coalesce(nullif(e->>'rotulo', ''), 'Sin marca'), e->>'direccion', e->>'localidad', e->>'municipio',
         e->>'id_municipio', e->>'provincia', nullif(e->>'cp', ''), (e->>'lat')::float8, (e->>'lon')::float8,
         e->>'horario', nullif(e->>'tipo_venta', ''), nullif(e->>'margen', ''), true, now()
    from jsonb_array_elements(p_datos) e
  on conflict (id) do update set
    rotulo = excluded.rotulo, direccion = excluded.direccion, localidad = excluded.localidad,
    municipio = excluded.municipio, id_municipio = excluded.id_municipio, provincia = excluded.provincia,
    codigo_postal = excluded.codigo_postal, lat = excluded.lat, lon = excluded.lon, horario = excluded.horario,
    tipo_venta = excluded.tipo_venta, margen = excluded.margen, activa = true, actualizado_en = now();

  insert into public.precios_actuales as pa (gasolinera_id, combustible_id, precio, fecha_ministerio)
  select e->>'id', k.key, (k.value #>> '{}')::numeric, p_fecha
    from jsonb_array_elements(p_datos) e
   cross join lateral jsonb_each(e->'precios') k
    join public.combustibles c on c.id = k.key
  on conflict (gasolinera_id, combustible_id) do update set
    precio = excluded.precio, fecha_ministerio = excluded.fecha_ministerio
  where pa.precio is distinct from excluded.precio or pa.fecha_ministerio is distinct from excluded.fecha_ministerio;
  get diagnostics v_n = row_count;

  -- precios que ya no publica una estación (deja de vender ese combustible)
  delete from public.precios_actuales pa
   where pa.fecha_ministerio < p_fecha
     and pa.gasolinera_id in (select e->>'id' from jsonb_array_elements(p_datos) e);

  -- estaciones que han desaparecido del listado oficial completo
  update public.gasolineras set activa = false
   where activa and actualizado_en < now() - interval '3 days';
  return v_n;
end;
$$;

-- 5.14 Alertas cumplidas tras cada importación (la usa el servidor para enviar avisos)
create or replace function public.alertas_a_notificar()
returns table (alerta_id uuid, usuario_id uuid, gasolinera_id text, rotulo text, combustible_id text,
               precio numeric, precio_objetivo numeric)
language sql stable security definer set search_path = '' as $$
  select distinct on (a.id)
         a.id, a.usuario_id, g.id, g.rotulo, a.combustible_id, p.precio, a.precio_objetivo
    from public.alertas a
    join public.precios_actuales p on p.combustible_id = a.combustible_id and p.precio <= a.precio_objetivo
    join public.gasolineras g on g.id = p.gasolinera_id and g.activa
   where a.estado = 'activa'
     and (a.ultimo_aviso_en is null or a.ultimo_aviso_en < now() - interval '20 hours')
     and (   (a.tipo = 'gasolinera' and g.id = a.gasolinera_id)
          or (a.tipo = 'zona'
              and g.lat between a.lat - a.radio_km / 111.0 and a.lat + a.radio_km / 111.0
              and public.distancia_km(a.lat, a.lon, g.lat, g.lon) <= a.radio_km))
   order by a.id, p.precio;
$$;

-- =====================================================================
-- 6. Seguridad: permisos y Row Level Security
-- =====================================================================

-- Supabase concede por defecto todos los permisos a anon y authenticated
-- sobre las tablas de public. Los quitamos y damos solo los necesarios.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

alter table public.combustibles         enable row level security;
alter table public.servicios            enable row level security;
alter table public.limites_plan         enable row level security;
alter table public.gasolineras          enable row level security;
alter table public.gasolinera_servicios enable row level security;
alter table public.precios_actuales     enable row level security;
alter table public.historial_precios    enable row level security;
alter table public.perfiles             enable row level security;
alter table public.vehiculos            enable row level security;
alter table public.favoritos            enable row level security;
alter table public.repostajes           enable row level security;
alter table public.alertas              enable row level security;
alter table public.opiniones            enable row level security;
alter table public.reportes_opinion     enable row level security;
alter table public.suscripciones_push   enable row level security;
alter table public.patrocinios          enable row level security;
alter table public.ofertas              enable row level security;

-- 6.1 Datos públicos: lectura para todos (con y sin cuenta), sin escritura
grant select on public.combustibles, public.servicios, public.limites_plan, public.gasolineras,
                public.gasolinera_servicios, public.precios_actuales, public.historial_precios,
                public.patrocinios, public.ofertas
  to anon, authenticated;

create policy "lectura publica" on public.combustibles         for select to anon, authenticated using (true);
create policy "lectura publica" on public.servicios            for select to anon, authenticated using (true);
create policy "lectura publica" on public.limites_plan         for select to anon, authenticated using (true);
create policy "lectura publica" on public.gasolineras          for select to anon, authenticated using (true);
create policy "lectura publica" on public.gasolinera_servicios for select to anon, authenticated using (true);
create policy "lectura publica" on public.precios_actuales     for select to anon, authenticated using (true);
create policy "lectura publica" on public.historial_precios    for select to anon, authenticated using (true);
create policy "patrocinios vigentes" on public.patrocinios for select to anon, authenticated
  using (current_date between desde and hasta);
create policy "ofertas vigentes" on public.ofertas for select to anon, authenticated
  using (current_date between desde and hasta);

-- 6.2 Perfil: cada uno ve y edita el suyo. Solo nombre y preferencias.
--     tipo_cuenta y premium_hasta solo los cambia el servidor (pagos).
grant select on public.perfiles to authenticated;
grant update (nombre, preferencias) on public.perfiles to authenticated;
create policy "ver mi perfil" on public.perfiles for select to authenticated
  using ((select auth.uid()) = id);
create policy "editar mi perfil" on public.perfiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- 6.3 Vehículos, favoritos, repostajes, alertas y suscripciones: solo los propios
grant select, insert, update, delete on public.vehiculos, public.favoritos, public.repostajes,
                                        public.alertas, public.suscripciones_push
  to authenticated;

create policy "mis vehiculos" on public.vehiculos for all to authenticated
  using ((select auth.uid()) = usuario_id) with check ((select auth.uid()) = usuario_id);
create policy "mis favoritos" on public.favoritos for all to authenticated
  using ((select auth.uid()) = usuario_id) with check ((select auth.uid()) = usuario_id);
create policy "mis repostajes" on public.repostajes for all to authenticated
  using ((select auth.uid()) = usuario_id) with check ((select auth.uid()) = usuario_id);
create policy "mis alertas" on public.alertas for all to authenticated
  using ((select auth.uid()) = usuario_id) with check ((select auth.uid()) = usuario_id);
create policy "mis suscripciones" on public.suscripciones_push for all to authenticated
  using ((select auth.uid()) = usuario_id) with check ((select auth.uid()) = usuario_id);

-- El usuario no puede tocar los campos que rellena el servidor en las alertas
revoke update on public.alertas from authenticated;
grant update (gasolinera_id, lat, lon, radio_km, nombre_zona, combustible_id, precio_objetivo, estado)
  on public.alertas to authenticated;

-- 6.4 Opiniones: las publicadas se leen con opiniones_de(); en la tabla, cada uno ve las suyas
grant select, insert, delete on public.opiniones to authenticated;
grant update (valoracion, comentario) on public.opiniones to authenticated;
create policy "ver mis opiniones" on public.opiniones for select to authenticated
  using ((select auth.uid()) = usuario_id);
create policy "publicar opinion" on public.opiniones for insert to authenticated
  with check ((select auth.uid()) = usuario_id and estado = 'publicada');
create policy "editar mi opinion" on public.opiniones for update to authenticated
  using ((select auth.uid()) = usuario_id) with check ((select auth.uid()) = usuario_id);
create policy "borrar mi opinion" on public.opiniones for delete to authenticated
  using ((select auth.uid()) = usuario_id);

grant select, insert on public.reportes_opinion to authenticated;
create policy "mis reportes" on public.reportes_opinion for select to authenticated
  using ((select auth.uid()) = usuario_id);
create policy "reportar" on public.reportes_opinion for insert to authenticated
  with check ((select auth.uid()) = usuario_id);

-- 6.5 Funciones: quién puede ejecutar cada una
grant execute on function public.distancia_km(double precision, double precision, double precision, double precision) to anon, authenticated;
grant execute on function public.gasolineras_cercanas(double precision, double precision, double precision, text) to anon, authenticated;
grant execute on function public.opiniones_de(text) to anon, authenticated;
grant execute on function public.valoracion_de(text) to anon, authenticated;
grant execute on function public.consumo_real(uuid) to authenticated;
grant execute on function public.exportar_mis_datos() to authenticated;
grant execute on function public.borrar_mi_cuenta() to authenticated;
grant select on public.gasto_mensual to authenticated;
-- importar_precios() y alertas_a_notificar() solo para el servidor (service_role)
grant execute on function public.importar_precios(jsonb, timestamptz) to service_role;
grant execute on function public.alertas_a_notificar() to service_role;
-- Los disparadores no necesitan permiso de ejecución para los usuarios.

commit;
