-- A member's household/business entries are always visible to the family.
-- Their personal entries remain visible only to themselves until they share them.
create or replace function fin_private.entry_visible(h uuid, o uuid, s boolean, a text)
returns boolean language sql stable security definer set search_path=''
as $$
  select fin_private.member(h) and (
    o=(select auth.uid())
    or s
    or (fin_private.admin(h) and exists(
      select 1 from public.fin_members m
      where m.home_id=h and m.user_id=o and m.role='admin' and m.active
    ))
  )
$$;
revoke all on function fin_private.entry_visible(uuid,uuid,boolean,text) from public,anon;
grant execute on function fin_private.entry_visible(uuid,uuid,boolean,text) to authenticated;

-- Preserve admin visibility for existing household and business expenses.
update public.fin_entries e set shared=true
from public.fin_members m
where m.home_id=e.home_id and m.user_id=e.owner_id and m.role='member'
  and e.area in ('household','business') and not e.shared;

drop policy visible on public.fin_entries;
create policy visible on public.fin_entries for select to authenticated
using(fin_private.entry_visible(home_id,owner_id,shared,area));

-- The database enforces defaults even for clients other than this app.
create or replace function fin_private.guard_sharing()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if tg_table_name='fin_entries' then
    if new.shared is distinct from old.shared then
      if new.owner_id=(select auth.uid()) and not fin_private.admin(old.home_id) then
        if new.area in ('household','business') and not new.shared then
          raise exception 'Household entries are shared automatically';
        end if;
      elsif fin_private.admin(old.home_id) and new.owner_id<>(select auth.uid())
        and new.area='personal' then
        raise exception 'Only the owner controls sharing for personal entries';
      elsif not fin_private.admin(old.home_id) then
        raise exception 'You cannot change this entry sharing';
      end if;
    end if;
    return new;
  end if;
  if new.shared is distinct from old.shared and not fin_private.admin(old.home_id) then
    raise exception 'Only administrator can change visibility';
  end if;
  return new;
end $$;

create or replace function fin_private.entry_share_default()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if new.owner_id=(select auth.uid()) and not fin_private.admin(new.home_id)
    and new.area in ('household','business') then
    new.shared:=true;
  end if;
  return new;
end $$;
revoke all on function fin_private.entry_share_default() from public,anon,authenticated;
drop trigger if exists entry_share_default on public.fin_entries;
create trigger entry_share_default before insert or update on public.fin_entries
for each row execute function fin_private.entry_share_default();

drop policy add_own on public.fin_entries;
create policy add_own on public.fin_entries for insert to authenticated
with check(fin_private.editable(home_id,owner_id,'entries')
  and (owner_id=(select auth.uid()) or fin_private.admin(home_id)));

create or replace function public.fin_plan_month(h uuid,m text)
returns int language plpgsql security invoker set search_path=''
as $$
declare count_inserted int;
begin
  if m !~ '^\d{4}-(0[1-9]|1[0-2])$' or not fin_private.allowed(h,'entries') then
    raise exception 'Invalid month or permission';
  end if;
  insert into public.fin_entries(home_id,owner_id,shared,description,amount_cents,date,due_date,kind,category,area,status,payment,recurring_id,recurring_month)
  select r.home_id,r.owner_id,
    case when r.owner_id=(select auth.uid()) then r.shared
         when r.area in ('household','business') then true else r.shared end,
    r.name,r.amount_cents,
    (m||'-01')::date + (least(r.day,extract(day from ((m||'-01')::date+interval '1 month - 1 day'))::int)-1),
    (m||'-01')::date + (least(r.day,extract(day from ((m||'-01')::date+interval '1 month - 1 day'))::int)-1),
    'expense',r.category,r.area,'pending','cash',r.id,m
  from public.fin_recurring r
  where r.home_id=h and r.start_month<=m
    and exists(select 1 from public.fin_members member where member.home_id=r.home_id and member.user_id=r.owner_id and member.active)
    and (r.owner_id=(select auth.uid()) or fin_private.admin(h))
  on conflict(recurring_id,recurring_month) where recurring_id is not null do nothing;
  get diagnostics count_inserted=row_count;
  return count_inserted;
end $$;

-- A receipt inherits the privacy of the entry it is attached to.
create or replace function fin_private.document_visible(d uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select exists(
    select 1 from public.fin_documents doc
    where doc.id=d
      and fin_private.visible(doc.home_id,doc.owner_id,doc.shared)
      and (doc.entry_id is null or exists(
        select 1 from public.fin_entries e
        where e.id=doc.entry_id and e.home_id=doc.home_id
          and fin_private.entry_visible(e.home_id,e.owner_id,e.shared,e.area)
      ))
      and (doc.card_id is null or exists(
        select 1 from public.fin_cards c
        where c.id=doc.card_id
          and fin_private.visible(c.home_id,c.owner_id,c.shared)
      ))
  )
$$;
revoke all on function fin_private.document_visible(uuid) from public,anon;
grant execute on function fin_private.document_visible(uuid) to authenticated;

-- Family reminders are shared home tasks, separate from expenses and recurring bills.
create table public.fin_reminders (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references public.fin_homes(id),
  owner_id uuid not null references auth.users(id),
  title text not null check(length(title) between 1 and 160),
  due_on date not null,
  recurrence text not null default 'once' check(recurrence in ('once','weekly','monthly','yearly')),
  completed boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.fin_reminders enable row level security;
revoke all on public.fin_reminders from public,anon,authenticated;
grant select,insert,update,delete on public.fin_reminders to authenticated;
create policy household_read on public.fin_reminders for select to authenticated
using(fin_private.member(home_id));
create policy reminder_add on public.fin_reminders for insert to authenticated
with check(fin_private.allowed(home_id,'entries') and owner_id=(select auth.uid()));
create policy reminder_edit on public.fin_reminders for update to authenticated
using(fin_private.editable(home_id,owner_id,'entries'))
with check(fin_private.editable(home_id,owner_id,'entries'));
create policy reminder_remove on public.fin_reminders for delete to authenticated
using(fin_private.editable(home_id,owner_id,'entries'));
create function fin_private.guard_reminder_identity()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if tg_op='UPDATE' and (new.id!=old.id or new.home_id!=old.home_id or new.owner_id!=old.owner_id) then
    raise exception 'Reminder identity is immutable';
  end if;
  if not exists(select 1 from public.fin_members m where m.home_id=new.home_id and m.user_id=new.owner_id and m.active) then
    raise exception 'Invalid reminder owner';
  end if;
  return new;
end $$;
revoke all on function fin_private.guard_reminder_identity() from public,anon,authenticated;
create trigger reminder_identity before insert or update on public.fin_reminders
for each row execute function fin_private.guard_reminder_identity();
create trigger audit after insert or update or delete on public.fin_reminders
for each row execute function fin_private.audit_record();
create index fin_reminders_home_due on public.fin_reminders(home_id,due_on) where not completed;
