"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");

test("Edge Function aceita apenas contadores e exige autenticação para o painel", async () => {
  const previousFetch = global.fetch;
  let serve;
  const outgoing = [];
  global.Deno = { env: { get: name => name === "SUPABASE_URL" ? "https://database.test" : "service" }, serve: handler => { serve = handler; } };
  global.fetch = async (url, options) => {
    outgoing.push([url, options]);
    return new Response(url.endsWith("estante_usage_report") ? '[]' : 'true', { status: 200 });
  };
  try {
    require("../supabase/functions/estante-usage/index.ts");
    const endpoint = "https://example.test/estante-usage";
    const headers = { origin: "https://alusionbr.github.io", apikey: "sb_publishable_BQovHTX0tTRpLtVfOnTVAQ_QxiV1o42" };
    const row = { day: new Date().toISOString().slice(0, 10), metric: "rehearsed", ref: "apple:123", count: 1 };
    const post = (rows, extra = {}) => serve(new Request(endpoint, {
      method: "POST", headers: { ...headers, ...extra }, body: JSON.stringify({ id: "usage_edge_test", rows, privateField: "secret" })
    }));
    assert.equal((await post([{ ...row, ref: "título digitado" }])).status, 400);
    assert.equal((await post([row], { origin: "https://example.test" })).status, 403);
    assert.equal((await serve(new Request(endpoint, { headers }))).status, 401);
    assert.equal(outgoing.length, 0);
    assert.equal((await post([{ ...row, lyrics: "texto privado" }])).status, 200);
    assert.deepEqual(JSON.parse(outgoing[0][1].body), { batch_id: "usage_edge_test", batch_rows: [row] });
    assert.equal(outgoing[0][1].headers.Authorization, "Bearer service");
    assert.equal((await serve(new Request(endpoint, { headers: { ...headers, authorization: "Bearer user-token" } }))).status, 200);
    assert.equal(outgoing[1][1].headers.Authorization, "Bearer user-token");
  } finally { delete global.Deno; global.fetch = previousFetch; }
});
