-- Apply after the account overview frontend is live. Keep account labels readable
-- for existing RLS checks, while requiring the overview RPC for sensitive totals.
revoke select on public.fin_accounts from authenticated;
grant select (id, home_id, owner_id, shared, name, area, created_at, share_balance)
  on public.fin_accounts to authenticated;
