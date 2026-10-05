-- Personal appearance belongs to the signed-in user, including when that user is an administrator.
-- Additive: no existing financial records or shared-project settings are changed.
create table public.fin_preferences (
  user_id uuid primary key references auth.users(id),
  theme text not null default 'system' check(theme in ('system','light','dark')),
  palette text not null default 'forest' check(palette in ('forest','ocean','plum')),
  text_size text not null default 'standard' check(text_size in ('standard','large')),
  comfortable boolean not null default true,
  simple_mode boolean not null default true,
  hide_values boolean not null default false,
  dashboard_order text[] not null default array['categories','insights','recent']::text[]
    check(cardinality(dashboard_order) between 0 and 3 and dashboard_order <@ array['categories','insights','recent']::text[]),
  quick_actions text[] not null default array['expense','shopping']::text[]
    check(cardinality(quick_actions) between 0 and 4 and quick_actions <@ array['expense','cards','shopping','pantry']::text[]),
  revision integer not null default 1 check(revision>0),
  updated_at timestamptz not null default now()
);
alter table public.fin_preferences enable row level security;
revoke all on public.fin_preferences from public,anon,authenticated;
grant select on public.fin_preferences to authenticated;
grant insert(user_id,theme,palette,text_size,comfortable,simple_mode,hide_values,dashboard_order,quick_actions) on public.fin_preferences to authenticated;
grant update(theme,palette,text_size,comfortable,simple_mode,hide_values,dashboard_order,quick_actions) on public.fin_preferences to authenticated;
create policy own_preferences_read on public.fin_preferences for select to authenticated
using(user_id=(select auth.uid()) and exists(select 1 from public.fin_members m where m.user_id=(select auth.uid()) and m.active));
create policy own_preferences_add on public.fin_preferences for insert to authenticated
with check(user_id=(select auth.uid()) and exists(select 1 from public.fin_members m where m.user_id=(select auth.uid()) and m.active));
create policy own_preferences_edit on public.fin_preferences for update to authenticated
using(user_id=(select auth.uid()) and exists(select 1 from public.fin_members m where m.user_id=(select auth.uid()) and m.active))
with check(user_id=(select auth.uid()) and exists(select 1 from public.fin_members m where m.user_id=(select auth.uid()) and m.active));
create function fin_private.preferences_revision() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  new.revision:=old.revision+1;
  new.updated_at:=now();
  return new;
end $$;
revoke all on function fin_private.preferences_revision() from public,anon,authenticated;
create trigger preferences_revision before update on public.fin_preferences for each row execute function fin_private.preferences_revision();
