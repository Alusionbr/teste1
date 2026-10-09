create table public.estante_bug_reports (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('lyrics_search', 'rehearsal_setlists', 'interface_controls', 'other')),
  description text not null check (char_length(btrim(description)) between 15 and 1500),
  page_path text not null default '' check (char_length(page_path) <= 200 and left(page_path, 1) = '/'),
  app_version text not null check (char_length(app_version) <= 24 and app_version ~ '^\\d+\\.\\d+\\.\\d+$'),
  status text not null default 'new' check (status in ('new', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now()
);

alter table public.estante_bug_reports enable row level security;
revoke all on table public.estante_bug_reports from public, anon, authenticated;
grant select on table public.estante_bug_reports to authenticated;
grant update (status) on table public.estante_bug_reports to authenticated;
grant all on table public.estante_bug_reports to service_role;

create policy "estante_bug_reports_admin_read"
on public.estante_bug_reports
for select
to authenticated
using (
  exists (
    select 1 from public.estante_admins a
    where a.user_id = (select auth.uid())
  )
);

create policy "estante_bug_reports_admin_update"
on public.estante_bug_reports
for update
to authenticated
using (
  exists (
    select 1 from public.estante_admins a
    where a.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.estante_admins a
    where a.user_id = (select auth.uid())
  )
);
