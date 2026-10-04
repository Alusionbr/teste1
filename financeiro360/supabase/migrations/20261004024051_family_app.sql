-- Additive household app. Legacy vault and other projects are untouched.
create schema if not exists fin_private;
revoke all on schema fin_private from public, anon;
grant usage on schema fin_private to authenticated;
create table public.fin_homes (id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 1 and 80), owner_id uuid not null references auth.users(id), budget_cents bigint not null default 0 check(budget_cents>=0));
create table public.fin_members (home_id uuid references public.fin_homes(id),user_id uuid references auth.users(id),display_name text not null check(length(display_name) between 1 and 80),role text not null check(role in ('admin','member')),active boolean not null default true,permissions jsonb not null default '{"entries":true,"cards":true,"payments":true,"documents":true,"pantry":true,"shopping":true}'::jsonb,password_change_required boolean not null default true,primary key(home_id,user_id));
create function fin_private.member(h uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.fin_members where home_id=h and user_id=(select auth.uid()) and active) $$;
create function fin_private.admin(h uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.fin_members where home_id=h and user_id=(select auth.uid()) and role='admin' and active) $$;
create function fin_private.allowed(h uuid,p text) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.fin_members where home_id=h and user_id=(select auth.uid()) and active and (role='admin' or permissions->p='true'::jsonb)) $$;
create function fin_private.visible(h uuid,o uuid,s boolean) returns boolean language sql stable security definer set search_path='' as $$ select fin_private.member(h) and (o=(select auth.uid()) or s or fin_private.admin(h)) $$;
create function fin_private.editable(h uuid,o uuid,p text) returns boolean language sql stable security definer set search_path='' as $$ select fin_private.admin(h) or (o=(select auth.uid()) and fin_private.allowed(h,p)) $$;
revoke all on all functions in schema fin_private from public,anon;
grant execute on all functions in schema fin_private to authenticated;
create table public.fin_accounts(id uuid primary key default gen_random_uuid(),home_id uuid not null references public.fin_homes(id),owner_id uuid not null references auth.users(id),shared boolean not null default false,name text not null check(length(name) between 1 and 160),area text not null check(area in ('household','personal','business')),opening_cents bigint,balance_date date,created_at timestamptz not null default now(),check(opening_cents is null or balance_date is not null));
create table public.fin_cards(id uuid primary key default gen_random_uuid(),home_id uuid not null references public.fin_homes(id),owner_id uuid not null references auth.users(id),shared boolean not null default false,name text not null check(length(name) between 1 and 160),limit_cents bigint check(limit_cents>=0),closing_day int not null check(closing_day between 1 and 31),due_day int not null check(due_day between 1 and 31),created_at timestamptz not null default now());
create table public.fin_debts(id uuid primary key default gen_random_uuid(),home_id uuid not null references public.fin_homes(id),owner_id uuid not null references auth.users(id),shared boolean not null default false,name text not null check(length(name) between 1 and 160),creditor text not null check(length(creditor)<=160),balance_cents bigint check(balance_cents>=0),due_date date,area text not null check(area in ('household','personal','business')),created_at timestamptz not null default now());
create table public.fin_entries(id uuid primary key default gen_random_uuid(),home_id uuid not null references public.fin_homes(id),owner_id uuid not null references auth.users(id),shared boolean not null default false,description text not null check(length(description) between 1 and 160),amount_cents bigint not null check(amount_cents>0 and amount_cents<=9007199254740991),date date not null,due_date date,kind text not null check(kind in ('expense','income','transfer','card_payment','debt_payment')),category text not null check(length(category)<=80),area text not null check(area in ('household','personal','business')),status text not null check(status in ('paid','pending','pending_review')),payment text not null check(payment in ('cash','card')),card_id uuid references public.fin_cards(id),account_id uuid references public.fin_accounts(id),target_account_id uuid references public.fin_accounts(id),debt_id uuid references public.fin_debts(id),installments int not null default 1 check(installments between 1 and 48),invoice_month text check(invoice_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),source_ref text check(length(source_ref)<=160),created_at timestamptz not null default now(),check(payment!='card' or (kind='expense' and card_id is not null)),check(kind!='card_payment' or (card_id is not null and invoice_month is not null and payment='cash')),check(kind!='transfer' or (account_id is not null and target_account_id is not null and account_id!=target_account_id)),check(kind!='debt_payment' or debt_id is not null));
create table public.fin_goals(id uuid primary key default gen_random_uuid(),home_id uuid not null references public.fin_homes(id),owner_id uuid not null references auth.users(id),shared boolean not null default false,name text not null check(length(name) between 1 and 160),target_cents bigint not null check(target_cents>0),saved_cents bigint not null default 0 check(saved_cents>=0),due_date date,created_at timestamptz not null default now());
create table public.fin_pantry(id uuid primary key default gen_random_uuid(),home_id uuid not null references public.fin_homes(id),name text not null check(length(name) between 1 and 151),unit text not null check(length(unit) between 1 and 20),quantity numeric not null check(quantity>=0),minimum numeric not null check(minimum>=0),daily_use numeric not null default 0 check(daily_use>=0),price_cents bigint not null default 0 check(price_cents>=0),expires_on date,updated_at timestamptz not null default now());
create table public.fin_shopping(id uuid primary key default gen_random_uuid(),home_id uuid not null references public.fin_homes(id),name text not null check(length(name) between 1 and 151),pantry_id uuid references public.fin_pantry(id),quantity numeric not null check(quantity>0),unit text not null check(length(unit) between 1 and 20),estimate_cents bigint not null check(estimate_cents>=0),bought boolean not null default false);
create unique index fin_shopping_pending_unique on public.fin_shopping(home_id,pantry_id) where not bought and pantry_id is not null;
create table public.fin_documents(id uuid primary key default gen_random_uuid(),home_id uuid not null references public.fin_homes(id),owner_id uuid not null references auth.users(id),shared boolean not null default false,name text not null check(length(name) between 1 and 200),path text not null unique,entry_id uuid references public.fin_entries(id),card_id uuid references public.fin_cards(id),mime text not null check(mime in ('application/pdf','image/jpeg','image/png','image/webp')),size int not null check(size between 1 and 10485760),created_at timestamptz not null default now(),check(not(entry_id is not null and card_id is not null)));
create table public.fin_audit(id uuid primary key default gen_random_uuid(),home_id uuid not null references public.fin_homes(id),actor_id uuid,action text not null,table_name text not null,record_id uuid,created_at timestamptz not null default now());
-- FK authorization: inaccessible foreign rows must never be usable as write targets.
create function fin_private.check_record() returns trigger language plpgsql security definer set search_path='' as $$
declare old_owner uuid;
begin
 if tg_op='UPDATE' and (new.home_id!=old.home_id or new.owner_id!=old.owner_id or new.id!=old.id) then raise exception 'Record identity is immutable'; end if;
 if not exists(select 1 from public.fin_members where home_id=new.home_id and user_id=new.owner_id and active) then raise exception 'Invalid owner'; end if;
 if tg_table_name='fin_entries' then
  if new.card_id is not null and not exists(select 1 from public.fin_cards c where c.id=new.card_id and c.home_id=new.home_id and (fin_private.admin(c.home_id) or (c.owner_id=new.owner_id and c.owner_id=auth.uid()))) then raise exception 'Card unavailable'; end if;
  if new.account_id is not null and not exists(select 1 from public.fin_accounts a where a.id=new.account_id and a.home_id=new.home_id and (fin_private.admin(a.home_id) or (a.owner_id=new.owner_id and a.owner_id=auth.uid()))) then raise exception 'Account unavailable'; end if;
  if new.target_account_id is not null and not exists(select 1 from public.fin_accounts a where a.id=new.target_account_id and a.home_id=new.home_id and (fin_private.admin(a.home_id) or (a.owner_id=new.owner_id and a.owner_id=auth.uid()))) then raise exception 'Account unavailable'; end if;
  if new.debt_id is not null and not exists(select 1 from public.fin_debts d where d.id=new.debt_id and d.home_id=new.home_id and (fin_private.admin(d.home_id) or (d.owner_id=new.owner_id and d.owner_id=auth.uid()))) then raise exception 'Debt unavailable'; end if;
  if new.kind in ('card_payment','debt_payment') and not fin_private.allowed(new.home_id,'payments') then raise exception 'Payment permission required'; end if;
 end if;
 if tg_table_name='fin_documents' then
  if new.path != new.home_id::text || '/' || new.owner_id::text || '/' || new.id::text then raise exception 'Invalid document path'; end if;
  if new.entry_id is not null and not exists(select 1 from public.fin_entries e where e.id=new.entry_id and e.home_id=new.home_id and (fin_private.admin(e.home_id) or e.owner_id=auth.uid())) then raise exception 'Entry unavailable'; end if;
  if new.card_id is not null and not exists(select 1 from public.fin_cards c where c.id=new.card_id and c.home_id=new.home_id and (fin_private.admin(c.home_id) or c.owner_id=auth.uid())) then raise exception 'Card unavailable'; end if;
 end if;
 return new;
