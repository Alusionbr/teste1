-- Permite que a tela atual autorize outro aparelho a assumir a sala.
-- O aparelho novo propõe um token; só o token atual pode trocar o dono.
create or replace function public.karaoke_sala_transferir(
  p_codigo text,
  p_token_atual text,
  p_token_novo text,
  p_estado jsonb
)
returns json language plpgsql security definer set search_path = '' as $fn$
begin
  perform public.karaoke_valida(p_codigo, null);
  if p_token_novo is null or p_token_novo !~ '^[a-f0-9]{32,64}$' then
    raise exception 'novo token invalido';
  end if;
  if p_estado is null or octet_length(p_estado::text) > 200000 then
    raise exception 'estado grande demais';
  end if;
  update karaoke.salas
     set token = p_token_novo,
         estado = p_estado,
         versao = versao + 1,
         atualizada_em = now()
   where codigo = p_codigo
     and token = coalesce(p_token_atual, '');
  if not found then raise exception 'token incorreto'; end if;
  return json_build_object('ok', true);
end; $fn$;

revoke all on function public.karaoke_sala_transferir(text, text, text, jsonb) from public;
grant execute on function public.karaoke_sala_transferir(text, text, text, jsonb) to anon, authenticated;
