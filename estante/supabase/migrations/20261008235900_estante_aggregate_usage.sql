-- Replace per-session telemetry with non-identifying aggregate counters.
-- The old function and table held only anonymous local-test records; remove them.
drop function if exists public.estante_record_usage(uuid,uuid,text,text,text,boolean,text,text);
drop table if exists public.estante_usage_sessions;
delete from public.estante_usage_limits where bucket like 'minute:%';

create table public.estante_usage_counts (
  bucket_start timestamptz not null,
  feature text not null check (feature in ('results','library','setlist','rehearsal')),
  app_version text not null check (length(app_version) <= 24),
  pulses integer not null default 1 check (pulses between 1 and 100000),
  primary key(bucket_start,feature,app_version)
);
create index estante_usage_counts_time on public.estante_usage_counts(bucket_start desc);
alter table public.estante_usage_counts enable row level security;
revoke all on public.estante_usage_counts from anon,authenticated;
grant select on public.estante_usage_counts to authenticated;
grant all on public.estante_usage_counts to service_role;
create policy estante_usage_counts_admin on public.estante_usage_counts for select to authenticated
using (exists(select 1 from public.estante_admins where user_id=(select auth.uid())));

create function public.estante_record_aggregate(p_feature text,p_version text,p_error text)
returns void language plpgsql security invoker set search_path='' as $$
declare daily_hits integer;
begin
  insert into public.estante_usage_limits(bucket,expires_at)
  values('day:'||current_date::text,now()+interval '2 days')
  on conflict(bucket) do update set count=public.estante_usage_limits.count+1
  returning count into daily_hits;
  if daily_hits>100000 then raise exception 'ESTANTE_RATE_LIMIT'; end if;
  if p_error is null then
    insert into public.estante_usage_counts(bucket_start,feature,app_version)
    values(date_trunc('minute',now()),p_feature,p_version)
    on conflict(bucket_start,feature,app_version) do update
      set pulses=least(public.estante_usage_counts.pulses+1,100000);
  else
    insert into public.estante_error_counts(code,app_version) values(p_error,p_version)
    on conflict(day,code,app_version) do update set occurrences=public.estante_error_counts.occurrences+1;
  end if;
  if daily_hits % 100 = 1 then
    delete from public.estante_usage_limits where expires_at<now();
    delete from public.estante_usage_counts where bucket_start<now()-interval '30 days';
    delete from public.estante_error_counts where day<current_date-30;
  end if;
end $$;
revoke all on function public.estante_record_aggregate(text,text,text) from public,anon,authenticated;
grant execute on function public.estante_record_aggregate(text,text,text) to service_role;

create function public.estante_usage_summary()
returns table(feature text,recent_pulses bigint,pulses_24h bigint)
language sql security invoker set search_path='' as $$
  select c.feature,
    coalesce(sum(c.pulses) filter (where c.bucket_start>=date_trunc('minute',now())-interval '1 minute'),0)::bigint,
    sum(c.pulses)::bigint
  from public.estante_usage_counts c
  where c.bucket_start>=now()-interval '24 hours'
  group by c.feature
$$;
revoke all on function public.estante_usage_summary() from public,anon;
grant execute on function public.estante_usage_summary() to authenticated;
