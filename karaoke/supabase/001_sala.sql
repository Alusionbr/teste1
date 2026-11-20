-- Karaokê em Casa — 001: sala da festa (tela central + celulares como controle).
--
-- Projeto Supabase compartilhado (o mesmo do Mapa do Parque e do Financeiro360).
-- Tudo do karaokê mora no schema "karaoke", que a API NÃO expõe. RLS ligado,
-- nenhuma política, nenhum GRANT para anon: o navegador só fala com as funções
-- public.karaoke_* (SECURITY DEFINER), que são a única porta de entrada.
--
-- Diferente do parque, aqui o dado é passageiro: comando já lido pela tela
-- não tem valor depois da festa. Comandos com mais de 1 dia e salas paradas
-- há mais de 2 dias são apagados pelas próprias funções.
--
-- Quem sabe o código da sala (6 letras/números) pode mandar comandos — é o
-- convite da festa. Só quem tem o TOKEN (gerado na tela central, nunca sai
-- dela) publica o estado e lê os comandos.

create schema if not exists karaoke;
revoke all on schema karaoke from public, anon, authenticated;

create table if not exists karaoke.salas (
  codigo        text primary key,
  token         text not null,
  estado        jsonb not null default '{}'::jsonb,
  versao        integer not null default 0,
  criada_em     timestamptz not null default now(),
  atualizada_em timestamptz not null default now()
);

create table if not exists karaoke.comandos (
  id        bigint generated always as identity primary key,
  codigo    text not null references karaoke.salas(codigo) on delete cascade,
  device_id text not null,
  nome      text not null default '',
  tipo      text not null,
  dados     jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);
create index if not exists comandos_sala_id on karaoke.comandos (codigo, id);
create index if not exists comandos_aparelho on karaoke.comandos (device_id, criado_em);

create table if not exists karaoke.aparelhos (
  codigo    text not null references karaoke.salas(codigo) on delete cascade,
  device_id text not null,
  nome      text not null default '',
  visto_em  timestamptz not null default now(),
  primary key (codigo, device_id)
);

alter table karaoke.salas enable row level security;
alter table karaoke.comandos enable row level security;
alter table karaoke.aparelhos enable row level security;
revoke all on all tables in schema karaoke from public, anon, authenticated;

create or replace function public.karaoke_valida(p_codigo text, p_device text)
returns void language plpgsql immutable set search_path = '' as $fn$
begin
  if p_codigo is null or p_codigo !~ '^[A-Z0-9]{6,12}$' then raise exception 'codigo de sala invalido'; end if;
  if p_device is not null and p_device !~ '^[a-zA-Z0-9-]{4,40}$' then raise exception 'aparelho invalido'; end if;
end; $fn$;

-- Tela central: cria a sala (ou retoma a sua, com o mesmo token).
create or replace function public.karaoke_sala_abrir(p_codigo text, p_token text)
returns json language plpgsql security definer set search_path = '' as $fn$
declare atual text;
begin
  perform public.karaoke_valida(p_codigo, null);
  if p_token is null or p_token !~ '^[a-f0-9]{32,64}$' then raise exception 'token invalido'; end if;
  delete from karaoke.salas where atualizada_em < now() - interval '2 days';
  select token into atual from karaoke.salas where codigo = p_codigo;
  if atual is null then
    insert into karaoke.salas (codigo, token) values (p_codigo, p_token);
  elsif atual <> p_token then
    raise exception 'codigo em uso';
  else
    update karaoke.salas set atualizada_em = now() where codigo = p_codigo;
  end if;
  return json_build_object('ok', true);
end; $fn$;

-- Tela central, a cada ~1,5 s: publica o estado (quando mudou) e recebe os
-- comandos novos dos celulares.
create or replace function public.karaoke_host_sync(p_codigo text, p_token text, p_estado jsonb, p_depois bigint)
returns json language plpgsql security definer set search_path = '' as $fn$
declare sala karaoke.salas;
begin
  perform public.karaoke_valida(p_codigo, null);
  select * into sala from karaoke.salas where codigo = p_codigo;
  if sala.codigo is null then raise exception 'sala nao encontrada'; end if;
  if sala.token <> coalesce(p_token, '') then raise exception 'token incorreto'; end if;
  if p_estado is not null then
    if octet_length(p_estado::text) > 200000 then raise exception 'estado grande demais'; end if;
    update karaoke.salas set estado = p_estado, versao = versao + 1, atualizada_em = now() where codigo = p_codigo;
  else
    update karaoke.salas set atualizada_em = now() where codigo = p_codigo;
  end if;
  delete from karaoke.comandos where codigo = p_codigo and criado_em < now() - interval '1 day';
  return json_build_object(
    'comandos', coalesce((select json_agg(json_build_object('id', c.id, 'device', c.device_id, 'nome', c.nome, 'tipo', c.tipo, 'dados', c.dados) order by c.id)
                          from (select * from karaoke.comandos where codigo = p_codigo and id > coalesce(p_depois, 0) order by id limit 50) c), '[]'::json),
    'aparelhos', (select count(*) from karaoke.aparelhos where codigo = p_codigo and visto_em > now() - interval '30 seconds')
  );
