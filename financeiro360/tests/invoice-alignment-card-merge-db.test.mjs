import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';

const admin = '00000000-0000-4000-8000-000000000001';
const member = '00000000-0000-4000-8000-000000000002';
const home = '00000000-0000-4000-8000-000000000003';
const oldCard = '00000000-0000-4000-8000-000000000004';
const newCard = '00000000-0000-4000-8000-000000000005';
const documentId = '00000000-0000-4000-8000-000000000006';

test('invoice checkpoints, card consolidation and balance history obey RLS', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated,anon;
    grant execute on function auth.uid() to authenticated,anon;
    create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;
    grant usage on schema storage to authenticated;
    grant select,insert,delete on storage.objects to authenticated;`);
  for (const file of [
    '20261004024051_family_app.sql',
    '20261005140612_family_installment_schedule.sql',
    '20261013162000_invoice_alignment_card_archive_loans.sql',
  ]) await db.exec(readFileSync(new URL('../supabase/migrations/' + file, import.meta.url), 'utf8'));
  await db.exec(`insert into auth.users values('${admin}'),('${member}');
    insert into fin_homes(id,name,owner_id) values('${home}','Synthetic','${admin}');
    insert into fin_members(home_id,user_id,display_name,role) values
      ('${home}','${admin}','Admin','admin'),('${home}','${member}','Member','member');`);
  const asUser = async (id) => db.exec(`reset role; set request.jwt.claim.sub='${id}'; set role authenticated;`);
  await asUser(admin);
  await db.exec(`insert into fin_cards(id,home_id,owner_id,name,closing_day,due_day) values
    ('${oldCard}','${home}','${admin}','Atacadão',1,11),
    ('${newCard}','${home}','${admin}','Atacadão',1,11);
    insert into fin_entries(home_id,owner_id,description,amount_cents,date,kind,category,area,status,payment,card_id)
    values('${home}','${admin}','Purchase',7878,'2026-10-10','expense','Market','household','paid','card','${newCard}');
    insert into fin_documents(id,home_id,owner_id,name,path,card_id,mime,size)
    values('${documentId}','${home}','${admin}','Invoice','${home}/${admin}/${documentId}','${newCard}','application/pdf',120);
    insert into fin_accounts(home_id,owner_id,name,area,opening_cents,balance_date)
    values('${home}','${admin}','Family','household',10000,'2026-10-01');`);
  await asUser(member);
  await assert.rejects(db.query(`select fin_merge_cards('${newCard}','${oldCard}')`));
  assert.equal((await db.query('select * from fin_invoice_alignments')).rows.length, 0);
  await asUser(admin);
  await db.query(`select fin_merge_cards('${newCard}','${oldCard}')`);
  assert.equal((await db.query(`select count(*)::int as n from fin_entries where card_id='${oldCard}'`)).rows[0].n, 1);
  assert.equal((await db.query(`select count(*)::int as n from fin_documents where card_id='${oldCard}'`)).rows[0].n, 1);
  assert.ok((await db.query(`select archived_at from fin_cards where id='${newCard}'`)).rows[0].archived_at);
  const alignment = (await db.query(`select fin_align_invoice('${oldCard}','2026-11','2026-10-10',70000,'Bank') as id`)).rows[0].id;
  await db.query(`select fin_align_invoice('${oldCard}','2026-11','2026-10-11',80000,'New bank total')`);
  assert.equal((await db.query(`select count(*)::int as n from fin_invoice_alignments where card_id='${oldCard}' and active`)).rows[0].n, 1);
  assert.equal((await db.query(`select active from fin_invoice_alignments where id='${alignment}'`)).rows[0].active, false);
  await assert.rejects(db.query(`select fin_merge_cards('${oldCard}','${newCard}')`));
  const accountId = (await db.query(`select id from fin_accounts limit 1`)).rows[0].id;
  await db.exec(`update fin_accounts set opening_cents=12000,balance_date='2026-10-10' where id='${accountId}'`);
  assert.deepEqual((await db.query(`select previous_cents,balance_cents from fin_account_balance_checks where account_id='${accountId}'`)).rows[0],
    { previous_cents: 10000, balance_cents: 12000 });
  await asUser(member);
  assert.equal((await db.query('select count(*)::int as n from fin_account_balance_checks')).rows[0].n, 0);
});
