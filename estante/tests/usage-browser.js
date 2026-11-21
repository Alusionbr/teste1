"use strict";
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.ESTANTE_BROWSER || "/usr/bin/chromium" });
  try {
    const context = await browser.newContext();
    const batches = [];
    await context.addInitScript(() => {
      const schedule = window.setTimeout.bind(window);
      window.setTimeout = (callback, delay, ...args) => schedule(callback, delay === 30000 ? 1200 : delay === 300000 ? 100 : delay, ...args);
    });
    await context.route("https://lrclib.net/api/**", route => route.fulfill({ json: [] }));
    await context.route("https://api.vagalume.com.br/**", route => route.fulfill({ json: { response: { docs: [] } } }));
    await context.route("https://*.supabase.co/functions/v1/estante-usage", async route => {
      const headers = { "Access-Control-Allow-Origin": "http://127.0.0.1:8765",
        "Access-Control-Allow-Headers": "apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
      if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
      batches.push(route.request().postDataJSON());
      return route.fulfill({ status: batches.length === 1 ? 503 : 200, headers, json: { ok: batches.length > 1 } });
    });
    const page = await context.newPage();
    await page.goto("http://127.0.0.1:8765/");
    await page.waitForFunction(() => state.workspace);
    const countSong = () => page.evaluate(() => openSong({
      title: "Título privado para o teste", lyrics: "Letra que não deve sair do aparelho", lrclibId: 329
    }));
    await page.evaluate(() => beginRehearsal());
    await countSong();
    assert.equal(batches.length, 0, "opt-in é necessário");
    assert.equal(await page.evaluate(async () => (await indexedDB.databases()).some(db => db.name === "estante-usage")), false);

    await page.click(".sidebarExtras summary");
    await page.click("#usageSettingsBtn");
    assert.equal(await page.locator("#usageOptIn").isChecked(), false);
    await page.check("#usageOptIn");
    await page.click("#usageDialog footer button");
    await page.evaluate(() => EstanteUsage.missing({ appleId: 715 }));
    await context.setOffline(true);
    await countSong();
    await countSong();
    await page.evaluate(() => {
      EstanteUsage.song({ source: "colado", title: "Composição inédita", publicTrack: "lrclib:349" }, state.activeSession);
      EstanteUsage.backing({ kind: "preset", genre: "xote", title: "Nome interno" });
      EstanteUsage.backing({ kind: "import", genre: "rock", title: "Arquivo privado" });
    });
    await new Promise(resolve => setTimeout(resolve, 1300));
    assert.equal(batches.length, 0);
    const first = page.waitForResponse(response => response.url().endsWith("/estante-usage") && response.status() === 503);
    const second = page.waitForResponse(response => response.url().endsWith("/estante-usage") && response.status() === 200);
    await context.setOffline(false);
    await Promise.all([first, second]);
    assert.deepEqual(batches[1], batches[0], "a tentativa usa exatamente o mesmo lote");
    assert.deepEqual(batches[0].rows.map(row => [row.metric, row.ref, row.count]).sort(), [
      ["missing_lyrics", "apple:715", 1], ["rehearsed", "lrclib:329", 1], ["rhythm", "xote", 1]
    ]);
    assert.doesNotMatch(JSON.stringify(batches), /privad[oa]|Letra que|Composição|Nome interno/);

    await page.evaluate(() => EstanteUsage.backing({ kind: "preset", genre: "samba" }));
    await page.click("#usageSettingsBtn");
    await page.uncheck("#usageOptIn");
    await page.click("#usageDialog footer button");
    await new Promise(resolve => setTimeout(resolve, 1300));
    assert.equal(batches.length, 2);
    const cors = { "Access-Control-Allow-Origin": "http://127.0.0.1:8765",
      "Access-Control-Allow-Headers": "apikey, content-type, authorization", "Access-Control-Allow-Methods": "POST, GET, OPTIONS" };
    await context.route("https://*.supabase.co/auth/v1/token?grant_type=password", async route => {
      if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
      return route.fulfill({ headers: cors, json: { access_token: route.request().postDataJSON().email } });
    });
    await context.route("https://*.supabase.co/functions/v1/estante-usage**", async route => {
      if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
      if (route.request().headers().authorization !== "Bearer admin@example.test") return route.fulfill({ status: 403, headers: cors, json: {} });
      if (new URL(route.request().url()).searchParams.has("ref")) {
        return route.fulfill({ headers: cors, json: { title: "Faixa pública", artist: "Artista", link: "https://lrclib.net/api/get/329" } });
      }
      return route.fulfill({ headers: cors, json: { rows: [{ metric: "rehearsed", ref: "lrclib:329", total: 5 }] } });
    });
    await page.goto("http://127.0.0.1:8765/estatisticas/");
    const login = async email => {
      await page.fill("#email", email);
      await page.fill("#password", "senha-de-teste");
      await page.getByRole("button", { name: "Entrar" }).click();
    };
    await login("outra-pessoa@example.test");
    await page.getByText("O acesso às estatísticas exige").waitFor();
    assert.equal(await page.locator("#report").isVisible(), false);
    await login("admin@example.test");
    await page.getByText("Faixa pública — Artista").waitFor();
    assert.match(await page.locator("#rehearsed").innerText(), /5/);
    await page.click("#logout");
    assert.equal(await page.locator("#report").isVisible(), false);
    await context.setOffline(true);
    await page.goto("http://127.0.0.1:8765/");
    await page.locator("#usageSettingsBtn").waitFor({ state: "attached" });
    console.log("PASS: consentimento, fila offline, deduplicação, desativação e painel administrativo");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
