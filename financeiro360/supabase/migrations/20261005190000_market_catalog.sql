-- Catálogo de mercado da casa: itens criados pela família, produtos escolhidos das bases abertas e ofertas de encarte.
-- Aditiva: não altera lançamentos, lista de compras, despensa nem objetos de outros aplicativos.
-- O catálogo de itens comuns (sem preço) vem pronto no aplicativo e não usa o banco.
create table public.fin_catalog(
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references public.fin_homes(id),
  name text not null check(length(btrim(name)) between 1 and 120),
  brand text not null default '' check(length(brand)<=60),
  size text not null default '' check(length(size)<=40),
  unit text not null default 'unidade' check(length(unit) between 1 and 20),
  category text not null default 'mercearia'
    check(category in ('mercearia','cafe','laticinios','carnes','hortifruti','padaria','bebidas','limpeza','higiene','casa')),
  store text not null default '' check(length(store)<=40),
  price_cents bigint check(price_cents is null or (price_cents>=0 and price_cents<=9007199254740991)),
  offer_until date,
  -- Produtos vindos das bases abertas (Open Food Facts e irmãs) guardam o código de barras,
  -- que permite atualizar nome, marca e tamanho pela API. 'flyer' = oferta colada de encarte.
  barcode text not null default '' check(barcode='' or barcode ~ '^\d{8,14}$'),
  source text not null default 'manual' check(source in ('manual','flyer','off')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  check(offer_until is null or price_cents is not null)
);
create index on public.fin_catalog(home_id,offer_until);
create unique index fin_catalog_barcode_once on public.fin_catalog(home_id,barcode) where barcode<>'';
alter table public.fin_catalog enable row level security;
revoke all on public.fin_catalog from public,anon,authenticated;
grant select,insert,update,delete on public.fin_catalog to authenticated;
-- Toda a casa lê; quem pode organizar compras cria, edita e remove (mesma permissão da lista).
create policy household_read on public.fin_catalog for select to authenticated using(fin_private.member(home_id));
create policy household_add on public.fin_catalog for insert to authenticated
  with check(fin_private.allowed(home_id,'shopping') and created_by=(select auth.uid()));
create policy household_edit on public.fin_catalog for update to authenticated
  using(fin_private.allowed(home_id,'shopping')) with check(fin_private.allowed(home_id,'shopping'));
create policy household_remove on public.fin_catalog for delete to authenticated
  using(fin_private.allowed(home_id,'shopping'));
create function fin_private.guard_catalog() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.id!=old.id or new.home_id!=old.home_id or new.created_by!=old.created_by then
    raise exception 'Record identity is immutable';
  end if;
  return new;
end $$;
revoke all on function fin_private.guard_catalog() from public,anon,authenticated;
create trigger identity before update on public.fin_catalog for each row execute function fin_private.guard_catalog();
