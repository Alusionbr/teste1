-- Mapa do Parque — 002: gaveta própria (schema "parque") e fila ao vivo compartilhada.
--
-- O projeto Supabase é dividido com outros apps (futebol, Financeiro360). Para não
-- misturar nada, as tabelas do parque saem de "public" e vão para o schema "parque",
-- que não é exposto pela API (só public e graphql_public são). O navegador continua
-- falando só com as funções public.parque_*, que são a única porta de entrada.
--
-- Aplicado depois de 001_grupo.sql. Nada é apagado: ALTER ... SET SCHEMA só muda o endereço.

create schema if not exists parque;
revoke all on schema parque from public, anon, authenticated;

alter table public.parque_membros set schema parque;
alter table public.parque_pinos set schema parque;
alter table parque.parque_membros rename to membros;
alter table parque.parque_pinos rename to pinos;

-- Um relato por atração por aparelho; mandar de novo substitui.
create table if not exists parque.filas (
  place_id   text not null,
  member_id  text not null,
  minutes    smallint not null check (minutes between 0 and 300),
  updated_at timestamptz not null default now(),
  primary key (place_id, member_id)
);
alter table parque.filas enable row level security;
revoke all on all tables in schema parque from public, anon, authenticated;

-- As funções de 001 foram recriadas com os mesmos parâmetros, trocando
-- public.parque_membros → parque.membros e public.parque_pinos → parque.pinos.
-- (corpo idêntico ao de 001_grupo.sql, só com o endereço novo)

create or replace function public.parque_fila_set(p_place text, p_member text, p_minutes int)
returns void language plpgsql security definer set search_path = '' as $fn$
begin
  if p_place is null or p_place !~ '^osm-[a-z0-9-]{2,60}$' then raise exception 'lugar invalido'; end if;
  if p_member is null or p_member !~ '^[a-zA-Z0-9-]{4,40}$' then raise exception 'membro invalido'; end if;
  if p_minutes is null or p_minutes < 0 or p_minutes > 300 then raise exception 'minutos invalidos'; end if;
  insert into parque.filas (place_id, member_id, minutes, updated_at)
  values (p_place, p_member, p_minutes, now())
  on conflict (place_id, member_id) do update set minutes = excluded.minutes, updated_at = now();
end; $fn$;

-- Mediana dos relatos da última hora por atração (resiste a número absurdo).
create or replace function public.parque_filas()
returns json language sql stable security definer set search_path = '' as $fn$
  select coalesce(json_agg(json_build_object(
    'place_id', place_id, 'minutes', minutes, 'reports', reports, 'last_at', last_at)), '[]'::json)
  from (
    select place_id,
           round(percentile_cont(0.5) within group (order by minutes))::int as minutes,
           count(*)::int as reports,
           max(updated_at) as last_at
    from parque.filas
    where updated_at > now() - interval '60 minutes'
    group by place_id
  ) f;
$fn$;

revoke all on function public.parque_fila_set(text, text, int) from public;
revoke all on function public.parque_filas() from public;
grant execute on function public.parque_fila_set(text, text, int) to anon, authenticated;
grant execute on function public.parque_filas() to anon, authenticated;
