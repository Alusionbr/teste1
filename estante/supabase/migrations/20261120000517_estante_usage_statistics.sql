create schema if not exists estante_usage;
revoke all on schema estante_usage from public;
grant usage on schema estante_usage to authenticated, service_role;

create table estante_usage.daily_counts (
  day date not null,
  metric text not null,
  ref text not null,
  total bigint not null check (total > 0),
  primary key (day, metric, ref),
  check (
    (metric = 'rhythm' and ref in ('xote', 'samba', 'pop', 'rock', 'hiphop', 'bossa', 'jazz'))
    or (metric in ('rehearsed', 'missing_lyrics') and ref ~ '^(mbid:[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}|(lrclib|apple|deezer):[1-9][0-9]{0,14})$')
  )
);

create table estante_usage.received_batches (
  id text primary key check (id ~ '^usage_[a-zA-Z0-9_-]{8,64}$'),
  received_at timestamptz not null default now()
);
create index estante_usage_batches_received_at on estante_usage.received_batches (received_at);

create table estante_usage.hourly_budget (
  hour timestamptz primary key,
  batches integer not null check (batches between 1 and 2000)
);

alter table estante_usage.daily_counts enable row level security;
alter table estante_usage.received_batches enable row level security;
alter table estante_usage.hourly_budget enable row level security;
revoke all on all tables in schema estante_usage from public, anon, authenticated;
grant select on estante_usage.daily_counts to authenticated;
grant all on all tables in schema estante_usage to service_role;

create policy estante_usage_admin_read on estante_usage.daily_counts
  for select to authenticated
  using (exists (select 1 from public.estante_admins a where a.user_id = (select auth.uid())));

create function public.estante_collect_usage(batch_id text, batch_rows jsonb)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  utc_today date := (now() at time zone 'UTC')::date;
  current_hour timestamptz := date_trunc('hour', now(), 'UTC');
  batch_count integer;
begin
  if batch_rows is null or jsonb_typeof(batch_rows) <> 'array' then
    raise exception 'Expected a batch array' using errcode = '22023';
  end if;
  if jsonb_array_length(batch_rows) not between 1 and 32 or exists (
    select 1 from jsonb_to_recordset(batch_rows) as row(day date, metric text, ref text, count integer)
      where row.day is null or row.day not between utc_today - 7 and utc_today + 1
        or row.count is null or row.count not between 1 and 50
  ) then
    raise exception 'Invalid usage batch' using errcode = '22023';
  end if;

  insert into estante_usage.received_batches (id) values (batch_id)
  on conflict do nothing;
  if not found then return false; end if;

  insert into estante_usage.hourly_budget (hour, batches) values (current_hour, 1)
  on conflict (hour) do update set batches = estante_usage.hourly_budget.batches + 1
  where estante_usage.hourly_budget.batches < 2000
  returning batches into batch_count;
  if not found then
    raise exception 'Usage intake limit reached' using errcode = 'PT429';
  end if;

  insert into estante_usage.daily_counts (day, metric, ref, total)
  select row.day, row.metric, row.ref, sum(row.count)
  from jsonb_to_recordset(batch_rows) as row(day date, metric text, ref text, count integer)
  group by row.day, row.metric, row.ref
  on conflict (day, metric, ref) do update set total = estante_usage.daily_counts.total + excluded.total;

  if batch_count = 1 then
    delete from estante_usage.received_batches where received_at < now() - interval '8 days';
    delete from estante_usage.hourly_budget where hour < current_hour - interval '1 day';
    delete from estante_usage.daily_counts where day < utc_today - 179;
  end if;

  return true;
end;
$$;
revoke all on function public.estante_collect_usage(text, jsonb) from public, anon, authenticated;
grant execute on function public.estante_collect_usage(text, jsonb) to service_role;

create function public.estante_usage_report()
returns table (metric text, ref text, total bigint)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if not exists (select 1 from public.estante_admins a where a.user_id = (select auth.uid())) then
    raise insufficient_privilege using message = 'Estante admin required';
  end if;

  return query
    with grouped as (
      select d.metric, d.ref, sum(d.total)::bigint as total
      from estante_usage.daily_counts d
      where d.day between (now() at time zone 'UTC')::date - 29 and (now() at time zone 'UTC')::date
      group by d.metric, d.ref
    ), ranked as (
      select g.*, row_number() over (partition by g.metric order by g.total desc, g.ref) as rank
      from grouped g
    )
    select r.metric, r.ref, r.total from ranked r
    where r.rank <= 15 order by r.metric, r.rank;
end;
$$;
revoke all on function public.estante_usage_report() from public, anon, authenticated;
grant execute on function public.estante_usage_report() to authenticated;
