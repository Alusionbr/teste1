alter table public.estante_bug_reports alter column page_path set default '/teste1/estante/';

create index estante_bug_reports_created_at_idx on public.estante_bug_reports (created_at desc);
