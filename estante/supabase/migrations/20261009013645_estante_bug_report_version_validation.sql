alter table public.estante_bug_reports
  drop constraint estante_bug_reports_app_version_check;

alter table public.estante_bug_reports
  add constraint estante_bug_reports_app_version_check
  check (
    char_length(app_version) <= 24
    and app_version ~ '^[0-9]+[.][0-9]+[.][0-9]+$'
  );
