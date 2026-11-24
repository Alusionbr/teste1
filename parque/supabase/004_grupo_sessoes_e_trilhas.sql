-- Repara a atualização 001 -> 002, separa presença de posição e torna trilhas idempotentes.
-- Reversão compatível: clientes antigos continuam usando a assinatura de duas entradas;
-- antes de reverter, remova apenas client_id/position_at e restaure as funções da 003.

alter table parque.membros add column if not exists position_at timestamptz;
alter table parque.trilhas add column if not exists client_id text;
create unique index if not exists trilhas_client_id_uq on parque.trilhas (client_id) where client_id is not null;

create or replace function public.parque_sync(
  p_group text, p_member text, p_name text, p_color text,
  p_lat double precision, p_lon double precision, p_acc real, p_heading real, p_status text
) returns json language plpgsql security definer set search_path = '' as $fn$
declare result json;
begin
  perform public.parque_valida(p_group, p_member);
  insert into parque.membros as m (group_code, member_id, name, color, lat, lon, acc, heading, status, active, updated_at, position_at)
  values (p_group,p_member,left(coalesce(p_name,''),24),left(coalesce(p_color,'#ff70a6'),9),p_lat,p_lon,p_acc,p_heading,left(coalesce(p_status,''),40),true,now(),case when p_lat is null then null else now() end)
  on conflict (group_code, member_id) do update set
    name=excluded.name,color=excluded.color,lat=coalesce(excluded.lat,m.lat),lon=coalesce(excluded.lon,m.lon),
    acc=coalesce(excluded.acc,m.acc),heading=excluded.heading,status=excluded.status,active=true,updated_at=now(),
    position_at=case when excluded.lat is null then m.position_at else now() end;
  select json_build_object('now',now(),'members',coalesce((select json_agg(json_build_object(
    'member_id',member_id,'name',name,'color',color,'lat',lat,'lon',lon,'acc',acc,'heading',heading,
    'status',status,'updated_at',updated_at,'position_at',position_at) order by name)
    from parque.membros where group_code=p_group and active and updated_at>now()-interval '3 hours'),'[]'::json),
    'pins',coalesce((select json_agg(json_build_object('pin_id',pin_id,'kind',kind,'name',name,'lat',lat,'lon',lon,
    'by_name',by_name,'updated_at',updated_at) order by updated_at) from parque.pinos
    where group_code=p_group and not removed and updated_at>now()-interval '24 hours'),'[]'::json)) into result;
  return result;
end $fn$;

create or replace function public.parque_pin_set(p_group text,p_pin text,p_kind text,p_name text,p_lat double precision,p_lon double precision,p_by text)
returns void language plpgsql security definer set search_path='' as $fn$
begin
  perform public.parque_valida(p_group,p_pin);
  if (select count(*) from parque.pinos where group_code=p_group and not removed)>=40 and not exists(select 1 from parque.pinos where group_code=p_group and pin_id=p_pin) then raise exception 'limite de pinos do grupo'; end if;
  insert into parque.pinos(group_code,pin_id,kind,name,lat,lon,by_name,removed,updated_at) values(p_group,p_pin,left(coalesce(p_kind,'lugar'),12),left(coalesce(p_name,''),40),p_lat,p_lon,left(coalesce(p_by,''),24),false,now())
  on conflict(group_code,pin_id) do update set kind=excluded.kind,name=excluded.name,lat=excluded.lat,lon=excluded.lon,by_name=excluded.by_name,removed=false,updated_at=now();
end $fn$;

create or replace function public.parque_pin_del(p_group text,p_pin text) returns void language plpgsql security definer set search_path='' as $fn$
begin perform public.parque_valida(p_group,p_pin); update parque.pinos set removed=true,updated_at=now() where group_code=p_group and pin_id=p_pin; end $fn$;
create or replace function public.parque_sair(p_group text,p_member text) returns void language plpgsql security definer set search_path='' as $fn$
begin perform public.parque_valida(p_group,p_member); update parque.membros set active=false,updated_at=now() where group_code=p_group and member_id=p_member; end $fn$;

create or replace function public.parque_trilha_add(p_device text,p_pts jsonb,p_client_id text)
returns void language plpgsql security definer set search_path='' as $fn$
declare n int; fora int;
begin
  if p_device is null or p_device !~ '^[a-zA-Z0-9-]{4,40}$' then raise exception 'aparelho invalido'; end if;
  if p_client_id is not null and p_client_id !~ '^[a-zA-Z0-9-]{4,80}$' then raise exception 'id invalido'; end if;
  if jsonb_typeof(p_pts)<>'array' then raise exception 'pontos invalidos'; end if;
  n:=jsonb_array_length(p_pts); if n<2 or n>400 then raise exception 'quantidade de pontos invalida'; end if;
  select count(*) into fora from jsonb_array_elements(p_pts) e where jsonb_typeof(e)<>'array' or jsonb_array_length(e)<>2 or (e->>0)::double precision not between -26.8140 and -26.7950 or (e->>1)::double precision not between -48.6290 and -48.6060;
  if fora>0 then raise exception 'ponto fora do parque'; end if;
  if (select count(*) from parque.trilhas where device_id=p_device and created_at>now()-interval '1 day')>=600 then raise exception 'limite diario'; end if;
  insert into parque.trilhas(device_id,pts,client_id) values(p_device,p_pts,p_client_id) on conflict(client_id) where client_id is not null do nothing;
end $fn$;
create or replace function public.parque_trilha_add(p_device text,p_pts jsonb)
returns void language sql security definer set search_path='' as $fn$
  select public.parque_trilha_add(p_device,p_pts,null);
$fn$;
revoke all on function public.parque_trilha_add(text,jsonb,text) from public;
revoke all on function public.parque_trilha_add(text,jsonb) from public;
grant execute on function public.parque_trilha_add(text,jsonb,text) to anon,authenticated;
grant execute on function public.parque_trilha_add(text,jsonb) to anon,authenticated;
