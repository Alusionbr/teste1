-- Preserve the schedule already shown for legacy purchases when a card's
-- closing day changes. Purchases already carrying a snapshot are untouched.
create function fin_private.freeze_card_invoice_starts() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.closing_day is distinct from old.closing_day then
    update public.fin_entries e
    set first_invoice_month = to_char(
      e.date + case
        when extract(day from e.date) > old.closing_day then interval '1 month'
        else interval '0 months'
      end,
      'YYYY-MM'
    )
    where e.card_id = old.id
      and e.kind = 'expense'
      and e.payment = 'card'
      and e.first_invoice_month is null;
  end if;
  return new;
end $$;
revoke all on function fin_private.freeze_card_invoice_starts() from public, anon, authenticated;
create trigger freeze_invoice_schedule_before_closing_edit
before update of closing_day on public.fin_cards
for each row execute function fin_private.freeze_card_invoice_starts();
