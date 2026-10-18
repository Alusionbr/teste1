-- Casa: locais da despensa, histórico de saídas (uso, perda, contagem) e rotina doméstica.
-- Aditiva: não altera lançamentos, faturas, preferências nem objetos de outros aplicativos.

-- 1. Local onde cada produto fica guardado. Registros existentes passam a "cozinha".
alter table public.fin_pantry add column location text not null default 'kitchen'
  check(location in ('kitchen','fridge','freezer','cleaning','hygiene','other'));

-- 2. Histórico de movimentos da despensa. Só é escrito pela função fin_pantry_move,
--    que atualiza o estoque e o histórico na mesma transação.
create table public.fin_pantry_events(
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references public.fin_homes(id),
  pantry_id uuid references public.fin_pantry(id) on delete set null,
  name text not null check(length(name) between 1 and 151),
  kind text not null check(kind in ('used','lost','finished','counted')),
  quantity numeric not null check(quantity>=0),
  value_cents bigint not null default 0 check(value_cents>=0),
  actor_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create index on public.fin_pantry_events(home_id,created_at);
alter table public.fin_pantry_events enable row level security;
revoke all on public.fin_pantry_events from public,anon,authenticated;
grant select,insert on public.fin_pantry_events to authenticated;
create policy household_read on public.fin_pantry_events for select to authenticated using(fin_private.member(home_id));
create policy household_add on public.fin_pantry_events for insert to authenticated
  with check(fin_private.allowed(home_id,'pantry') and actor_id=(select auth.uid()));

-- Saída ou contagem atômica. A quantidade estimada segue a mesma regra da tela:
-- quantidade contada menos o consumo diário pelos dias inteiros desde a contagem.
create function public.fin_pantry_move(item uuid, move text, amount numeric) returns numeric
language plpgsql security invoker set search_path='' as $$
declare p public.fin_pantry; estimated numeric; next_qty numeric; moved numeric;
begin
  if move not in ('used','lost','finished','counted') or amount is null or amount<0 or amount>1000000 then
    raise exception 'Invalid pantry movement';
  end if;
  select * into p from public.fin_pantry where id=item for update;
  if p.id is null or not fin_private.allowed(p.home_id,'pantry') then raise exception 'Pantry permission required'; end if;
  estimated:=greatest(0,p.quantity-p.daily_use*greatest(0,floor(extract(epoch from now()-p.updated_at)/86400)));
  if move='counted' then next_qty:=amount; moved:=amount;
  elsif move='finished' then next_qty:=0; moved:=estimated;
  else
    if amount<=0 then raise exception 'Invalid pantry movement'; end if;
    moved:=least(amount,estimated); next_qty:=estimated-moved;
  end if;
  update public.fin_pantry set quantity=next_qty,updated_at=now() where id=p.id;
  insert into public.fin_pantry_events(home_id,pantry_id,name,kind,quantity,value_cents,actor_id)
  values(p.home_id,p.id,p.name,move,moved,case when move='lost' then round(moved*p.price_cents)::bigint else 0 end,auth.uid());
  return next_qty;
end $$;
revoke all on function public.fin_pantry_move(uuid,text,numeric) from public,anon;
grant execute on function public.fin_pantry_move(uuid,text,numeric) to authenticated;

-- 3. Rotina doméstica: compartilhada com todos os membros ativos da casa.
create table public.fin_tasks(
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references public.fin_homes(id),
  title text not null check(length(btrim(title)) between 1 and 120),
  notes text not null default '' check(length(notes)<=500),
  kind text not null default 'other' check(kind in ('cleaning','laundry','kitchen','maintenance','shopping','other')),
  assignee_id uuid references auth.users(id),
  due_date date,
  repeat text not null default 'none' check(repeat in ('none','daily','weekly','biweekly','monthly')),
  done_at timestamptz,
  done_by uuid references auth.users(id),
  previous_id uuid unique references public.fin_tasks(id) on delete set null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  check((done_at is null)=(done_by is null))
);
create index on public.fin_tasks(home_id,due_date);
alter table public.fin_tasks enable row level security;
revoke all on public.fin_tasks from public,anon,authenticated;
grant select,insert,update,delete on public.fin_tasks to authenticated;
create policy household_read on public.fin_tasks for select to authenticated using(fin_private.member(home_id));
create policy household_add on public.fin_tasks for insert to authenticated
  with check(fin_private.member(home_id) and created_by=(select auth.uid()));
create policy household_edit on public.fin_tasks for update to authenticated
  using(fin_private.member(home_id)) with check(fin_private.member(home_id));
create policy creator_or_admin_remove on public.fin_tasks for delete to authenticated
  using(fin_private.admin(home_id) or (fin_private.member(home_id) and created_by=(select auth.uid())));

create function fin_private.guard_task() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='UPDATE' and (new.id!=old.id or new.home_id!=old.home_id or new.created_by!=old.created_by) then
    raise exception 'Record identity is immutable';
  end if;
  -- Só valida quando o responsável é definido ou trocado: suspender alguém não trava as tarefas antigas.
  if new.assignee_id is not null and (tg_op='INSERT' or new.assignee_id is distinct from old.assignee_id) and not exists(select 1 from public.fin_members m where m.home_id=new.home_id and m.user_id=new.assignee_id and m.active) then
    raise exception 'Invalid assignee';
  end if;
  if new.done_at is not null and (tg_op='INSERT' or old.done_at is null) and new.done_by is distinct from auth.uid() then
    raise exception 'Completion must be recorded by the signed-in member';
  end if;
  return new;
end $$;
revoke all on function fin_private.guard_task() from public,anon,authenticated;
create trigger identity before insert or update on public.fin_tasks for each row execute function fin_private.guard_task();
create trigger audit after insert or update or delete on public.fin_tasks for each row execute function fin_private.audit_record();

-- Próxima data: contada a partir do dia em que a tarefa foi feita.
create function fin_private.next_due(rule text, base date) returns date language sql immutable set search_path='' as $$
  select case rule when 'daily' then base+1 when 'weekly' then base+7 when 'biweekly' then base+14
    when 'monthly' then (base+interval '1 month')::date end
$$;
revoke all on function fin_private.next_due(text,date) from public,anon;
grant execute on function fin_private.next_due(text,date) to authenticated;

-- Concluir é idempotente: repetir o toque não duplica a próxima ocorrência (previous_id é único).
create function public.fin_complete_task(task uuid, done_on date) returns uuid
language plpgsql security invoker set search_path='' as $$
declare t public.fin_tasks; next_id uuid;
begin
  if done_on is null then raise exception 'Completion date required'; end if;
  select * into t from public.fin_tasks where id=task for update;
  if t.id is null or not fin_private.member(t.home_id) then raise exception 'Task unavailable'; end if;
  if t.done_at is null then update public.fin_tasks set done_at=now(),done_by=auth.uid() where id=t.id; end if;
  if t.repeat='none' then return null; end if;
  insert into public.fin_tasks(home_id,title,notes,kind,assignee_id,due_date,repeat,previous_id,created_by)
  values(t.home_id,t.title,t.notes,t.kind,
    case when exists(select 1 from public.fin_members m where m.home_id=t.home_id and m.user_id=t.assignee_id and m.active) then t.assignee_id end,
    fin_private.next_due(t.repeat,done_on),t.repeat,t.id,auth.uid())
  on conflict(previous_id) do nothing returning id into next_id;
  return next_id;
end $$;
revoke all on function public.fin_complete_task(uuid,date) from public,anon;
grant execute on function public.fin_complete_task(uuid,date) to authenticated;
