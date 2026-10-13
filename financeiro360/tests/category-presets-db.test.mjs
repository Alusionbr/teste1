import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";

const admin = "00000000-0000-4000-8000-000000000001";
const member = "00000000-0000-4000-8000-000000000002";
const home = "00000000-0000-4000-8000-000000000003";

test("saved categories obey family visibility and prevent duplicate names", async (t) => {
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
    "20261004024051_family_app.sql",
    "20261006102000_family_household_sharing_reminders.sql",
    "20261013180000_family_category_presets.sql",
  ]) await db.exec(readFileSync(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8"));
  await db.exec(`insert into auth.users values('${admin}'),('${member}');
    insert into fin_homes(id,name,owner_id) values('${home}','Home','${admin}');
    insert into fin_members(home_id,user_id,display_name,role) values
      ('${home}','${admin}','Admin','admin'),('${home}','${member}','Member','member');`);
  const asUser = async (id) => db.exec(`reset role; set request.jwt.claim.sub='${id}'; set role authenticated;`);

  await asUser(admin);
  await db.exec(`insert into fin_category_presets(home_id,owner_id,shared,category,subcategory) values
    ('${home}','${admin}',true,'Saúde','Vacinas'),
    ('${home}','${admin}',false,'Pessoal','Lazer');`);
  await assert.rejects(db.exec(`insert into fin_category_presets(home_id,owner_id,shared,category,subcategory)
    values('${home}','${admin}',true,' saúde ',' vacinas ')`));
  await asUser(member);
  assert.deepEqual((await db.query("select category from fin_category_presets")).rows,
    [{ category: "Saúde" }]);
  await db.exec(`insert into fin_category_presets(home_id,owner_id,category,subcategory) values
    ('${home}','${member}','Comida','Delivery')`);
  await assert.rejects(db.exec(`insert into fin_category_presets(home_id,owner_id,shared,category)
    values('${home}','${member}',true,'Categoria compartilhada')`));
  await asUser(admin);
  assert.deepEqual((await db.query("select category from fin_category_presets order by category")).rows,
    [{ category: "Pessoal" }, { category: "Saúde" }]);
});
