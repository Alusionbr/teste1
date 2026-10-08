import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';

const A='00000000-0000-4000-8000-000000000001';
const H='00000000-0000-4000-8000-000000000002';
const C='00000000-0000-4000-8000-000000000003';
const OLD='00000000-0000-4000-8000-000000000004';
const FROZEN='00000000-0000-4000-8000-000000000005';

test('editing card closing preserves displayed legacy invoice months',async t=>{
 const db=new PGlite();t.after(()=>db.close());
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select,insert,delete on storage.objects to authenticated;`);
 for(const file of ['20261004024051_family_app.sql','20261005140612_family_installment_schedule.sql','20261005222101_family_freeze_card_invoice_on_closing_edit.sql'])
  await db.exec(readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
 await db.exec(`insert into auth.users values('${A}');insert into fin_homes(id,name,owner_id) values('${H}','Synthetic','${A}');insert into fin_members(home_id,user_id,display_name,role) values('${H}','${A}','Admin','admin');insert into fin_cards(id,home_id,owner_id,name,closing_day,due_day) values('${C}','${H}','${A}','Synthetic',5,12);`);
 await db.exec(`set request.jwt.claim.sub='${A}';set role authenticated;insert into fin_entries(id,home_id,owner_id,description,amount_cents,date,kind,category,area,status,payment,card_id,installments) values('${OLD}','${H}','${A}','Legacy',12000,'2026-10-04','expense','Test','personal','paid','card','${C}',1),('${FROZEN}','${H}','${A}','Snapshot',12000,'2026-10-04','expense','Test','personal','paid','card','${C}',1);update fin_entries set first_invoice_month='2026-10' where id='${FROZEN}';`);
 await db.exec(`update fin_cards set closing_day=3 where id='${C}'`);
 const rows=(await db.query(`select id,first_invoice_month from fin_entries order by id`)).rows;
 assert.deepEqual(rows,[{id:OLD,first_invoice_month:'2026-10'},{id:FROZEN,first_invoice_month:'2026-10'}]);
 await db.exec(`update fin_cards set closing_day=1 where id='${C}'`);
 assert.equal((await db.query(`select first_invoice_month from fin_entries where id='${OLD}'`)).rows[0].first_invoice_month,'2026-10');
});
