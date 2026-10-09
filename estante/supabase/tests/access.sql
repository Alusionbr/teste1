begin;
select set_config('estante.test_a',gen_random_uuid()::text,true), set_config('estante.test_b',gen_random_uuid()::text,true);
insert into auth.users(id,email,aud,role,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
select current_setting('estante.test_a')::uuid,'estante-a-'||current_setting('estante.test_a')||'@example.invalid','authenticated','authenticated',now(),'{"provider":"email"}'::jsonb,'{}'::jsonb
union all select current_setting('estante.test_b')::uuid,'estante-b-'||current_setting('estante.test_b')||'@example.invalid','authenticated','authenticated',now(),'{"provider":"email"}'::jsonb,'{}'::jsonb;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('estante.test_a'),'role','authenticated')::text,true);
set local role authenticated;
do $$ declare n integer; begin
  perform public.estante_save_workspace('{"version":4,"setlists":[],"library":[]}',0);
  select count(*) into n from public.estante_workspaces;
  if n<>1 then raise exception 'Owner cannot read own workspace';end if;
  perform public.estante_save_workspace('{"version":4,"setlists":[],"library":[]}',1);
  begin perform public.estante_save_workspace('{"version":4,"setlists":[],"library":[]}',1);
    raise exception 'Stale revision accepted';exception when serialization_failure then null;end;
  begin update public.estante_workspaces set user_id=current_setting('estante.test_b')::uuid;
    raise exception 'Ownership change allowed';exception when insufficient_privilege then null;end;
  begin insert into public.estante_admins values(current_setting('estante.test_a')::uuid);
    raise exception 'Self promotion allowed';exception when insufficient_privilege then null;end;
  select count(*) into n from public.estante_usage_counts;
  if n<>0 then raise exception 'Non-admin can read activity';end if;
end $$;
reset role;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('estante.test_b'),'role','authenticated')::text,true);
set local role authenticated;
do $$ declare n integer;begin
  select count(*) into n from public.estante_workspaces;
  if n<>0 then raise exception 'Cross-user workspace leak';end if;
  update public.estante_workspaces set payload='{"version":4,"setlists":[],"library":[]}' where user_id=current_setting('estante.test_a')::uuid;
  get diagnostics n=row_count;if n<>0 then raise exception 'Cross-user write';end if;
  begin insert into public.estante_workspaces(user_id,payload) values(current_setting('estante.test_a')::uuid,'{"version":4,"setlists":[],"library":[]}');
    raise exception 'Cross-user insert';exception when insufficient_privilege then null;end;
  begin perform public.estante_save_workspace('{"version":4}',0);
    raise exception 'Malformed payload accepted';exception when check_violation then null;end;
  begin perform public.estante_record_aggregate('results','4.1.0',null);
    raise exception 'Public telemetry RPC exposed';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claims','{}',true);
set local role anon;
do $$ begin
  begin perform * from public.estante_workspaces;raise exception 'Anon can read workspaces';exception when insufficient_privilege then null;end;
  begin perform * from public.estante_usage_counts;raise exception 'Anon can read usage';exception when insufficient_privilege then null;end;
  begin perform * from public.estante_admins;raise exception 'Anon can read admins';exception when insufficient_privilege then null;end;
end $$;
reset role;
-- Admin activity access does not confer access to personal repertoires.
insert into public.estante_admins values(current_setting('estante.test_b')::uuid);
select public.estante_record_aggregate('results','4.1.0',null);
select public.estante_record_aggregate('results','4.1.0','app_error');
select set_config('request.jwt.claims',json_build_object('sub',current_setting('estante.test_b'),'role','authenticated')::text,true);
set local role authenticated;
do $$ declare n integer;begin
  select count(*) into n from public.estante_usage_counts;if n<1 then raise exception 'Admin cannot read usage';end if;
  select count(*) into n from public.estante_usage_summary();if n<1 then raise exception 'Admin cannot read summary';end if;
  select count(*) into n from public.estante_error_counts;if n<1 then raise exception 'Admin cannot read errors';end if;
  select count(*) into n from public.estante_workspaces;if n<>0 then raise exception 'Admin can read others repertoire';end if;
end $$;
reset role;
rollback;
select 'PASS: owner isolation, concurrent revision, malformed payload, admin escalation, guest grants, telemetry restrictions, admin privacy; transaction rolled back' as result;