end $$;
create function fin_private.audit_record() returns trigger language plpgsql security definer set search_path='' as $$ begin insert into public.fin_audit(home_id,actor_id,action,table_name,record_id) values(case when tg_op='DELETE' then old.home_id else new.home_id end,auth.uid(),tg_op,tg_table_name,case when tg_op='DELETE' then old.id else new.id end);return null;end $$;
revoke all on all functions in schema fin_private from public,anon;
do $$ declare t text;p text;begin
 foreach t in array array['fin_accounts','fin_cards','fin_debts','fin_entries','fin_goals','fin_documents'] loop
 p:=case when t='fin_documents' then 'documents' when t in ('fin_cards','fin_accounts') then 'cards' else 'entries' end;
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant select,insert,update,delete on public.%I to authenticated',t);
 execute format('create policy visible on public.%I for select to authenticated using(fin_private.visible(home_id,owner_id,shared))',t);
 execute format('create policy add_own on public.%I for insert to authenticated with check(fin_private.editable(home_id,owner_id,%L) and (owner_id=auth.uid() or fin_private.admin(home_id)) and (not shared or fin_private.admin(home_id)))',t,p);
 execute format('create policy edit_own on public.%I for update to authenticated using(fin_private.editable(home_id,owner_id,%L)) with check(fin_private.editable(home_id,owner_id,%L))',t,p,p);
 execute format('create policy remove_own on public.%I for delete to authenticated using(fin_private.editable(home_id,owner_id,%L))',t,p);
 execute format('create trigger identity before insert or update on public.%I for each row execute function fin_private.check_record()',t);
 execute format('create trigger audit after insert or update or delete on public.%I for each row execute function fin_private.audit_record()',t);
 execute format('create index on public.%I(home_id,owner_id)',t);
 end loop;
 foreach t in array array['fin_pantry','fin_shopping'] loop
 p:=case when t='fin_pantry' then 'pantry' else 'shopping' end;
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant select,insert,update,delete on public.%I to authenticated',t);
 execute format('create policy household_read on public.%I for select to authenticated using(fin_private.member(home_id))',t);
 execute format('create policy household_write on public.%I for all to authenticated using(fin_private.allowed(home_id,%L)) with check(fin_private.allowed(home_id,%L))',t,p,p);
 execute format('create trigger audit after insert or update or delete on public.%I for each row execute function fin_private.audit_record()',t);
 end loop;
