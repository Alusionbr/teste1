import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
const A='00000000-0000-4000-8000-000000000001', B='00000000-0000-4000-8000-000000000002', C='00000000-0000-4000-8000-000000000003',
  H='00000000-0000-4000-8000-000000000004', H2='00000000-0000-4000-8000-000000000005',
  P='00000000-0000-4000-8000-000000000006', S1='00000000-0000-4000-8000-000000000007', S2='00000000-0000-4000-8000-000000000008',
  CA='00000000-0000-4000-8000-000000000009', CB='00000000-0000-4000-8000-000000000010', T='00000000-0000-4000-8000-000000000011';
test('agenda, focus tools and card purchase keep personal data private and purchases atomic', async t => {
  const db=new PGlite(); t.after(()=>db.close());
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select,insert,delete on storage.objects to authenticated;`);
  for (const file of ['20261004024051_family_app.sql','20261005055306_family_preferences.sql','20261005180000_household_routine.sql','20261017120000_agenda_foco.sql'])
    await db.exec(readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
  await db.exec(`insert into auth.users values('${A}'),('${B}'),('${C}');insert into fin_homes(id,name,owner_id) values('${H}','Synthetic home','${A}'),('${H2}','Other home','${C}');insert into fin_members(home_id,user_id,display_name,role) values('${H}','${A}','Admin','admin'),('${H}','${B}','Member','member'),('${H2}','${C}','Other','admin');`);
  const asUser=async id=>db.exec(`reset role;set request.jwt.claim.sub='${id}';set role authenticated;`);
  const one=async sql=>(await db.query(sql)).rows[0];
  const rows=async sql=>(await db.query(sql)).rows;

  // Personal events: the member's private and busy events are invisible to the administrator.
  await asUser(B);
  await db.exec(`insert into fin_events(home_id,owner_id,title,day,start_time,visibility) values
    ('${H}','${B}','Therapy','2026-10-20','15:00','private'),
    ('${H}','${B}','Doctor','2026-10-21','09:00','busy'),
    ('${H}','${B}','School meeting','2026-10-22','19:00','home')`);
  await assert.rejects(db.exec(`insert into fin_events(home_id,owner_id,title,day) values('${H}','${A}','Impersonated','2026-10-20')`));
  await assert.rejects(db.exec(`insert into fin_events(home_id,owner_id,title,day,start_time,end_time) values('${H}','${B}','Bad','2026-10-20','10:00','09:00')`));
  await assert.rejects(db.exec(`insert into fin_events(home_id,owner_id,title,day,visibility,people) values('${H}','${B}','Outsider','2026-10-20','home','{${C}}')`));
  // People on a personal event are dropped: they could not see it anyway.
  await db.exec(`insert into fin_events(home_id,owner_id,title,day,visibility,people) values('${H}','${B}','Gift','2026-10-23','private','{${A}}')`);
  assert.deepEqual((await one(`select people from fin_events where title='Gift'`)).people,[]);
  await asUser(A);
  assert.deepEqual((await rows('select title from fin_events order by title')).map(r=>r.title),['School meeting']);
  const busy=await rows(`select * from fin_busy_slots('${H}')`);
  assert.equal(busy.length,1);
  assert.equal(Object.keys(busy[0]).includes('title'),false);
  assert.equal(busy[0].owner_id,B);
  assert.equal((await db.query(`update fin_events set title='Changed' where title='School meeting' returning id`)).rows.length,0,'only the owner edits');
  assert.equal((await db.query(`delete from fin_events returning id`)).rows.length,0);
  // Event changes are not written to the administrator's audit history.
  assert.equal((await rows(`select * from fin_audit where table_name='fin_events'`)).length,0);
  await asUser(C);
  assert.equal((await rows('select * from fin_events')).length,0);
  assert.equal((await rows(`select * from fin_busy_slots('${H}')`)).length,0,'another home sees no busy slots');
  await asUser(B);
  assert.equal((await rows(`select * from fin_busy_slots('${H}')`)).length,0,'own busy slots come from the table, not the function');
  await assert.rejects(db.exec(`update fin_events set owner_id='${A}' where title='Therapy'`));

  // Inbox is private to its owner, administrator included.
  await db.exec(`insert into fin_inbox(home_id,owner_id,text) values('${H}','${B}','Call the school')`);
  await assert.rejects(db.exec(`insert into fin_inbox(home_id,owner_id,text) values('${H}','${B}','   ')`));
  await asUser(A);
  assert.equal((await rows('select * from fin_inbox')).length,0);
  await assert.rejects(db.exec(`insert into fin_inbox(home_id,owner_id,text) values('${H}','${B}','Forged')`));

  // Wishes: private unless shared; decision requires its date; links must be web addresses.
  await asUser(B);
  await db.exec(`insert into fin_wishes(home_id,owner_id,name,price_cents,wait_until) values('${H}','${B}','Headphones',25000,'2026-10-19')`);
  await assert.rejects(db.exec(`insert into fin_wishes(home_id,owner_id,name,wait_until,link) values('${H}','${B}','Bad link','2026-10-19','javascript:alert(1)')`));
  await assert.rejects(db.exec(`update fin_wishes set decision='gave_up'`));
  await asUser(A);
  assert.equal((await rows('select * from fin_wishes')).length,0);
  await asUser(B);
  await db.exec(`update fin_wishes set shared=true,decision='gave_up',decided_at=now()`);
  await asUser(A);
  assert.equal((await rows('select * from fin_wishes')).length,1);
  assert.equal((await db.query(`update fin_wishes set price_cents=0 returning id`)).rows.length,0);

  // Task steps are validated and reset when the task repeats.
  await db.exec(`insert into fin_tasks(id,home_id,title,repeat,created_by,steps) values('${T}','${H}','Morning routine','daily','${A}','[{"text":"Make bed","done":true},{"text":"Breakfast","done":false}]')`);
  await assert.rejects(db.exec(`update fin_tasks set steps='[{"text":"","done":false}]' where id='${T}'`));
  await assert.rejects(db.exec(`update fin_tasks set steps='{"text":"x"}' where id='${T}'`));
  await db.exec(`select fin_complete_task('${T}','2026-10-17')`);
  const next=await one(`select steps,due_date::text d from fin_tasks where previous_id='${T}'`);
  assert.deepEqual(next.steps,[{text:'Make bed',done:false},{text:'Breakfast',done:false}]);
  assert.equal(next.d,'2026-10-18');

  // Focus mode is a personal preference column.
  await db.exec(`insert into fin_preferences(user_id,focus_mode) values('${A}',true)`);
  assert.equal((await one(`select focus_mode from fin_preferences`)).focus_mode,true);

  // Card purchase from market mode: one card entry with installments, stock updated, no double purchase.
  await db.exec(`insert into fin_cards(id,home_id,owner_id,name,closing_day,due_day) values('${CA}','${H}','${A}','Admin card',10,17)`);
  await asUser(B);
  await db.exec(`insert into fin_cards(id,home_id,owner_id,name,closing_day,due_day) values('${CB}','${H}','${B}','Member card',10,17)`);
  await db.exec(`insert into fin_pantry(id,home_id,name,unit,quantity,minimum) values('${P}','${H}','Rice','kg',1,1)`);
  await db.exec(`insert into fin_shopping(id,home_id,name,pantry_id,quantity,unit,estimate_cents) values('${S1}','${H}','Rice','${P}',5,'kg',600),('${S2}','${H}','Soap',null,1,'unit',900)`);
  await assert.rejects(db.exec(`select fin_complete_purchase_card(array['${S1}']::uuid[],3000,'2026-10-17','${CA}',3)`),'a member cannot charge the administrator card');
  await assert.rejects(db.exec(`select fin_complete_purchase_card(array['${S1}']::uuid[],3000,'2026-10-17','${CB}',49)`));
  const entry=(await one(`select fin_complete_purchase_card(array['${S1}','${S2}']::uuid[],3900,'2026-10-17','${CB}',3) id`)).id;
  const saved=await one(`select payment,card_id,installments,amount_cents,owner_id,status from fin_entries where id='${entry}'`);
  assert.deepEqual({...saved,amount_cents:Number(saved.amount_cents)},{payment:'card',card_id:CB,installments:3,amount_cents:3900,owner_id:B,status:'paid'});
  assert.equal(Number((await one(`select quantity from fin_pantry where id='${P}'`)).quantity),6);
  await assert.rejects(db.exec(`select fin_complete_purchase_card(array['${S1}']::uuid[],3000,'2026-10-17','${CB}',1)`),'repeating the tap does not buy twice');
  assert.equal((await rows(`select * from fin_entries where card_id='${CB}'`)).length,1);
  // Without the shopping permission the purchase is refused.
  await db.exec(`reset role;update fin_shopping set bought=false where id='${S2}';update fin_members set permissions=jsonb_set(permissions,'{shopping}','false') where user_id='${B}'`);
  await asUser(B);
  await assert.rejects(db.exec(`select fin_complete_purchase_card(array['${S2}']::uuid[],900,'2026-10-17','${CB}',1)`));

  await db.exec('reset role;set role anon');
  for (const name of ['fin_events','fin_inbox','fin_wishes']) await assert.rejects(db.query(`select * from ${name}`));
  await assert.rejects(db.query(`select * from fin_busy_slots('${H}')`));
});
