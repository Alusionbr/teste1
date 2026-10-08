import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { test } from "node:test";
const A = "00000000-0000-4000-8000-000000000001",
  B = "00000000-0000-4000-8000-000000000002",
  C = "00000000-0000-4000-8000-000000000003",
  H = "00000000-0000-4000-8000-000000000004",
  H2 = "00000000-0000-4000-8000-000000000005";
const E = "00000000-0000-4000-8000-000000000006",
  E2 = "00000000-0000-4000-8000-000000000007",
  D = "00000000-0000-4000-8000-000000000008",
  D2 = "00000000-0000-4000-8000-000000000009",
  CARD = "00000000-0000-4000-8000-000000000010",
  PAY = "00000000-0000-4000-8000-000000000011",
  P = "00000000-0000-4000-8000-000000000012",
  P2 = "00000000-0000-4000-8000-000000000013",
  S = "00000000-0000-4000-8000-000000000014";
test("household migration: RLS, documents, permissions and atomic shopping", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  let assertions = 0;
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select,insert,delete on storage.objects to authenticated;`,
  );
  await db.exec(
    readFileSync(
      new URL(
        "../supabase/migrations/20261004024051_family_app.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(
    `insert into auth.users values('${A}'),('${B}'),('${C}');insert into public.fin_homes(id,name,owner_id) values('${H}','House one','${A}'),('${H2}','House two','${C}');insert into public.fin_members(home_id,user_id,display_name,role,password_change_required) values('${H}','${A}','Admin','admin',false),('${H}','${B}','Member','member',false),('${H2}','${C}','Other','admin',false);`,
  );
  const asUser = async (id) => {
    await db.exec(
      `reset role;set request.jwt.claim.sub='${id}';set role authenticated;`,
    );
  };
  const count = async (sql, n) => {
    assert.equal((await db.query(sql)).rows.length, n);
    assertions++;
  };
  const deny = async (sql) => {
    await assert.rejects(db.exec(sql));
    assertions++;
  };
  await asUser(A);
  await db.exec(
    `insert into public.fin_entries(id,home_id,owner_id,shared,description,amount_cents,date,kind,category,area,status,payment) values('${E}','${H}','${A}',false,'Private admin',1000,'2026-10-04','expense','Home','household','paid','cash'),('${E2}','${H}','${A}',true,'Shared admin',2000,'2026-10-04','expense','Home','household','paid','cash');insert into public.fin_cards(id,home_id,owner_id,name,closing_day,due_day) values('${CARD}','${H}','${B}','Member card',10,17);insert into public.fin_entries(id,home_id,owner_id,description,amount_cents,date,kind,category,area,status,payment,card_id,invoice_month) values('${PAY}','${H}','${B}','Card payment',500,'2026-10-04','card_payment','Card','household','paid','cash','${CARD}','2026-10');insert into public.fin_documents(id,home_id,owner_id,shared,name,path,entry_id,mime,size) values('${D}','${H}','${A}',true,'private receipt','${H}/${A}/${D}','${E}','application/pdf',100);insert into storage.objects(bucket_id,name) values('fin-family-private','${H}/${A}/${D}');`,
  );
  await asUser(B);
  await count("select * from public.fin_entries", 2);
  await count(`select * from public.fin_entries where id='${E}'`, 0);
  await count("select * from public.fin_documents", 0);
  await count("select * from storage.objects", 0);
  await deny(
    `insert into public.fin_entries(home_id,owner_id,description,amount_cents,date,kind,category,area,status,payment) values('${H}','${A}','Impersonation',100,'2026-10-04','expense','Home','household','paid','cash')`,
  );
  await db.exec(
    `update public.fin_entries set description='attack' where id='${E}'`,
  );
  await count(`select * from public.fin_entries where description='attack'`, 0);
  await deny(`update public.fin_entries set shared=true where id='${PAY}'`);
  await deny(`update public.fin_members set role='admin' where user_id='${B}'`);
  // Name deliberately equals own storage path: must not grant access to any other file.
  await db.exec(
    `insert into public.fin_documents(id,home_id,owner_id,name,path,mime,size) values('${D2}','${H}','${B}','${H}/${B}/${D2}','${H}/${B}/${D2}','application/pdf',100);insert into storage.objects(bucket_id,name) values('fin-family-private','${H}/${B}/${D2}');`,
  );
  await count("select * from storage.objects", 1);
  await deny(
    `insert into storage.objects(bucket_id,name) values('fin-family-private','${H}/${A}/arbitrary')`,
  );
  await db.exec(`delete from storage.objects where name='${H}/${A}/${D}'`);
  await asUser(A);
  await count("select * from storage.objects", 2);
  await db.exec(`update public.fin_entries set shared=true where id='${E}'`);
  await asUser(B);
  await count("select * from public.fin_documents", 2);
  await db.exec(
    `reset role;update public.fin_members set permissions=jsonb_set(permissions,'{payments}','false') where user_id='${B}';`,
  );
  await asUser(B);
  await deny(`delete from public.fin_entries where id='${PAY}'`);
  await deny(`update public.fin_entries set kind='expense' where id='${PAY}'`);
  await deny(
    `update public.fin_entries set amount_cents=100 where id='${PAY}'`,
  );
  await asUser(C);
  await count("select * from public.fin_entries", 0);
  await db.exec(
    `insert into public.fin_pantry(id,home_id,name,unit,quantity,minimum) values('${P2}','${H2}','Other stock','kg',1,1);`,
  );
  await asUser(B);
  await deny(
    `insert into public.fin_shopping(home_id,name,pantry_id,quantity,unit,estimate_cents) values('${H}','Cross home','${P2}',1,'kg',100)`,
  );
  await db.exec(
    `insert into public.fin_pantry(id,home_id,name,unit,quantity,minimum) values('${P}','${H}','Rice','kg',1,1);insert into public.fin_shopping(id,home_id,name,pantry_id,quantity,unit,estimate_cents) values('${S}','${H}','Rice','${P}',2,'kg',100);select public.fin_complete_purchase(array['${S}'::uuid],250,'2026-10-04');`,
  );
  assert.equal(
    (await db.query(`select quantity from public.fin_pantry where id='${P}'`))
      .rows[0].quantity,
    "3",
  );
  assertions++;
  await deny(
    `select public.fin_complete_purchase(array['${S}'::uuid],250,'2026-10-04')`,
  );
  await count(
    `select * from public.fin_entries where description='Compra de mercado'`,
    1,
  );
  await asUser(A);
  await db.exec(
    `insert into public.fin_recurring(id,home_id,owner_id,name,amount_cents,category,area,day,start_month) values('00000000-0000-4000-8000-000000000015','${H}','${B}','Monthly bill',1000,'Home','household',31,'2026-01');select public.fin_plan_month('${H}','2026-02');select public.fin_plan_month('${H}','2026-02');`,
  );
  await count(
    `select * from public.fin_entries where recurring_month='2026-02' and date='2026-02-28'`,
    1,
  );
  await asUser(B);
  await deny(
    `update public.fin_entries set status='paid' where recurring_month='2026-02'`,
  );
  await db.exec(
    `reset role;update public.fin_members set active=false where user_id='${B}'`,
  );
  await asUser(B);
  await count("select * from public.fin_entries", 0);
  await count("select * from storage.objects", 0);
  await db.exec(`reset role;set role anon`);
  await deny("select * from public.fin_entries");
  await deny(
    `select public.fin_complete_purchase(array['${S}'::uuid],250,'2026-10-04')`,
  );
  console.log(`${assertions} access and accounting assertions passed`);
});
