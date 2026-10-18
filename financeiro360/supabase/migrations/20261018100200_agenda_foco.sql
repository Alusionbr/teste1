-- Agenda da casa, ferramentas de foco e compra do mercado no cartão.
-- Aditiva: não altera lançamentos, faturas nem objetos de outros aplicativos.
-- Depende de 20261018100000_household_routine.sql (fin_tasks e fin_complete_task).

-- 1. Agenda. Compromisso pessoal ("private" ou "busy") só é lido pelo próprio dono:
--    nem o administrador vê. "home" é visto por todos os membros ativos da casa.
--    Sem trigger de auditoria, para que o histórico do administrador não revele compromissos pessoais.
create table public.fin_events(
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references public.fin_homes(id),
  owner_id uuid not null references auth.users(id),
  title text not null check(length(btrim(title)) between 1 and 120),
  notes text not null default '' check(length(notes)<=500),
  day date not null,
  start_time time,
  end_time time,
  place text not null default '' check(length(place)<=120),
  visibility text not null default 'private' check(visibility in ('private','busy','home')),
  people uuid[] not null default '{}' check(cardinality(people)<=20),
  repeat text not null default 'none' check(repeat in ('none','daily','weekly','monthly','yearly')),
  repeat_until date,
  remind_minutes int check(remind_minutes between 0 and 10080),
  created_at timestamptz not null default now(),
  check(end_time is null or (start_time is not null and end_time>start_time)),
  check(repeat_until is null or (repeat<>'none' and repeat_until>=day))
);
create index on public.fin_events(home_id,day);
alter table public.fin_events enable row level security;
revoke all on public.fin_events from public,anon,authenticated;
grant select,insert,update,delete on public.fin_events to authenticated;
create policy owner_or_home_read on public.fin_events for select to authenticated
  using(fin_private.member(home_id) and (owner_id=(select auth.uid()) or visibility='home'));
create policy owner_add on public.fin_events for insert to authenticated
  with check(fin_private.member(home_id) and owner_id=(select auth.uid()));
create policy owner_edit on public.fin_events for update to authenticated
  using(fin_private.member(home_id) and owner_id=(select auth.uid()))
  with check(fin_private.member(home_id) and owner_id=(select auth.uid()));
create policy owner_remove on public.fin_events for delete to authenticated
  using(fin_private.member(home_id) and owner_id=(select auth.uid()));

create function fin_private.guard_event() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='UPDATE' and (new.id!=old.id or new.home_id!=old.home_id or new.owner_id!=old.owner_id) then
    raise exception 'Record identity is immutable';
  end if;
  -- Participantes só fazem sentido em compromisso da casa; em pessoal seriam um vazamento.
  if new.visibility<>'home' then new.people:='{}'; end if;
  if exists(select 1 from unnest(new.people) p where not exists(
      select 1 from public.fin_members m where m.home_id=new.home_id and m.user_id=p and m.active)) then
    raise exception 'Invalid participant';
  end if;
  return new;
end $$;
revoke all on function fin_private.guard_event() from public,anon,authenticated;
create trigger identity before insert or update on public.fin_events for each row execute function fin_private.guard_event();

-- Horários "ocupado" dos outros membros: só dono e horário, nunca título, local ou notas.
create function public.fin_busy_slots(h uuid) returns table(id uuid, owner_id uuid, day date, start_time time, end_time time, repeat text, repeat_until date)
language sql stable security definer set search_path='' as $$
  select e.id,e.owner_id,e.day,e.start_time,e.end_time,e.repeat,e.repeat_until
  from public.fin_events e
  where e.home_id=h and e.visibility='busy' and fin_private.member(h) and e.owner_id<>(select auth.uid())
    and exists(select 1 from public.fin_members m where m.home_id=h and m.user_id=e.owner_id and m.active)
$$;
revoke all on function public.fin_busy_slots(uuid) from public,anon;
grant execute on function public.fin_busy_slots(uuid) to authenticated;

-- 2. Caixa de entrada: anotação rápida e privada do dono, para organizar depois.
create table public.fin_inbox(
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references public.fin_homes(id),
  owner_id uuid not null references auth.users(id),
  text text not null check(length(btrim(text)) between 1 and 280),
  created_at timestamptz not null default now(),
  done_at timestamptz
);
create index on public.fin_inbox(home_id,owner_id);
alter table public.fin_inbox enable row level security;
revoke all on public.fin_inbox from public,anon,authenticated;
grant select,insert,update,delete on public.fin_inbox to authenticated;
create policy owner_only on public.fin_inbox for all to authenticated
  using(fin_private.member(home_id) and owner_id=(select auth.uid()))
  with check(fin_private.member(home_id) and owner_id=(select auth.uid()));

-- 3. Lista de desejos com espera antes de comprar. Privada, a menos que o dono compartilhe com a casa.
create table public.fin_wishes(
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references public.fin_homes(id),
  owner_id uuid not null references auth.users(id),
  name text not null check(length(btrim(name)) between 1 and 120),
  price_cents bigint not null default 0 check(price_cents between 0 and 9007199254740991),
  link text not null default '' check(length(link)<=300 and (link='' or link ~ '^https?://')),
  wait_until date not null,
  decision text check(decision in ('bought','gave_up')),
  decided_at timestamptz,
  shared boolean not null default false,
  created_at timestamptz not null default now(),
  check((decision is null)=(decided_at is null))
);
create index on public.fin_wishes(home_id,owner_id);
alter table public.fin_wishes enable row level security;
revoke all on public.fin_wishes from public,anon,authenticated;
grant select,insert,update,delete on public.fin_wishes to authenticated;
create policy owner_or_shared_read on public.fin_wishes for select to authenticated
  using(fin_private.member(home_id) and (owner_id=(select auth.uid()) or shared));
