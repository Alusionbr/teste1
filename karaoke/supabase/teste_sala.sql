-- Teste das funções da sala (001_sala.sql) em um Postgres comum.
--
-- Serve para conferir o SQL antes de aplicar no Supabase, ou depois de mexer nele.
-- O Supabase cria os papéis "anon" e "authenticated" sozinho; num Postgres local
-- é preciso criá-los antes:
--
--   psql -c "create role anon nologin; create role authenticated nologin;"
--   psql -f karaoke/supabase/001_sala.sql
--   psql -q -f karaoke/supabase/teste_sala.sql
--
-- Cada bloco imprime o que testa. Os erros (ERROR: ...) são ESPERADOS nos casos
-- marcados com "=>": é a função recusando um pedido inválido ou malicioso.
-- Tudo roda como "anon", o papel que o navegador usa.
set role anon;
\set ON_ERROR_STOP off
\echo '--- 1. abrir sala'
select public.karaoke_sala_abrir('ABC234','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
\echo '--- 2. outro token na mesma sala => codigo em uso'
select public.karaoke_sala_abrir('ABC234','bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
\echo '--- 3. retomar com o mesmo token funciona'
select public.karaoke_sala_abrir('ABC234','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
\echo '--- 4. token curto / codigo minusculo / lixo'
select public.karaoke_sala_abrir('ABC234','abc');
select public.karaoke_sala_abrir('abc234','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
select public.karaoke_sala_abrir('A; drop table x','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
\echo '--- 5. celular manda comandos'
select public.karaoke_comando('ABC234','ap-celular1','Tia Carla','pedir','{"musicaId":"m-1"}'::jsonb);
select public.karaoke_comando('ABC234','ap-celular1','Tia Carla','alternar',null);
\echo '--- 6. comando fora da lista => invalido'
select public.karaoke_comando('ABC234','ap-celular1','x','apagar_tudo','{}'::jsonb);
\echo '--- 7. comando para sala que nao existe => sala fechada'
select public.karaoke_comando('ZZZZZZ','ap-celular1','x','alternar','{}'::jsonb);
\echo '--- 8. celular tenta ler comandos (host_sync) com token errado'
select public.karaoke_host_sync('ABC234','cccccccccccccccccccccccccccccccc','{}'::jsonb,0);
\echo '--- 9. tela publica estado e recebe os 2 comandos'
select public.karaoke_host_sync('ABC234','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','{"agora":{"title":"Teste"},"fila":[]}'::jsonb,0);
\echo '--- 10. depois do id 2 nao vem nada novo'
select public.karaoke_host_sync('ABC234','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',null,2);
\echo '--- 11. celular le estado (versao nova) e depois mesma versao => estado null'
select public.karaoke_sala_ver('ABC234','ap-celular1','Tia Carla',-1);
select public.karaoke_sala_ver('ABC234','ap-celular1','Tia Carla',1);
\echo '--- 12. sala inexistente'
select public.karaoke_sala_ver('ZZZZZZ','ap-celular1','x',-1);
\echo '--- 13. limite de 60 comandos por minuto'
select count(*) filter (where (public.karaoke_comando('ABC234','ap-spam','x','alternar','{}'::jsonb))::text like '%ok%') as aceitos from generate_series(1,70);
\echo '--- 14. comando gigante (>40KB)'
select public.karaoke_comando('ABC234','ap-celular2','x','pedir', jsonb_build_object('t', repeat('a',50000)));
\echo '--- 15. acesso direto as tabelas'
select * from karaoke.salas;
select * from public.salas;
\echo '--- 16. fechar com token errado nao fecha; com token certo fecha'
select public.karaoke_sala_fechar('ABC234','cccccccccccccccccccccccccccccccc');
select public.karaoke_sala_ver('ABC234','ap-celular1','x',-1);
select public.karaoke_sala_fechar('ABC234','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
select public.karaoke_sala_ver('ABC234','ap-celular1','x',-1);
reset role;
\echo '--- 17. faxina: comandos e aparelhos sumiram junto com a sala'
select (select count(*) from karaoke.comandos) as comandos, (select count(*) from karaoke.aparelhos) as aparelhos;
