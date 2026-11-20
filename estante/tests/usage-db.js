"use strict";
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { PGlite } = require(process.env.ESTANTE_PGLITE || "@electric-sql/pglite");

(async () => {
  const db = new PGlite();
  const admin = "11111111-1111-1111-1111-111111111111";
  const other = "22222222-2222-2222-2222-222222222222";
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      create schema auth;
      create function auth.uid() returns uuid language sql as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth to authenticated;
      create table public.estante_admins (user_id uuid primary key);
      insert into public.estante_admins values ('${admin}');
      alter table public.estante_admins enable row level security;
      grant select on public.estante_admins to authenticated;
      create policy own on public.estante_admins for select to authenticated using (user_id = auth.uid());
    `);
    await db.exec(readFileSync(require.resolve("../supabase/migrations/20261120000517_estante_usage_statistics.sql"), "utf8"));
    const { rows: [date] } = await db.query("select ((now() at time zone 'UTC')::date)::text as day");
    const batch = JSON.stringify([
      { day: date.day, metric: "rehearsed", ref: "lrclib:329", count: 2 },
      { day: date.day, metric: "rehearsed", ref: "lrclib:329", count: 3 },
      { day: date.day, metric: "rhythm", ref: "xote", count: 1 }
    ]);
    await db.exec("set role service_role");
    const collect = (id, rows = batch) => db.query("select public.estante_collect_usage($1, $2::jsonb) as accepted", [id, rows]);
    assert.equal((await collect("usage_valid_batch")).rows[0].accepted, true);
    assert.equal((await collect("usage_valid_batch")).rows[0].accepted, false);
    await assert.rejects(collect("usage_invalid_ref", JSON.stringify([
      { day: date.day, metric: "rehearsed", ref: "titulo digitado", count: 1 }
    ])), { code: "23514" });
    assert.equal((await db.query("select count(*)::int as total from estante_usage.received_batches")).rows[0].total, 1);

    await db.exec("reset role; set role anon");
    await assert.rejects(db.query("select * from public.estante_usage_report()"), { code: "42501" });
    await assert.rejects(collect("usage_anon_batch"), { code: "42501" });
    await db.exec("reset role; set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [other]);
    await assert.rejects(db.query("select * from public.estante_usage_report()"), { code: "42501" });
    assert.equal((await db.query("select * from estante_usage.daily_counts")).rows.length, 0);
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [admin]);
    const { rows } = await db.query("select * from public.estante_usage_report()");
    assert.deepEqual(rows.map(row => [row.metric, row.ref, Number(row.total)]), [
      ["rehearsed", "lrclib:329", 5], ["rhythm", "xote", 1]
    ]);
    console.log("PASS: migration, idempotence, protected intake and administrative read");
  } finally { await db.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
