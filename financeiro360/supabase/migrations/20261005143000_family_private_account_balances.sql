-- Account visibility and balance visibility are separate decisions.
alter table public.fin_accounts
  add column share_balance boolean not null default false,
  add constraint fin_accounts_balance_sharing_requires_account check (not share_balance or shared);

create function fin_private.guard_account_balance_sharing() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.share_balance is distinct from old.share_balance and not fin_private.admin(old.home_id) then
    raise exception 'Only administrator can share an account balance';
  end if;
  return new;
end $$;
revoke all on function fin_private.guard_account_balance_sharing() from public, anon, authenticated;
create trigger balance_sharing before update on public.fin_accounts
for each row execute function fin_private.guard_account_balance_sharing();

-- The calculation sees all movements in the account, including private entries.
-- Only an expressly shared aggregate may cross the account owner's boundary.
create function public.fin_account_overview(p_home uuid)
returns table (
  id uuid, home_id uuid, owner_id uuid, shared boolean, name text, area text,
  opening_cents bigint, balance_date date, created_at timestamptz,
  share_balance boolean, current_balance_cents bigint
)
language sql stable security definer set search_path = '' as $$
  select a.id, a.home_id, a.owner_id, a.shared, a.name, a.area,
    case when a.owner_id = (select auth.uid()) or fin_private.admin(a.home_id) then a.opening_cents end,
    case when a.owner_id = (select auth.uid()) or fin_private.admin(a.home_id) then a.balance_date end,
    a.created_at, a.share_balance,
    case when a.opening_cents is not null and a.balance_date is not null
      and (a.owner_id = (select auth.uid()) or fin_private.admin(a.home_id)
           or (a.shared and a.share_balance))
      then a.opening_cents + coalesce((
        select sum(case
          when e.kind = 'transfer' then
            (case when e.target_account_id = a.id then e.amount_cents else 0 end)
            - (case when e.account_id = a.id then e.amount_cents else 0 end)
          when e.account_id = a.id and e.payment = 'cash' then
            case when e.kind = 'income' then e.amount_cents else -e.amount_cents end
          else 0 end)
        from public.fin_entries e
        where e.home_id = a.home_id and e.status = 'paid' and e.date > a.balance_date
          and (e.account_id = a.id or e.target_account_id = a.id)
      ), 0)::bigint
    end
  from public.fin_accounts a
  where a.home_id = p_home and fin_private.visible(a.home_id, a.owner_id, a.shared)
  order by a.created_at, a.id;
$$;
revoke all on function public.fin_account_overview(uuid) from public, anon;
grant execute on function public.fin_account_overview(uuid) to authenticated;

-- Direct account reads are restricted after the frontend switches to the overview RPC.