end $$;
-- Members can change their records, but only the administrator controls sharing.
create function fin_private.guard_sharing() returns trigger language plpgsql security definer set search_path='' as $$ begin if new.shared is distinct from old.shared and not fin_private.admin(old.home_id) then raise exception 'Only administrator can change visibility';end if;return new;end $$;
revoke all on function fin_private.guard_sharing() from public,anon,authenticated;
do $$ declare t text;begin foreach t in array array['fin_accounts','fin_cards','fin_debts','fin_entries','fin_goals','fin_documents'] loop execute format('create trigger sharing before update on public.%I for each row execute function fin_private.guard_sharing()',t);end loop;end $$;
alter table public.fin_homes enable row level security;
alter table public.fin_members enable row level security;
alter table public.fin_audit enable row level security;
revoke all on public.fin_homes,public.fin_members,public.fin_audit from public,anon,authenticated;
grant select on public.fin_homes,public.fin_members,public.fin_audit to authenticated;
grant update(name,budget_cents) on public.fin_homes to authenticated;
create policy home_read on public.fin_homes for select to authenticated using(fin_private.member(id));
create policy home_update on public.fin_homes for update to authenticated using(fin_private.admin(id)) with check(fin_private.admin(id));
create policy member_read on public.fin_members for select to authenticated using(fin_private.member(home_id));
create policy audit_admin on public.fin_audit for select to authenticated using(fin_private.admin(home_id));
-- Administration happens in a JWT-verified Edge Function using a server-only service key.
-- No public bootstrap RPC; owner membership is seeded by the operator after Auth provisioning.
create function fin_private.document_visible(d uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.fin_documents doc where doc.id=d and fin_private.visible(doc.home_id,doc.owner_id,doc.shared) and (doc.entry_id is null or exists(select 1 from public.fin_entries e where e.id=doc.entry_id and fin_private.visible(e.home_id,e.owner_id,e.shared))) and (doc.card_id is null or exists(select 1 from public.fin_cards c where c.id=doc.card_id and fin_private.visible(c.home_id,c.owner_id,c.shared)))) $$;
revoke all on function fin_private.document_visible(uuid) from public,anon;
grant execute on function fin_private.document_visible(uuid) to authenticated;
-- Tighten document metadata too; revoking a parent's visibility revokes attachments.
drop policy visible on public.fin_documents;
create policy visible on public.fin_documents for select to authenticated using(fin_private.document_visible(id));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('fin-family-private','fin-family-private',false,10485760,array['application/pdf','image/jpeg','image/png','image/webp']);
create policy fin_file_read on storage.objects for select to authenticated using(bucket_id='fin-family-private' and exists(select 1 from public.fin_documents d where d.path=storage.objects.name and fin_private.document_visible(d.id)));
create policy fin_file_insert on storage.objects for insert to authenticated with check(bucket_id='fin-family-private' and exists(select 1 from public.fin_documents d where d.path=storage.objects.name and fin_private.editable(d.home_id,d.owner_id,'documents')));
create policy fin_file_delete on storage.objects for delete to authenticated using(bucket_id='fin-family-private' and exists(select 1 from public.fin_documents d where d.path=storage.objects.name and fin_private.editable(d.home_id,d.owner_id,'documents')));
-- Atomic completion prevents duplicate expenses or stock from a repeated tap.
create function public.fin_complete_purchase(shopping_ids uuid[], total_cents bigint, purchase_date date, account uuid default null) returns uuid language plpgsql security invoker set search_path='' as $$
declare h uuid;e uuid;cnt int;
begin
 if total_cents<=0 or cardinality(shopping_ids)=0 then raise exception 'Invalid purchase';end if;
 select home_id into h from public.fin_shopping where id=shopping_ids[1] and not bought;
 if h is null or not fin_private.allowed(h,'shopping') or not fin_private.allowed(h,'pantry') or not fin_private.allowed(h,'entries') then raise exception 'Purchase permission required';end if;
 perform 1 from public.fin_shopping where id=any(shopping_ids) and home_id=h and not bought order by id for update;
 select count(*) into cnt from public.fin_shopping where id=any(shopping_ids) and home_id=h and not bought;
 if cnt!=cardinality(shopping_ids) then raise exception 'Shopping list changed; reload';end if;
 insert into public.fin_entries(home_id,owner_id,description,amount_cents,date,kind,category,area,status,payment,account_id,installments) values(h,auth.uid(),'Compra de mercado',total_cents,purchase_date,'expense','Mercado','household','paid','cash',account,1) returning id into e;
 update public.fin_pantry p set quantity=greatest(0,p.quantity-p.daily_use*greatest(0,extract(epoch from now()-p.updated_at)/86400))+s.quantity,updated_at=now() from (select pantry_id,sum(quantity) quantity from public.fin_shopping where id=any(shopping_ids) and home_id=h group by pantry_id) s where p.id=s.pantry_id and p.home_id=h;
 update public.fin_shopping set bought=true where id=any(shopping_ids) and home_id=h;
 return e;
