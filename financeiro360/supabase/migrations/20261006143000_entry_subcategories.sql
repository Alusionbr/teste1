-- Optional secondary labels let families classify detailed expense types without
-- creating a separate top-level category for every recurring item.
alter table public.fin_entries
  add column if not exists subcategory text
  check (subcategory is null or length(subcategory) <= 80);
