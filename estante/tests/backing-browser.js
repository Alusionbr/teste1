"use strict";
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.ESTANTE_BROWSER || "/usr/bin/chromium" });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await context.addInitScript(() => {
      const key = "estante:v3:setlists";
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, JSON.stringify({ version: 3, activeId: "practice", setlists: [{
        id: "practice", name: "Meu ensaio", songs: [
          { title: "Canção de ensaio", artist: "Banda", tags: ["xote"], duration: 184,
            synced: "[00:00.00]Entrada\n[00:02.00]Verso\n[00:04.00]Refrão" },
          { title: "Próxima", artist: "Banda", lyrics: "Outra letra" }
        ]
      }] }));
    });
    await page.goto(process.env.ESTANTE_URL || "http://127.0.0.1:8765/");
    await page.waitForFunction(() => state.workspace && navigator.serviceWorker.controller);
    const openSongAt = index => page.evaluate(index => openSong(state.setlist[index]), index);
    const visible = selector => page.locator(selector).waitFor({ state: "visible" });
    const modal = () => page.click("#backingBtn");
    await openSongAt(0);
    await modal();
    assert.match(await page.locator("#backingSuggestions").innerText(), /Xote suave/);
    await page.selectOption("#backingGenre", "rock");
    assert.match(await page.locator("#backingResults").innerText(), /Rock de garagem/);
    assert.equal(await page.locator("#backingSuggested").isVisible(), false);
    await page.click("#backingReset");
    await page.locator("#backingResults").getByRole("button", { name: "Escolher Xote suave" }).click();
    await page.click("#backingSave");
    await page.click("#backingPlay");
    await page.waitForFunction(() => document.querySelector("#backingToggle").textContent === "Pausar");
    await openSongAt(1);
    assert.equal(await page.locator("#backingBar").isVisible(), false);

    await modal();
    await page.locator("#backingResults .backingCard").filter({ hasText: "BossaBossa" }).getByText("Baixar offline").click();
    await page.waitForFunction(() => document.querySelector("#backingStatus").textContent.includes("disponível offline"));
    await page.click("[data-backing-view=editor]");
    await page.selectOption("#beatMinutes", "2");
    await page.fill("#beatTitle", "Base do ensaio");
    await page.click("#beatAdvanced summary");
    await page.selectOption("#beatTrack", "snare");
    await page.selectOption("#beatPattern", "full");
    await page.selectOption("#beatMeasure", "1");
    const hit = page.locator("#beatGrid").getByRole("button", { name: "Batida 2", exact: true });
    assert.equal(await hit.getAttribute("aria-pressed"), "false");
    await hit.click();
    assert.equal(await hit.getAttribute("aria-pressed"), "true");
    await page.click("#beatSave");
    await page.click("#backingSave");
    const download = page.waitForEvent("download");
    await page.click("#beatExport");
    const wav = await download;
    assert.equal(wav.suggestedFilename(), "Base do ensaio.wav");
    const file = require("node:fs").readFileSync(await wav.path());
    assert.equal(file.toString("ascii", 0, 4), "RIFF");
    assert.equal(file.readUInt16LE(34), 16);
    assert.ok((file.length - 44) / 88200 >= 118);
    assert.ok(file.some((byte, index) => index > 44 && byte > 0));
    await page.click("#backingClose");

    await openSongAt(0);
    await modal();
    await page.click("[data-backing-view=import]");
    await page.locator("#backingFile").setInputFiles({ name: "Playback pessoal.wav", mimeType: "audio/wav", buffer: file });
    await visible("#backingSyncOptions");
    await page.check("#backingFollow");
    await page.fill("#backingOffset", "1");
    await page.click("#backingSave");
    await page.click("#backingPlay");
    await page.waitForFunction(() => document.querySelector("#backingToggle").textContent === "Pausar");
    await page.locator("#backingSeek").evaluate(control => {
      control.value = 3.25;
      control.dispatchEvent(new Event("change"));
    });
    await page.waitForFunction(() => document.querySelector(".lineLyric.active")?.textContent === "Verso");
    await page.click("#backingToggle");
    await page.evaluate(() => EstanteStorage.flush());

    await context.setOffline(true);
    await page.reload();
    await page.waitForFunction(() => state.workspace && document.querySelector("#network").textContent === "offline");
    assert.equal(await page.evaluate(() => state.projects[0].tracks.snare.patterns.full.some(hit => hit[0] === 17)), true);
    await openSongAt(0);
    await modal();
    assert.equal(await page.locator("#backingSelectionTitle").textContent(), "Playback pessoal");
    await page.click("#backingPlay");
    await page.waitForFunction(() => document.querySelector("#backingToggle").textContent === "Pausar");
    await openSongAt(1);
    await modal();
    await page.check("#backingOffline");
    assert.match(await page.locator("#backingResults").innerText(), /BossaBossa/);
    assert.doesNotMatch(await page.locator("#backingResults").innerText(), /Big Rock/);
    await page.locator("#backingResults").getByRole("button", { name: "Escolher BossaBossa" }).click();
    await page.click("#backingPlay");
    await page.waitForFunction(() => document.querySelector("#backingToggle").textContent === "Pausar");
    await page.click("#backingStop");
    await modal();
    await page.selectOption("#backingKind", "project");
    assert.match(await page.locator("#backingResults").innerText(), /Base do ensaio/);
    await page.locator("#backingResults").getByRole("button", { name: "Escolher Base do ensaio" }).click();
    await page.click("#backingPlay");
    await page.waitForFunction(() => document.querySelector("#backingToggle").textContent === "Pausar");
    assert.deepEqual(errors, []);
    console.log("PASS: filtros, sugestões, player, WAV, importação sincronizada e três tipos de base offline");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
