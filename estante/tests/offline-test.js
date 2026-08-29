const { chromium } = require('./playwright.js');
const BASE = 'http://localhost:8777';

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));

  await page.goto(BASE + '/estante/', { waitUntil: 'load' });
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 15000 })
    .catch(() => console.log('  (sem controller ainda)'));
  await page.waitForTimeout(1500);

  // Guarda uma música no repertório para checar leitura offline.
  await page.evaluate(() => {
    openSong({ title: 'Teste Offline', artist: 'Banda', lyrics: 'C  G  Am  F\nprimeira linha\nsegunda linha', source: 'colado' });
    addSong();
  });
  await page.waitForTimeout(300);

  await ctx.setOffline(true);
  const resp = await page.reload({ waitUntil: 'load' }).catch(e => { errors.push('reload offline falhou: ' + e.message); return null; });
  await page.waitForTimeout(800);

  const offlineOk = await page.evaluate(() => ({
    css: getComputedStyle(document.body).backgroundColor,
    setlist: (state.setlist || []).length,
    badge: document.getElementById('network').textContent
  }));
  console.log('offline reload status:', resp ? resp.status() : 'n/a');
  console.log('estado offline:', JSON.stringify(offlineOk));
  console.log(errors.length ? 'ERROS: ' + errors.join('; ') : 'sem erros de página');
  await browser.close();
  process.exit(errors.length || offlineOk.setlist !== 1 ? 1 : 0);
})();