create policy owner_write on public.fin_wishes for insert to authenticated
  with check(fin_private.member(home_id) and owner_id=(select auth.uid()));
create policy owner_edit on public.fin_wishes for update to authenticated
  using(fin_private.member(home_id) and owner_id=(select auth.uid()))
  with check(fin_private.member(home_id) and owner_id=(select auth.uid()));
create policy owner_remove on public.fin_wishes for delete to authenticated
  using(fin_private.member(home_id) and owner_id=(select auth.uid()));
create function fin_private.guard_owner_identity() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.id!=old.id or new.home_id!=old.home_id or new.owner_id!=old.owner_id then raise exception 'Record identity is immutable'; end if;
  return new;
end $$;
revoke all on function fin_private.guard_owner_identity() from public,anon,authenticated;
create trigger identity before update on public.fin_inbox for each row execute function fin_private.guard_owner_identity();
create trigger identity before update on public.fin_wishes for each row execute function fin_private.guard_owner_identity();

-- 4. Passos dentro da tarefa (até 20). Ao repetir, a próxima vez começa com todos desmarcados.
create function fin_private.valid_steps(s jsonb) returns boolean language sql immutable set search_path='' as $$
  select jsonb_typeof(s)='array' and jsonb_array_length(s)<=20 and not exists(
    select 1 from jsonb_array_elements(s) x
    where jsonb_typeof(x)<>'object' or jsonb_typeof(x->'text')<>'string' or length(x->>'text') not between 1 and 120
      or jsonb_typeof(x->'done')<>'boolean')
$$;
revoke all on function fin_private.valid_steps(jsonb) from public,anon;
grant execute on function fin_private.valid_steps(jsonb) to authenticated;
alter table public.fin_tasks add column steps jsonb not null default '[]'::jsonb check(fin_private.valid_steps(steps));

create or replace function public.fin_complete_task(task uuid, done_on date) returns uuid
language plpgsql security invoker set search_path='' as $$
declare t public.fin_tasks; next_id uuid;
begin
  if done_on is null then raise exception 'Completion date required'; end if;
  select * into t from public.fin_tasks where id=task for update;
  if t.id is null or not fin_private.member(t.home_id) then raise exception 'Task unavailable'; end if;
  if t.done_at is null then update public.fin_tasks set done_at=now(),done_by=auth.uid() where id=t.id; end if;
  if t.repeat='none' then return null; end if;
  insert into public.fin_tasks(home_id,title,notes,kind,assignee_id,due_date,repeat,previous_id,created_by,steps)
  values(t.home_id,t.title,t.notes,t.kind,
    case when exists(select 1 from public.fin_members m where m.home_id=t.home_id and m.user_id=t.assignee_id and m.active) then t.assignee_id end,
    fin_private.next_due(t.repeat,done_on),t.repeat,t.id,auth.uid(),
    (select coalesce(jsonb_agg(jsonb_build_object('text',x->>'text','done',false)),'[]'::jsonb) from jsonb_array_elements(t.steps) x))
  on conflict(previous_id) do nothing returning id into next_id;
  return next_id;
end $$;

-- 5. Modo foco: preferência pessoal, como as demais de aparência.
alter table public.fin_preferences add column focus_mode boolean not null default false;
grant insert(focus_mode),update(focus_mode) on public.fin_preferences to authenticated;

-- 6. Compra do modo mercado paga no cartão, à vista ou parcelada. Mesmas garantias da compra à vista:
--    tudo na mesma transação, e repetir o toque falha porque os itens já foram comprados.
create function public.fin_complete_purchase_card(shopping_ids uuid[], total_cents bigint, purchase_date date, card uuid, parts int default 1)
returns uuid language plpgsql security invoker set search_path='' as $$
declare h uuid;e uuid;cnt int;
begin
  if total_cents<=0 or cardinality(shopping_ids)=0 or card is null or parts is null or parts not between 1 and 48 then
    raise exception 'Invalid purchase';
  end if;
  select home_id into h from public.fin_shopping where id=shopping_ids[1] and not bought;
  if h is null or not fin_private.allowed(h,'shopping') or not fin_private.allowed(h,'pantry') or not fin_private.allowed(h,'entries') then
    raise exception 'Purchase permission required';
  end if;
  perform 1 from public.fin_shopping where id=any(shopping_ids) and home_id=h and not bought order by id for update;
  select count(*) into cnt from public.fin_shopping where id=any(shopping_ids) and home_id=h and not bought;
  if cnt!=cardinality(shopping_ids) then raise exception 'Shopping list changed; reload'; end if;
  -- O cartão é conferido pela trigger de lançamentos: precisa ser da pessoa (ou ela ser administradora).
  insert into public.fin_entries(home_id,owner_id,description,amount_cents,date,kind,category,area,status,payment,card_id,installments)
  values(h,auth.uid(),'Compra de mercado',total_cents,purchase_date,'expense','Mercado','household','paid','card',card,parts)
  returning id into e;
  update public.fin_pantry p set quantity=greatest(0,p.quantity-p.daily_use*greatest(0,extract(epoch from now()-p.updated_at)/86400))+s.quantity,updated_at=now()
  from (select pantry_id,sum(quantity) quantity from public.fin_shopping where id=any(shopping_ids) and home_id=h group by pantry_id) s
  where p.id=s.pantry_id and p.home_id=h;
  update public.fin_shopping set bought=true where id=any(shopping_ids) and home_id=h;
  return e;
end $$;
revoke all on function public.fin_complete_purchase_card(uuid[],bigint,date,uuid,int) from public,anon;
grant execute on function public.fin_complete_purchase_card(uuid[],bigint,date,uuid,int) to authenticated;
