begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values
 ('11111111-1111-4111-8111-111111111111', 'vault-owner@example.invalid'),
 ('22222222-2222-4222-8222-222222222222', 'vault-other@example.invalid');

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select lives_ok($$insert into public.fin_user_vault (user_id, payload)
  values ('11111111-1111-4111-8111-111111111111', '{"version":1}')$$, 'Owner can create own vault');
select results_eq('select count(*) from public.fin_user_vault', array[1::bigint], 'Owner sees own vault');
select throws_ok($$insert into public.fin_user_vault (user_id, payload)
  values ('22222222-2222-4222-8222-222222222222', '{"version":1}')$$,
  '42501', null, 'Owner cannot create vault for another user');
select results_eq($$update public.fin_user_vault set revision = 2
  where user_id = '11111111-1111-4111-8111-111111111111' and revision = 1
  returning revision$$, array[2::bigint], 'Conditional update advances revision');
select results_eq($$update public.fin_user_vault set revision = 2
  where user_id = '11111111-1111-4111-8111-111111111111' and revision = 1
  returning revision$$, array[]::bigint[], 'Stale revision cannot overwrite');
select throws_ok($$update public.fin_user_vault
  set user_id = '22222222-2222-4222-8222-222222222222'
  where user_id = '11111111-1111-4111-8111-111111111111'$$,
  '42501', null, 'Client cannot reassign vault owner');

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select results_eq('select count(*) from public.fin_user_vault', array[0::bigint], 'Other user cannot see owner vault');
select results_eq($$update public.fin_user_vault set revision = 3
  where user_id = '11111111-1111-4111-8111-111111111111' returning revision$$,
  array[]::bigint[], 'Other user cannot update owner vault');

set local role anon;
select throws_ok('select count(*) from public.fin_user_vault', '42501', null,
  'Anonymous role cannot read vault');

select * from finish();
rollback;
