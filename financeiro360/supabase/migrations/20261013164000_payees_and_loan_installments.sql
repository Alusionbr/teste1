-- Optional expense destination and explicit loan installment matching.
alter table public.fin_entries add column if not exists payee text check (length(payee) <= 160);
alter table public.fin_entries add column if not exists debt_installment_number integer check (debt_installment_number between 1 and 360);

create function fin_private.check_debt_installment() returns trigger language plpgsql security definer set search_path='' as $$
declare planned integer;
begin
 if new.debt_installment_number is not null then
  if new.kind <> 'debt_payment' or new.debt_id is null then
   raise exception 'An installment requires a debt payment';
  end if;
  select installment_count into planned from public.fin_debts
   where id=new.debt_id and home_id=new.home_id;
  if planned is null or new.debt_installment_number > planned then
   raise exception 'Installment is outside the debt schedule';
  end if;
 end if;
 return new;
end $$;
revoke all on function fin_private.check_debt_installment() from public,anon,authenticated;
create trigger debt_installment_guard before insert or update of kind,debt_id,debt_installment_number on public.fin_entries
 for each row execute function fin_private.check_debt_installment();

create function fin_private.check_debt_schedule() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.fin_entries where debt_id=new.id and debt_installment_number is not null
  and (new.installment_count is null or debt_installment_number > new.installment_count)) then
  raise exception 'Existing payments refer to an installment outside this schedule';
 end if;
 return new;
end $$;
revoke all on function fin_private.check_debt_schedule() from public,anon,authenticated;
create trigger debt_schedule_guard before update of installment_count on public.fin_debts
 for each row execute function fin_private.check_debt_schedule();
