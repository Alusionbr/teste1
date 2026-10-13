-- Reusable categories and subcategories. Existing entry labels stay unchanged.
create table public.fin_category_presets (
 id uuid primary key default gen_random_uuid(),
 home_id uuid not null references public.fin_homes(id),
 owner_id uuid not null references auth.users(id),
 shared boolean not null default false,
 category text not null check(length(btrim(category)) between 1 and 80),
 subcategory text check(subcategory is null or length(btrim(subcategory)) between 1 and 80),
 created_at timestamptz not null default now()
);
create unique index fin_category_preset_unique on public.fin_category_presets
 (home_id,owner_id,lower(btrim(category)),lower(coalesce(btrim(subcategory),'')));
create index fin_category_preset_home on public.fin_category_presets(home_id,owner_id);
alter table public.fin_category_presets enable row level security;
revoke all on public.fin_category_presets from public,anon,authenticated;
grant select,insert,update,delete on public.fin_category_presets to authenticated;
create policy category_preset_read on public.fin_category_presets for select to authenticated
 using(fin_private.member(home_id) and (owner_id=auth.uid() or shared));
create policy category_preset_add on public.fin_category_presets for insert to authenticated
 with check(fin_private.editable(home_id,owner_id,'entries')
  and owner_id=auth.uid()
  and (not shared or fin_private.admin(home_id)));
create policy category_preset_edit on public.fin_category_presets for update to authenticated
 using(owner_id=auth.uid() and fin_private.editable(home_id,owner_id,'entries'))
 with check(owner_id=auth.uid() and fin_private.editable(home_id,owner_id,'entries'));
create policy category_preset_remove on public.fin_category_presets for delete to authenticated
 using(owner_id=auth.uid() and fin_private.editable(home_id,owner_id,'entries'));
create trigger category_preset_identity before insert or update on public.fin_category_presets
 for each row execute function fin_private.check_record();
create trigger category_preset_sharing before update on public.fin_category_presets
 for each row execute function fin_private.guard_sharing();
create trigger category_preset_audit after insert or update or delete on public.fin_category_presets
 for each row execute function fin_private.audit_record();
