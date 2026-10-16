-- Mapa do Parque — 003: mapeamento coletivo e caminhos aprendidos.
-- Tudo no schema "parque" (fora da API); acesso só pelas funções public.parque_*.

-- Lugares marcados por visitantes: bebedouro, lixeira, banheiro… e posição de
-- atrações oficiais que o OpenStreetMap não tem (kind 'atracao' + ref_id 'of-…').
create table if not exists parque.lugares (
  id         bigint generated always as identity primary key,
  kind       text not null,
  ref_id     text,
  name       text not null default '',
  lat        double precision not null,
  lon        double precision not null,
  device_id  text not null,
  removed    boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists lugares_kind_idx on parque.lugares (kind) where not removed;
alter table parque.lugares enable row level security;
revoke all on parque.lugares from public, anon, authenticated;

-- Trechos andados a pé (lista de [lat, lon]) para a rota seguir caminhos reais.
create table if not exists parque.trilhas (
  id         bigint generated always as identity primary key,
  device_id  text not null,
  pts        jsonb not null,
  created_at timestamptz not null default now()
);
alter table parque.trilhas enable row level security;
revoke all on parque.trilhas from public, anon, authenticated;

-- Fila: aceita também ids oficiais ("of-…").
create or replace function public.parque_fila_set(p_place text, p_member text, p_minutes int)
returns void language plpgsql security definer set search_path = '' as $fn$
begin
  if p_place is null or p_place !~ '^(osm|of)-[a-z0-9-]{2,60}$' then raise exception 'lugar invalido'; end if;
  if p_member is null or p_member !~ '^[a-zA-Z0-9-]{4,40}$' then raise exception 'membro invalido'; end if;
  if p_minutes is null or p_minutes < 0 or p_minutes > 300 then raise exception 'minutos invalidos'; end if;
  insert into parque.filas (place_id, member_id, minutes, updated_at)
  values (p_place, p_member, p_minutes, now())
  on conflict (place_id, member_id) do update set minutes = excluded.minutes, updated_at = now();
end; $fn$;

create or replace function public.parque_lugar_add(
  p_kind text, p_ref text, p_name text, p_lat double precision, p_lon double precision, p_device text)
returns bigint language plpgsql security definer set search_path = '' as $fn$
declare new_id bigint;
begin
  if p_kind is null or p_kind not in ('atracao','bebedouro','lixeira','banheiro','comida','loja','socorro','fraldario','guarda','carregador','foto','saida','info','descanso')
    then raise exception 'tipo invalido'; end if;
  if p_device is null or p_device !~ '^[a-zA-Z0-9-]{4,40}$' then raise exception 'aparelho invalido'; end if;
  if p_ref is not null and p_ref !~ '^of-[a-z0-9-]{2,60}$' then raise exception 'referencia invalida'; end if;
  if p_kind = 'atracao' and p_ref is null then raise exception 'atracao sem referencia'; end if;
  if p_lat is null or p_lon is null or p_lat not between -26.8140 and -26.7950 or p_lon not between -48.6290 and -48.6060
    then raise exception 'fora do parque'; end if;
  if (select count(*) from parque.lugares where device_id = p_device and created_at > now() - interval '1 day') >= 300
    then raise exception 'limite diario'; end if;
  insert into parque.lugares (kind, ref_id, name, lat, lon, device_id)
  values (p_kind, p_ref, left(coalesce(p_name, ''), 40), p_lat, p_lon, p_device)
  returning id into new_id;
  return new_id;
end; $fn$;

-- Só quem criou (mesmo device_id) consegue tirar. A leitura nunca devolve device_id.
create or replace function public.parque_lugar_del(p_id bigint, p_device text)
returns void language plpgsql security definer set search_path = '' as $fn$
begin
  update parque.lugares set removed = true where id = p_id and device_id = p_device;
end; $fn$;

create or replace function public.parque_lugares()
returns json language sql stable security definer set search_path = '' as $fn$
  select coalesce(json_agg(json_build_object(
    'id', id, 'kind', kind, 'ref_id', ref_id, 'name', name,
    'lat', round(lat::numeric, 6), 'lon', round(lon::numeric, 6), 'at', created_at) order by id), '[]'::json)
  from (select * from parque.lugares where not removed order by id desc limit 3000) l;
$fn$;

create or replace function public.parque_trilha_add(p_device text, p_pts jsonb)
returns void language plpgsql security definer set search_path = '' as $fn$
declare n int; fora int;
begin
  if p_device is null or p_device !~ '^[a-zA-Z0-9-]{4,40}$' then raise exception 'aparelho invalido'; end if;
  if jsonb_typeof(p_pts) <> 'array' then raise exception 'pontos invalidos'; end if;
  n := jsonb_array_length(p_pts);
  if n < 2 or n > 400 then raise exception 'quantidade de pontos invalida'; end if;
  select count(*) into fora from jsonb_array_elements(p_pts) e
   where jsonb_typeof(e) <> 'array' or jsonb_array_length(e) <> 2
      or (e->>0)::double precision not between -26.8140 and -26.7950
      or (e->>1)::double precision not between -48.6290 and -48.6060;
  if fora > 0 then raise exception 'ponto fora do parque'; end if;
  if (select count(*) from parque.trilhas where device_id = p_device and created_at > now() - interval '1 day') >= 600
    then raise exception 'limite diario'; end if;
  insert into parque.trilhas (device_id, pts) values (p_device, p_pts);
end; $fn$;

create or replace function public.parque_trilhas()
returns json language sql stable security definer set search_path = '' as $fn$
  select coalesce(json_agg(pts order by id), '[]'::json)
  from (select id, pts from parque.trilhas
        where created_at > now() - interval '90 days'
        order by id desc limit 5000) t;
$fn$;

revoke all on function public.parque_lugar_add(text, text, text, double precision, double precision, text) from public;
revoke all on function public.parque_lugar_del(bigint, text) from public;
revoke all on function public.parque_lugares() from public;
revoke all on function public.parque_trilha_add(text, jsonb) from public;
revoke all on function public.parque_trilhas() from public;
grant execute on function public.parque_lugar_add(text, text, text, double precision, double precision, text) to anon, authenticated;
grant execute on function public.parque_lugar_del(bigint, text) to anon, authenticated;
grant execute on function public.parque_lugares() to anon, authenticated;
grant execute on function public.parque_trilha_add(text, jsonb) to anon, authenticated;
grant execute on function public.parque_trilhas() to anon, authenticated;
