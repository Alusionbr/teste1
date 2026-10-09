"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=name=>fs.readFileSync(path.join(root,name),"utf8");

test("formulário anônimo abre, valida o relato e descreve apenas os dados necessários",()=>{
  const html=read("index.html"),client=read("bug-report.js");
  assert.match(html,/id="reportBugBtn"[^>]*>Informar um bug/);
  assert.match(html,/<dialog id="bugReportDialog">/);
  assert.match(html,/id="bugDescription" required minlength="15" maxlength="1500"/);
  assert.match(html,/Não pedimos nome, e-mail ou login/);
  assert.match(client,/credentials: "omit"/);
  assert.match(client,/description: text/);
  assert.match(client,/page_path: pagePath/);
  assert.doesNotMatch(client,/navigator\.userAgent|document\.cookie|localStorage\.getItem|auth\.getUser/);
  assert.match(client,/isSending/);
});

test("envio é limitado a campos validados e não persiste identidade",()=>{
  const edge=fs.readFileSync(path.join(root,"supabase/functions/estante-bug-report/index.ts"),"utf8");
  const migration=fs.readFileSync(path.join(root,"supabase/migrations/20261009013459_estante_anonymous_bug_reports.sql"),"utf8");
  const table=migration.slice(migration.indexOf("create table"),migration.indexOf("\n);"));
  assert.match(edge,/MAX_BODY_BYTES = 8192/);
  assert.match(edge,/description\.length < 15 \|\| description\.length > 1500/);
  assert.match(edge,/return reply\(503, false\)/);
  assert.match(edge,/website\.trim\(\)/);
  assert.match(edge,/Authorization: "Bearer " \+ SERVICE_KEY/);
  assert.doesNotMatch(table,/\b(?:user_id|email|ip_address|user_agent|device_id)\b/i);
  assert.match(migration,/estante_bug_reports_admin_read/);
  assert.match(migration,/to authenticated/);
  assert.match(migration,/select auth\.uid\(\)/);
  const fix=fs.readFileSync(path.join(root,"supabase/migrations/20261009013645_estante_bug_report_version_validation.sql"),"utf8");
  assert.match(fix, /\[0-9\]\+\[\.\]\[0-9\]\+\[\.\]\[0-9\]\+/);
  const index=fs.readFileSync(path.join(root,"supabase/migrations/20261009013851_estante_bug_report_page_default_and_index.sql"),"utf8");
  assert.match(index,/create index estante_bug_reports_created_at_idx/);
});
