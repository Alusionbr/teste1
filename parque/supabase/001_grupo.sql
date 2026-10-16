-- Mapa do Parque — sincronização do grupo (posição de cada pessoa e pinos compartilhados).
--
-- As tabelas ficam trancadas (RLS ligado, nenhuma política, sem GRANT para anon):
-- o navegador só fala com o banco pelas funções abaixo, e toda função exige o
-- código do grupo. Quem não sabe o código não lê nem escreve nada.
--
-- Nada é apagado: sair do grupo marca active=false, remover pino marca removed=true,
-- e a leitura ignora quem está parado há mais de 3 h e pinos com mais de 24 h.
-- (O painel do Supabase pede confirmação para DELETE; assim o fluxo não depende disso.)

create table if not exists public.parque_membros (
  group_code text not null,
  member_id  text not null,
  name       text not null default '',
  color      text not null default '#ff70a6',
  lat        double precision,
  lon        double precision,
  acc        real,
  heading    real,
  status     text not null default '',
  active     boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (group_code, member_id)
);

create table if not exists public.parque_pinos (
  group_code text not null,
  pin_id     text not null,
  kind       text not null default 'lugar',
  name       text not null default '',
  lat        double precision not null,
  lon        double precision not null,
  by_name    text not null default '',
  removed    boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (group_code, pin_id)
);

alter table public.parque_membros enable row level security;
alter table public.parque_pinos  enable row level security;
revoke all on public.parque_membros from anon, authenticated;
revoke all on public.parque_pinos  from anon, authenticated;

create or replace function public.parque_valida(p_group text, p_member text)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_group is null or p_group !~ '^[A-Z0-9]{6,16}$' then
    raise exception 'codigo de grupo invalido';
  end if;
  if p_member is not null and p_member !~ '^[a-zA-Z0-9-]{4,40}$' then
    raise exception 'membro invalido';
  end if;
end;
$$;

-- Uma chamada faz tudo: grava minha posição e devolve o grupo inteiro.
create or replace function public.parque_sync(
  p_group text, p_member text, p_name text, p_color text,
  p_lat double precision, p_lon double precision, p_acc real, p_heading real, p_status text
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  result json;
begin
  perform public.parque_valida(p_group, p_member);

  insert into public.parque_membros as m (group_code, member_id, name, color, lat, lon, acc, heading, status, active, updated_at)
  values (p_group, p_member, left(coalesce(p_name, ''), 24), left(coalesce(p_color, '#ff70a6'), 9),
          p_lat, p_lon, p_acc, p_heading, left(coalesce(p_status, ''), 40), true, now())
  on conflict (group_code, member_id) do update set
    name = excluded.name, color = excluded.color,
    lat = coalesce(excluded.lat, m.lat), lon = coalesce(excluded.lon, m.lon),
    acc = coalesce(excluded.acc, m.acc), heading = excluded.heading,
    status = excluded.status, active = true, updated_at = now();

  select json_build_object(
    'now', now(),
    'members', coalesce((
      select json_agg(json_build_object(
        'member_id', member_id, 'name', name, 'color', color, 'lat', lat, 'lon', lon,
        'acc', acc, 'heading', heading, 'status', status, 'updated_at', updated_at
      ) order by name)
      from public.parque_membros
      where group_code = p_group and active and updated_at > now() - interval '3 hours'
    ), '[]'::json),
    'pins', coalesce((
      select json_agg(json_build_object(
        'pin_id', pin_id, 'kind', kind, 'name', name, 'lat', lat, 'lon', lon,
        'by_name', by_name, 'updated_at', updated_at
      ) order by updated_at)
      from public.parque_pinos
      where group_code = p_group and not removed and updated_at > now() - interval '24 hours'
    ), '[]'::json)
  ) into result;
  return result;
end;
$$;

create or replace function public.parque_pin_set(
  p_group text, p_pin text, p_kind text, p_name text,
  p_lat double precision, p_lon double precision, p_by text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.parque_valida(p_group, p_pin);
  if (select count(*) from public.parque_pinos where group_code = p_group and not removed) >= 40
     and not exists (select 1 from public.parque_pinos where group_code = p_group and pin_id = p_pin) then
    raise exception 'limite de pinos do grupo';
  end if;
  insert into public.parque_pinos (group_code, pin_id, kind, name, lat, lon, by_name, removed, updated_at)
  values (p_group, p_pin, left(coalesce(p_kind, 'lugar'), 12), left(coalesce(p_name, ''), 40),
          p_lat, p_lon, left(coalesce(p_by, ''), 24), false, now())
  on conflict (group_code, pin_id) do update set
    kind = excluded.kind, name = excluded.name, lat = excluded.lat, lon = excluded.lon,
    by_name = excluded.by_name, removed = false, updated_at = now();
end;
$$;

create or replace function public.parque_pin_del(p_group text, p_pin text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.parque_valida(p_group, p_pin);
  update public.parque_pinos set removed = true, updated_at = now()
  where group_code = p_group and pin_id = p_pin;
end;
$$;

create or replace function public.parque_sair(p_group text, p_member text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.parque_valida(p_group, p_member);
  update public.parque_membros set active = false, updated_at = now()
  where group_code = p_group and member_id = p_member;
end;
$$;

revoke all on function public.parque_valida(text, text) from public, anon, authenticated;
revoke all on function public.parque_sync(text, text, text, text, double precision, double precision, real, real, text) from public;
revoke all on function public.parque_pin_set(text, text, text, text, double precision, double precision, text) from public;
revoke all on function public.parque_pin_del(text, text) from public;
revoke all on function public.parque_sair(text, text) from public;
grant execute on function public.parque_sync(text, text, text, text, double precision, double precision, real, real, text) to anon, authenticated;
grant execute on function public.parque_pin_set(text, text, text, text, double precision, double precision, text) to anon, authenticated;
grant execute on function public.parque_pin_del(text, text) to anon, authenticated;
grant execute on function public.parque_sair(text, text) to anon, authenticated;
