-- Family finance only. All financial writes retain existing RLS and triggers.
alter table public.fin_cards add column if not exists archived_at timestamptz;
alter table public.fin_cards add column if not exists merged_into_id uuid references public.fin_cards(id);
alter table public.fin_debts add column if not exists installment_count integer check (installment_count between 1 and 360);
alter table public.fin_debts add column if not exists installment_cents bigint check (installment_cents > 0);
alter table public.fin_debts add column if not exists first_due_date date;
create function fin_private.guard_card_archive() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.merged_into_id is not null and new.archived_at is null then raise exception 'A merged card cannot be restored'; end if;
 if old.archived_at is null and new.archived_at is not null and (
  exists(select 1 from public.fin_entries where card_id=new.id) or
  exists(select 1 from public.fin_documents where card_id=new.id) or
  exists(select 1 from public.fin_invoice_alignments where card_id=new.id)
 ) then raise exception 'Move or review linked records before archiving'; end if;
 return new;
end $$;
revoke all on function fin_private.guard_card_archive() from public,anon,authenticated;
-- Installed after the alignment table below.

create table public.fin_account_balance_checks (
 id uuid primary key default gen_random_uuid(),
 home_id uuid not null references public.fin_homes(id),
 owner_id uuid not null references auth.users(id),
 account_id uuid not null references public.fin_accounts(id),
 previous_cents bigint,
 previous_date date,
 balance_cents bigint,
 balance_date date,
 actor_id uuid,
 created_at timestamptz not null default now()
);
create index fin_account_balance_checks_account on public.fin_account_balance_checks(account_id,created_at desc);
alter table public.fin_account_balance_checks enable row level security;
revoke all on public.fin_account_balance_checks from public,anon,authenticated;
grant select on public.fin_account_balance_checks to authenticated;
create policy account_check_read on public.fin_account_balance_checks for select to authenticated
 using (fin_private.member(home_id) and (owner_id=auth.uid() or fin_private.admin(home_id)));
create function fin_private.record_account_balance_check() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.opening_cents is distinct from old.opening_cents or new.balance_date is distinct from old.balance_date then
  insert into public.fin_account_balance_checks(home_id,owner_id,account_id,previous_cents,previous_date,balance_cents,balance_date,actor_id)
  values(new.home_id,new.owner_id,new.id,old.opening_cents,old.balance_date,new.opening_cents,new.balance_date,auth.uid());
 end if;
 return null;
end $$;
revoke all on function fin_private.record_account_balance_check() from public,anon,authenticated;
create trigger balance_check after update of opening_cents,balance_date on public.fin_accounts
 for each row execute function fin_private.record_account_balance_check();