end $$;
revoke all on function public.fin_complete_purchase(uuid[],bigint,date,uuid) from public,anon;
grant execute on function public.fin_complete_purchase(uuid[],bigint,date,uuid) to authenticated;

-- Payment permissions protect both old and new values, including deletion.
create function fin_private.guard_payment() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if (tg_op='DELETE' or tg_op='UPDATE') and old.kind in ('card_payment','debt_payment') and not fin_private.allowed(old.home_id,'payments') then raise exception 'Payment permission required';end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
revoke all on function fin_private.guard_payment() from public,anon,authenticated;
create trigger payment_permission before update or delete on public.fin_entries for each row execute function fin_private.guard_payment();
alter table public.fin_pantry add constraint fin_pantry_home_unique unique(home_id,id);
alter table public.fin_shopping drop constraint fin_shopping_pantry_id_fkey;
alter table public.fin_shopping add constraint fin_shopping_pantry_home_fk foreign key(home_id,pantry_id) references public.fin_pantry(home_id,id);
create function fin_private.guard_shared_identity() returns trigger language plpgsql security definer set search_path='' as $$ begin if new.id!=old.id or new.home_id!=old.home_id then raise exception 'Record identity is immutable';end if;return new;end $$;
revoke all on function fin_private.guard_shared_identity() from public,anon,authenticated;
create trigger identity before update on public.fin_pantry for each row execute function fin_private.guard_shared_identity();
create trigger identity before update on public.fin_shopping for each row execute function fin_private.guard_shared_identity();
-- Recurring bills become explicit pending entries; no background payments.
create table public.fin_recurring(id uuid primary key default gen_random_uuid(),home_id uuid not null references public.fin_homes(id),owner_id uuid not null references auth.users(id),shared boolean not null default false,name text not null check(length(name) between 1 and 160),amount_cents bigint not null check(amount_cents>0),category text not null check(length(category)<=80),area text not null check(area in ('household','personal','business')),day int not null check(day between 1 and 31),start_month text not null check(start_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),created_at timestamptz not null default now());
alter table public.fin_recurring enable row level security;
revoke all on public.fin_recurring from public,anon,authenticated;
grant select,insert,update,delete on public.fin_recurring to authenticated;
create policy visible on public.fin_recurring for select to authenticated using(fin_private.visible(home_id,owner_id,shared));
create policy add_own on public.fin_recurring for insert to authenticated with check(fin_private.editable(home_id,owner_id,'entries') and (not shared or fin_private.admin(home_id)));
create policy edit_own on public.fin_recurring for update to authenticated using(fin_private.editable(home_id,owner_id,'entries')) with check(fin_private.editable(home_id,owner_id,'entries'));
create policy remove_own on public.fin_recurring for delete to authenticated using(fin_private.editable(home_id,owner_id,'entries'));
create trigger identity before insert or update on public.fin_recurring for each row execute function fin_private.check_record();
create trigger sharing before update on public.fin_recurring for each row execute function fin_private.guard_sharing();
create trigger audit after insert or update or delete on public.fin_recurring for each row execute function fin_private.audit_record();
alter table public.fin_entries add column recurring_id uuid references public.fin_recurring(id);
alter table public.fin_entries add column recurring_month text;
create unique index fin_recurring_once on public.fin_entries(recurring_id,recurring_month) where recurring_id is not null;
create function public.fin_plan_month(h uuid,m text) returns int language plpgsql security invoker set search_path='' as $$
declare count_inserted int;begin
 if m !~ '^\d{4}-(0[1-9]|1[0-2])$' or not fin_private.allowed(h,'entries') then raise exception 'Invalid month or permission';end if;
 insert into public.fin_entries(home_id,owner_id,shared,description,amount_cents,date,due_date,kind,category,area,status,payment,recurring_id,recurring_month)
 select r.home_id,r.owner_id,case when fin_private.admin(h) then r.shared else false end,r.name,r.amount_cents,(m||'-01')::date + (least(r.day,extract(day from ((m||'-01')::date+interval '1 month - 1 day'))::int)-1),(m||'-01')::date + (least(r.day,extract(day from ((m||'-01')::date+interval '1 month - 1 day'))::int)-1),'expense',r.category,r.area,'pending','cash',r.id,m from public.fin_recurring r where r.home_id=h and r.start_month<=m and exists(select 1 from public.fin_members member where member.home_id=r.home_id and member.user_id=r.owner_id and member.active) and (r.owner_id=auth.uid() or fin_private.admin(h)) on conflict(recurring_id,recurring_month) where recurring_id is not null do nothing;
 get diagnostics count_inserted=row_count;return count_inserted;
