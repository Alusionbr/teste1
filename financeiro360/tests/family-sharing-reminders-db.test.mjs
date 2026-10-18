import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { test } from "node:test";

const ADMIN = "00000000-0000-4000-8000-000000000001";
const MEMBER = "00000000-0000-4000-8000-000000000002";
const HOME = "00000000-0000-4000-8000-000000000003";
const ENTRY_HOUSE = "00000000-0000-4000-8000-000000000004";
const ENTRY_PERSONAL = "00000000-0000-4000-8000-000000000005";
const REMINDER = "00000000-0000-4000-8000-000000000006";
const DOC = "00000000-0000-4000-8000-000000000007";
const DUE = "00000000-0000-4000-8000-000000000008";
const NOTE = "00000000-0000-4000-8000-000000000009";

test("household sharing, personal entries, reminders, and inherited receipt privacy", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select,insert,delete on storage.objects to authenticated;`);
  for (const file of [
    "20261004024051_family_app.sql",
    "20261006102000_family_household_sharing_reminders.sql",
    "20261006130500_reminder_categories_postits.sql",
  ])
    await db.exec(readFileSync(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8"));
  await db.exec(`insert into auth.users values('${ADMIN}'),('${MEMBER}');insert into public.fin_homes(id,name,owner_id) values('${HOME}','Home','${ADMIN}');insert into public.fin_members(home_id,user_id,display_name,role) values('${HOME}','${ADMIN}','Admin','admin'),('${HOME}','${MEMBER}','Member','member');`);
  const as = async (id) => db.exec(`reset role;set request.jwt.claim.sub='${id}';set role authenticated;`);

  await as(MEMBER);
  await db.exec(`insert into public.fin_entries(id,home_id,owner_id,description,amount_cents,date,kind,category,area,status,payment,shared) values('${ENTRY_HOUSE}','${HOME}','${MEMBER}','House cost',1000,'2026-10-04','expense','Home','household','paid','cash',false),('${ENTRY_PERSONAL}','${HOME}','${MEMBER}','Personal cost',1000,'2026-10-04','expense','Personal','personal','paid','cash',false);`);
  assert.equal((await db.query(`select shared from public.fin_entries where id='${ENTRY_HOUSE}'`)).rows[0].shared, true);
  await db.exec(`insert into public.fin_documents(id,home_id,owner_id,shared,name,path,entry_id,mime,size) values('${DOC}','${HOME}','${MEMBER}',false,'receipt','${HOME}/${MEMBER}/${DOC}','${ENTRY_PERSONAL}','application/pdf',100);insert into storage.objects(bucket_id,name) values('fin-family-private','${HOME}/${MEMBER}/${DOC}');insert into public.fin_reminders(id,home_id,owner_id,title,due_on,kind,note) values('${REMINDER}','${HOME}','${MEMBER}','Buy supplies','2026-10-10','reminder','Remember the list'),('${DUE}','${HOME}','${MEMBER}','Electricity bill','2026-10-12','due_date',''),('${NOTE}','${HOME}','${MEMBER}','Leave key',null,'post_it','On the shelf');`);

  await as(ADMIN);
  assert.equal((await db.query("select * from public.fin_entries")).rows.length, 1, "admin only sees the auto-shared household entry");
  assert.equal((await db.query("select * from public.fin_documents")).rows.length, 0, "an attached receipt follows its personal entry's privacy");
  assert.equal((await db.query("select * from storage.objects")).rows.length, 0, "private receipt bytes also stay hidden");
  assert.equal((await db.query("select * from public.fin_reminders")).rows.length, 3, "reminders, due dates and post-its are shared with the family");
  await assert.rejects(db.exec(`update public.fin_entries set shared=false where id='${ENTRY_HOUSE}'`));

  await as(MEMBER);
  await assert.rejects(db.exec(`insert into public.fin_reminders(home_id,owner_id,title,kind,due_on) values('${HOME}','${MEMBER}','Bad note','post_it','2026-10-10')`), "post-its must not have a calendar date");
  await db.exec(`update public.fin_entries set shared=true where id='${ENTRY_PERSONAL}'`);
  await as(ADMIN);
  assert.equal((await db.query(`select * from public.fin_entries where id='${ENTRY_PERSONAL}'`)).rows.length, 1, "the owner can opt in to sharing a personal entry");
  await assert.rejects(db.exec(`update public.fin_entries set shared=false where id='${ENTRY_PERSONAL}'`), "admin cannot revoke a member's sharing choice");
});
