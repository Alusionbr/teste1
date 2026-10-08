-- Financeiro360 private vault only. Do not apply until local RLS tests pass and the target project is reviewed.
create table public.fin_user_vault (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 10485760),
  revision bigint not null default 1 check (revision > 0)
);

alter table public.fin_user_vault enable row level security;

revoke all on table public.fin_user_vault from public, anon, authenticated;
grant select, insert on table public.fin_user_vault to authenticated;
grant update (payload, revision) on table public.fin_user_vault to authenticated;

create policy fin_user_vault_select on public.fin_user_vault
  for select to authenticated using (user_id = (select auth.uid()));
create policy fin_user_vault_insert on public.fin_user_vault
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy fin_user_vault_update on public.fin_user_vault
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
