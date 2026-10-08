-- Estante only: no Bible tables, triggers or policies are changed.
create table public.estante_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.estante_admins enable row level security;
revoke all on public.estante_admins from anon, authenticated;
grant select on public.estante_admins to authenticated;
create policy estante_admin_self on public.estante_admins for select to authenticated
using (user_id = (select auth.uid()));
-- Bind the existing confirmed account; never trust user-editable metadata.
insert into public.estante_admins(user_id)
select id from auth.users where lower(email) = 'josephalusion@gmail.com'
and email_confirmed_at is not null;

create table public.estante_workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  constraint estante_payload_shape check (coalesce((
    jsonb_typeof(payload) = 'object' and payload->>'version' = '4'
    and jsonb_typeof(payload->'setlists') = 'array'
    and jsonb_typeof(payload->'library') = 'array'
    and octet_length(payload::text) <= 2097152
  ),false))
);
alter table public.estante_workspaces enable row level security;
revoke all on public.estante_workspaces from anon, authenticated;
grant select, insert on public.estante_workspaces to authenticated;
grant update(payload, revision, updated_at) on public.estante_workspaces to authenticated;
create policy estante_workspace_read on public.estante_workspaces for select to authenticated
using (user_id = (select auth.uid()));
create policy estante_workspace_insert on public.estante_workspaces for insert to authenticated
with check (user_id = (select auth.uid()) and not coalesce((select auth.jwt()->>'is_anonymous')::boolean, false));
create policy estante_workspace_update on public.estante_workspaces for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()) and not coalesce((select auth.jwt()->>'is_anonymous')::boolean, false));

create function public.estante_save_workspace(p_payload jsonb, p_expected bigint)
returns setof public.estante_workspaces language plpgsql security invoker
set search_path = '' as $$
begin
  if auth.uid() is null then raise insufficient_privilege; end if;
  if p_expected = 0 then
    return query insert into public.estante_workspaces(user_id,payload,revision)
      values(auth.uid(),p_payload,1) on conflict(user_id) do nothing returning *;
  else
    return query update public.estante_workspaces set payload=p_payload,
      revision=p_expected+1, updated_at=now()
      where user_id=auth.uid() and revision=p_expected returning *;
  end if;
  if not found then raise exception 'ESTANTE_CONFLICT' using errcode='40001'; end if;
end $$;
revoke all on function public.estante_save_workspace(jsonb,bigint) from public,anon;
grant execute on function public.estante_save_workspace(jsonb,bigint) to authenticated;

create table public.estante_usage_sessions (
  id uuid primary key,
  user_id uuid references auth.users(id) on delete cascade,
  label text not null check (length(label) <= 254),
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  active boolean not null default true,
  feature text not null check (feature in ('results','library','setlist','rehearsal')),
  app_version text not null check (length(app_version) <= 24)
);
create index estante_usage_seen on public.estante_usage_sessions(last_seen_at desc);
create index estante_usage_user on public.estante_usage_sessions(user_id);
alter table public.estante_usage_sessions enable row level security;
revoke all on public.estante_usage_sessions from anon,authenticated;
grant select on public.estante_usage_sessions to authenticated;
create policy estante_usage_admin on public.estante_usage_sessions for select to authenticated
using (exists(select 1 from public.estante_admins where user_id=(select auth.uid())));

create table public.estante_error_counts (
  day date not null default current_date,
  code text not null check (code in ('app_error','unhandled_rejection','local_save','cloud_sync','lyrics_unavailable','source_vagalume','source_lrclib')),
  app_version text not null check (length(app_version) <= 24),
  occurrences integer not null default 1,
  primary key(day,code,app_version)
);
alter table public.estante_error_counts enable row level security;
revoke all on public.estante_error_counts from anon,authenticated;
grant select on public.estante_error_counts to authenticated;
create policy estante_errors_admin on public.estante_error_counts for select to authenticated
using (exists(select 1 from public.estante_admins where user_id=(select auth.uid())));

create table public.estante_usage_limits (
  bucket text primary key,
  count integer not null default 1,
  expires_at timestamptz not null
);
alter table public.estante_usage_limits enable row level security;
revoke all on public.estante_usage_limits from anon,authenticated;
-- Invoker RPC usable only by the Edge Function's server-side service role.
create function public.estante_record_usage(
  p_id uuid, p_user uuid, p_label text, p_feature text, p_version text,
  p_active boolean, p_error text, p_rate_key text
) returns void language plpgsql security invoker set search_path='' as $$
declare hits integer; daily_hits integer;
begin
  insert into public.estante_usage_limits(bucket,expires_at)
  values('minute:'||p_rate_key||':'||to_char(now(),'YYYYMMDDHH24MI'),now()+interval '2 minutes')
  on conflict(bucket) do update set count=public.estante_usage_limits.count+1
  returning count into hits;
  if hits>30 then raise exception 'ESTANTE_RATE_LIMIT'; end if;
  insert into public.estante_usage_limits(bucket,expires_at)
  values('day:'||current_date::text,now()+interval '2 days')
  on conflict(bucket) do update set count=public.estante_usage_limits.count+1
  returning count into daily_hits;
  if daily_hits>100000 then raise exception 'ESTANTE_RATE_LIMIT'; end if;
  if exists(select 1 from public.estante_usage_sessions where id=p_id and user_id is distinct from p_user) then
    raise insufficient_privilege;
  end if;
  insert into public.estante_usage_sessions(id,user_id,label,feature,app_version,active)
  values(p_id,p_user,p_label,p_feature,p_version,p_active)
  on conflict(id) do update set last_seen_at=now(),active=p_active,feature=p_feature,app_version=p_version,label=p_label;
  if p_error is not null then
    insert into public.estante_error_counts(code,app_version) values(p_error,p_version)
    on conflict(day,code,app_version) do update set occurrences=public.estante_error_counts.occurrences+1;
  end if;
  if daily_hits % 100 = 1 then
    delete from public.estante_usage_limits where expires_at<now();
    delete from public.estante_usage_sessions where last_seen_at<now()-interval '30 days';
    delete from public.estante_error_counts where day<current_date-30;
  end if;
end $$;
revoke all on function public.estante_record_usage(uuid,uuid,text,text,text,boolean,text,text) from public,anon,authenticated;
grant execute on function public.estante_record_usage(uuid,uuid,text,text,text,boolean,text,text) to service_role;
grant all on public.estante_usage_sessions,public.estante_error_counts,public.estante_usage_limits to service_role;