create table public.fin_invoice_alignments (
 id uuid primary key default gen_random_uuid(),
 home_id uuid not null references public.fin_homes(id),
 owner_id uuid not null references auth.users(id),
 card_id uuid not null references public.fin_cards(id),
 invoice_month text not null check (invoice_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
 cutoff_on date not null,
 total_cents bigint not null check (total_cents >= 0 and total_cents <= 9007199254740991),
 note text not null default '' check (length(note) <= 500),
 active boolean not null default true,
 created_at timestamptz not null default now()
);
create unique index fin_invoice_alignment_active on public.fin_invoice_alignments(card_id,invoice_month) where active;
create index fin_invoice_alignment_home on public.fin_invoice_alignments(home_id,owner_id);
alter table public.fin_invoice_alignments enable row level security;
revoke all on public.fin_invoice_alignments from public,anon,authenticated;
grant select,insert,update on public.fin_invoice_alignments to authenticated;
create policy alignment_read on public.fin_invoice_alignments for select to authenticated using (
 fin_private.visible(home_id,owner_id,false));
create policy alignment_insert on public.fin_invoice_alignments for insert to authenticated with check (
 fin_private.editable(home_id,owner_id,'cards'));
create policy alignment_update on public.fin_invoice_alignments for update to authenticated using (
 fin_private.editable(home_id,owner_id,'cards')) with check (fin_private.editable(home_id,owner_id,'cards'));
create function fin_private.check_invoice_alignment() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='UPDATE' and (new.id<>old.id or new.home_id<>old.home_id or new.owner_id<>old.owner_id or new.card_id<>old.card_id or new.invoice_month<>old.invoice_month or new.cutoff_on<>old.cutoff_on or new.total_cents<>old.total_cents or new.note<>old.note or new.created_at<>old.created_at) then
  raise exception 'Alignment history is immutable';
 end if;
 if not exists(select 1 from public.fin_cards c where c.id=new.card_id and c.home_id=new.home_id and c.owner_id=new.owner_id and c.archived_at is null) then
  raise exception 'Card unavailable for alignment';
 end if;
 return new;
end $$;
revoke all on function fin_private.check_invoice_alignment() from public,anon,authenticated;
create trigger alignment_identity before insert or update on public.fin_invoice_alignments for each row execute function fin_private.check_invoice_alignment();
create trigger alignment_audit after insert or update on public.fin_invoice_alignments for each row execute function fin_private.audit_record();

-- An exception is explicit: true means this purchase must be added after the checkpoint.
create table public.fin_invoice_alignment_exceptions (
 id uuid primary key default gen_random_uuid(),
 home_id uuid not null references public.fin_homes(id),
 owner_id uuid not null references auth.users(id),
 alignment_id uuid not null references public.fin_invoice_alignments(id),
 entry_id uuid not null references public.fin_entries(id) on delete cascade,
 count_after boolean not null,
 unique(alignment_id,entry_id)
);
create index fin_invoice_alignment_exceptions_home on public.fin_invoice_alignment_exceptions(home_id,owner_id);
alter table public.fin_invoice_alignment_exceptions enable row level security;
revoke all on public.fin_invoice_alignment_exceptions from public,anon,authenticated;
grant select,insert,update,delete on public.fin_invoice_alignment_exceptions to authenticated;
create policy alignment_exception_read on public.fin_invoice_alignment_exceptions for select to authenticated using (fin_private.visible(home_id,owner_id,false));
create policy alignment_exception_add on public.fin_invoice_alignment_exceptions for insert to authenticated with check (fin_private.editable(home_id,owner_id,'cards'));
create policy alignment_exception_edit on public.fin_invoice_alignment_exceptions for update to authenticated using (fin_private.editable(home_id,owner_id,'cards')) with check (fin_private.editable(home_id,owner_id,'cards'));
create policy alignment_exception_remove on public.fin_invoice_alignment_exceptions for delete to authenticated using (fin_private.editable(home_id,owner_id,'cards'));
create function fin_private.check_invoice_exception() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='UPDATE' and (new.id<>old.id or new.home_id<>old.home_id or new.owner_id<>old.owner_id or new.alignment_id<>old.alignment_id or new.entry_id<>old.entry_id) then
  raise exception 'Exception identity is immutable';
 end if;
 if not exists(
  select 1 from public.fin_invoice_alignments a join public.fin_entries e on e.id=new.entry_id
  where a.id=new.alignment_id and a.active and a.home_id=new.home_id and a.owner_id=new.owner_id
  and e.home_id=a.home_id and e.card_id=a.card_id and e.kind='expense' and e.payment='card'
 ) then raise exception 'Entry does not belong to this aligned card'; end if;
 return new;
end $$;
revoke all on function fin_private.check_invoice_exception() from public,anon,authenticated;
create trigger exception_identity before insert or update on public.fin_invoice_alignment_exceptions for each row execute function fin_private.check_invoice_exception();
create trigger exception_audit after insert or update or delete on public.fin_invoice_alignment_exceptions for each row execute function fin_private.audit_record();

create function public.fin_align_invoice(p_card uuid,p_month text,p_cutoff date,p_total bigint,p_note text default '') returns uuid
language plpgsql security invoker set search_path='' as $$
declare c public.fin_cards; result_id uuid;
begin
 if p_month !~ '^\d{4}-(0[1-9]|1[0-2])$' or p_total < 0 or p_total > 9007199254740991 or p_cutoff is null or length(p_note)>500 then raise exception 'Invalid alignment'; end if;
 select * into c from public.fin_cards where id=p_card and archived_at is null for update;
 if not found or not fin_private.editable(c.home_id,c.owner_id,'cards') then raise exception 'Card unavailable'; end if;
 update public.fin_invoice_alignments set active=false where card_id=p_card and invoice_month=p_month and active;
 insert into public.fin_invoice_alignments(home_id,owner_id,card_id,invoice_month,cutoff_on,total_cents,note)
 values(c.home_id,c.owner_id,p_card,p_month,p_cutoff,p_total,coalesce(p_note,'')) returning id into result_id;
 return result_id;
end $$;
revoke all on function public.fin_align_invoice(uuid,text,date,bigint,text) from public,anon;
grant execute on function public.fin_align_invoice(uuid,text,date,bigint,text) to authenticated;

-- Atomic consolidation retains the original card as an archive and keeps entries/documents intact.
create function public.fin_merge_cards(p_source uuid,p_target uuid) returns void
language plpgsql security invoker set search_path='' as $$
declare s public.fin_cards; t public.fin_cards;
begin
 if p_source=p_target then raise exception 'Choose another card'; end if;
 perform 1 from public.fin_cards where id in (p_source,p_target) order by id for update;
 select * into s from public.fin_cards where id=p_source;
 select * into t from public.fin_cards where id=p_target;
 if s.id is null or t.id is null or s.archived_at is not null or t.archived_at is not null or s.home_id<>t.home_id or s.owner_id<>t.owner_id
 or s.closing_day<>t.closing_day or s.due_day<>t.due_day or not fin_private.editable(s.home_id,s.owner_id,'cards')
 or not fin_private.editable(s.home_id,s.owner_id,'entries') or not fin_private.editable(s.home_id,s.owner_id,'documents')
 then raise exception 'Cards cannot be consolidated'; end if;
 if exists(select 1 from public.fin_invoice_alignments where card_id=p_source) then
  raise exception 'Alignments exist on the duplicate; review them before merging';
 end if;
 update public.fin_entries set card_id=p_target where card_id=p_source;
 update public.fin_documents set card_id=p_target where card_id=p_source;
 update public.fin_cards set archived_at=now(),merged_into_id=p_target where id=p_source;
end $$;
revoke all on function public.fin_merge_cards(uuid,uuid) from public,anon;
grant execute on function public.fin_merge_cards(uuid,uuid) to authenticated;
create trigger guard_archive before update of archived_at on public.fin_cards
 for each row execute function fin_private.guard_card_archive();