end $$;
revoke all on function public.fin_plan_month(uuid,text) from public,anon;
grant execute on function public.fin_plan_month(uuid,text) to authenticated;
create function fin_private.guard_financial_links() returns trigger language plpgsql security definer set search_path='' as $$
declare principal bigint;paid bigint;
begin
 if new.recurring_id is not null and not exists(select 1 from public.fin_recurring r where r.id=new.recurring_id and r.home_id=new.home_id and r.owner_id=new.owner_id and (r.owner_id=auth.uid() or fin_private.admin(r.home_id))) then raise exception 'Recurrence unavailable';end if;
 if not fin_private.editable(new.home_id,new.owner_id,'entries') then raise exception 'Financial record unavailable';end if;
 if new.debt_id is not null and not exists(select 1 from public.fin_debts d where d.id=new.debt_id and d.home_id=new.home_id and (fin_private.admin(d.home_id) or (d.owner_id=new.owner_id and d.owner_id=auth.uid()))) then raise exception 'Debt unavailable';end if;
 if tg_op='UPDATE' and old.status!='paid' and new.status='paid' and not fin_private.allowed(old.home_id,'payments') then raise exception 'Payment permission required';end if;
 if new.kind='debt_payment' and new.status='paid' then
  select balance_cents into principal from public.fin_debts where id=new.debt_id and home_id=new.home_id for update;
  if principal is not null then
   select coalesce(sum(amount_cents),0) into paid from public.fin_entries where debt_id=new.debt_id and kind='debt_payment' and status='paid' and id!=new.id;
   if paid+new.amount_cents>principal then raise exception 'Payment exceeds remaining principal';end if;
  end if;
 end if;
 return new;
end $$;
revoke all on function fin_private.guard_financial_links() from public,anon,authenticated;
create trigger financial_links before insert or update on public.fin_entries for each row execute function fin_private.guard_financial_links();