end; $fn$;

-- Celular, a cada ~2 s: diz que está aqui e lê o estado se mudou.
create or replace function public.karaoke_sala_ver(p_codigo text, p_device text, p_nome text, p_versao integer)
returns json language plpgsql security definer set search_path = '' as $fn$
declare sala karaoke.salas;
begin
  perform public.karaoke_valida(p_codigo, p_device);
  select * into sala from karaoke.salas where codigo = p_codigo;
  if sala.codigo is null then return json_build_object('existe', false); end if;
  insert into karaoke.aparelhos (codigo, device_id, nome, visto_em)
  values (p_codigo, p_device, left(coalesce(p_nome, ''), 24), now())
  on conflict (codigo, device_id) do update set nome = excluded.nome, visto_em = now();
  return json_build_object(
    'existe', true,
    'versao', sala.versao,
    'tela_viva', sala.atualizada_em > now() - interval '20 seconds',
    'estado', case when sala.versao > coalesce(p_versao, -1) then sala.estado else null end
  );
end; $fn$;

-- Celular: manda um comando. Lista fechada de tipos, tamanho e ritmo limitados.
create or replace function public.karaoke_comando(p_codigo text, p_device text, p_nome text, p_tipo text, p_dados jsonb)
returns json language plpgsql security definer set search_path = '' as $fn$
begin
  perform public.karaoke_valida(p_codigo, p_device);
  if p_tipo is null or p_tipo not in ('alternar','proxima','anterior','comecar','adiantar','atrasar','volume','aplausos','pedir','pedir_nova','entrar','tocar_item','tirar_item','subir_item') then
    raise exception 'comando invalido';
  end if;
  if octet_length(coalesce(p_dados, '{}'::jsonb)::text) > 40000 then raise exception 'comando grande demais'; end if;
  if not exists (select 1 from karaoke.salas where codigo = p_codigo and atualizada_em > now() - interval '10 minutes') then
    raise exception 'sala fechada';
  end if;
  if (select count(*) from karaoke.comandos where device_id = p_device and criado_em > now() - interval '1 minute') >= 60 then
    raise exception 'calma: muitos comandos seguidos';
  end if;
  insert into karaoke.comandos (codigo, device_id, nome, tipo, dados)
  values (p_codigo, p_device, left(coalesce(p_nome, ''), 24), p_tipo, coalesce(p_dados, '{}'::jsonb));
  return json_build_object('ok', true);
end; $fn$;

-- Tela central: fecha a sala (apaga sala, comandos e aparelhos).
create or replace function public.karaoke_sala_fechar(p_codigo text, p_token text)
returns void language plpgsql security definer set search_path = '' as $fn$
begin
  perform public.karaoke_valida(p_codigo, null);
  delete from karaoke.salas where codigo = p_codigo and token = coalesce(p_token, '');
end; $fn$;

revoke all on function public.karaoke_valida(text, text) from public, anon, authenticated;
revoke all on function public.karaoke_sala_abrir(text, text) from public;
revoke all on function public.karaoke_host_sync(text, text, jsonb, bigint) from public;
revoke all on function public.karaoke_sala_ver(text, text, text, integer) from public;
revoke all on function public.karaoke_comando(text, text, text, text, jsonb) from public;
revoke all on function public.karaoke_sala_fechar(text, text) from public;
grant execute on function public.karaoke_sala_abrir(text, text) to anon, authenticated;
grant execute on function public.karaoke_host_sync(text, text, jsonb, bigint) to anon, authenticated;
grant execute on function public.karaoke_sala_ver(text, text, text, integer) to anon, authenticated;
grant execute on function public.karaoke_comando(text, text, text, text, jsonb) to anon, authenticated;
grant execute on function public.karaoke_sala_fechar(text, text) to anon, authenticated;
