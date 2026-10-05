import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
const A='00000000-0000-4000-8000-000000000001', B='00000000-0000-4000-8000-000000000002', C='00000000-0000-4000-8000-000000000003',
  H='00000000-0000-4000-8000-000000000004', H2='00000000-0000-4000-8000-000000000005', K='00000000-0000-4000-8000-000000000006';
test('market catalog: shared by the home, shopping permission, validation and atomic flyer import', async t => {
  const db=new PGlite(); t.after(()=>db.close());
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select,insert,delete on storage.objects to authenticated;`);
  for (const file of ['20261004024051_family_app.sql','20261005190000_market_catalog.sql'])
    await db.exec(readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
  await db.exec(`insert into auth.users values('${A}'),('${B}'),('${C}');insert into fin_homes(id,name,owner_id) values('${H}','Synthetic home','${A}'),('${H2}','Other home','${C}');insert into fin_members(home_id,user_id,display_name,role) values('${H}','${A}','Admin','admin'),('${H}','${B}','Member','member'),('${H2}','${C}','Other','admin');`);
  const asUser=async id=>db.exec(`reset role;set request.jwt.claim.sub='${id}';set role authenticated;`);
  const count=async()=>Number((await db.query('select count(*) n from fin_catalog')).rows[0].n);

  // A member with shopping permission creates an item and a flyer offer; the administrator sees both.
  await asUser(B);
  await db.exec(`insert into fin_catalog(id,home_id,name,brand,size,unit,category,store,created_by) values('${K}','${H}','Arroz','Camil','5 kg','pacote','mercearia','Atacadão','${B}');insert into fin_catalog(home_id,name,price_cents,offer_until,store,created_by) values('${H}','Detergente Ypê 500 ml',219,'2026-10-12',E'Sam\\'s Club','${B}')`);
  await asUser(A);
  assert.equal(await count(),2);

  // Stored values are validated by the server, not only by the form.
  await asUser(B);
  await assert.rejects(db.exec(`insert into fin_catalog(home_id,name,created_by) values('${H}','  ','${B}')`));
  await assert.rejects(db.exec(`insert into fin_catalog(home_id,name,category,created_by) values('${H}','Item','garagem','${B}')`));
  await assert.rejects(db.exec(`insert into fin_catalog(home_id,name,offer_until,created_by) values('${H}','Oferta sem preço','2026-10-12','${B}')`));
  await assert.rejects(db.exec(`insert into fin_catalog(home_id,name,price_cents,created_by) values('${H}','Preço negativo',-1,'${B}')`));
  await assert.rejects(db.exec(`insert into fin_catalog(home_id,name,created_by) values('${H}','Falsificado','${A}')`));
  // One bad row cancels the whole flyer import.
  await assert.rejects(db.exec(`insert into fin_catalog(home_id,name,price_cents,offer_until,created_by) values('${H}','Oferta boa',100,'2026-10-12','${B}'),('${H}','Oferta ruim',null,'2026-10-12','${B}')`));
  assert.equal(await count(),2);
  // Identity cannot be rewritten.
  await assert.rejects(db.exec(`update fin_catalog set home_id='${H2}' where id='${K}'`));
  await assert.rejects(db.exec(`update fin_catalog set created_by='${A}' where id='${K}'`));
  await db.exec(`update fin_catalog set price_cents=2590 where id='${K}'`);
  assert.equal(Number((await db.query(`select price_cents from fin_catalog where id='${K}'`)).rows[0].price_cents),2590);

  // Without shopping permission the member may read but not change the catalog.
  await db.exec(`reset role;update fin_members set permissions=jsonb_set(permissions,'{shopping}','false') where user_id='${B}'`);
  await asUser(B);
  assert.equal(await count(),2);
  await assert.rejects(db.exec(`insert into fin_catalog(home_id,name,created_by) values('${H}','Sem permissão','${B}')`));
  assert.equal((await db.query(`update fin_catalog set name='Alterado' where id='${K}' returning id`)).rows.length,0);
  assert.equal((await db.query(`delete from fin_catalog where id='${K}' returning id`)).rows.length,0);
  await db.exec(`reset role;update fin_members set permissions=jsonb_set(permissions,'{shopping}','true') where user_id='${B}'`);

  // Another home sees nothing and cannot write into this one.
  await asUser(C);
  assert.equal(await count(),0);
  await assert.rejects(db.exec(`insert into fin_catalog(home_id,name,created_by) values('${H}','Invasão','${C}')`));
  assert.equal((await db.query(`delete from fin_catalog where id='${K}' returning id`)).rows.length,0);

  // Suspended members lose access; anonymous clients never have it.
  await db.exec(`reset role;update fin_members set active=false where user_id='${B}'`);
  await asUser(B);
  assert.equal(await count(),0);
  await assert.rejects(db.exec(`insert into fin_catalog(home_id,name,created_by) values('${H}','Suspenso','${B}')`));
  await db.exec(`reset role;set role anon`);
  await assert.rejects(db.query('select * from fin_catalog'));

  // The administrator can clean up.
  await asUser(A);
  assert.equal((await db.query(`delete from fin_catalog where id='${K}' returning id`)).rows.length,1);
});
