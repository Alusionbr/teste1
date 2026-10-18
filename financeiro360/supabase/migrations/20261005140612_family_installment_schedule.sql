-- Store the first invoice for new card purchases without rewriting historical entries.
alter table public.fin_entries
  add column first_invoice_month text
  check (first_invoice_month is null or first_invoice_month ~ '^\d{4}-(0[1-9]|1[0-2])$');

create function fin_private.set_invoice_start() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare closing integer;
begin
  if new.kind <> 'expense' or new.payment <> 'card' then
    new.first_invoice_month := null;
    return new;
  end if;

  select c.closing_day into closing
  from public.fin_cards c
  where c.id = new.card_id and c.home_id = new.home_id;
  if closing is null then raise exception 'Card unavailable'; end if;

  if new.first_invoice_month is null or
     (tg_op = 'UPDATE' and (new.date is distinct from old.date or new.card_id is distinct from old.card_id)
       and new.first_invoice_month is not distinct from old.first_invoice_month) then
    new.first_invoice_month := to_char(
      new.date + case when extract(day from new.date) > closing then interval '1 month' else interval '0 months' end,
      'YYYY-MM'
    );
  end if;
  if new.first_invoice_month < to_char(new.date, 'YYYY-MM') then
    raise exception 'First invoice precedes purchase';
  end if;
  return new;
end $$;
revoke all on function fin_private.set_invoice_start() from public, anon, authenticated;
create trigger invoice_start before insert or update of kind, payment, date, card_id, first_invoice_month
on public.fin_entries for each row execute function fin_private.set_invoice_start();
