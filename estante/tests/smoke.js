const { chromium } = require('./playwright.js');
const BASE = 'http://localhost:8777';

(async () => {
  const browser = await chromium.launch();
  let failures = 0;
  const check = async (path, fn) => {
    const page = await browser.newPage();
    const errors = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('requestfailed', r => errors.push('404/fail: ' + r.url()));
    const resp = await page.goto(BASE + path, { waitUntil: 'load' });
    await page.waitForTimeout(600);
    let extra = '';
    try { extra = fn ? await fn(page) : ''; } catch (e) { errors.push('assert: ' + e.message); }
    const bad = errors.filter(e => !/favicon/.test(e));
    if (bad.length) { failures++; console.log(`FAIL ${path} [${resp.status()}]\n  ` + bad.join('\n  ')); }
    else console.log(`ok   ${path} [${resp.status()}] ${extra}`);
    await page.close();
  };

  await check('/', async p => 'cards=' + await p.locator('#tools .card').count());
  await check('/controle360/', async p => 'tabs=' + await p.locator('.tab-button').count());
  await check('/estante/', async p => {
    const sw = await p.evaluate(() => navigator.serviceWorker ? navigator.serviceWorker.getRegistrations().then(r => r.length) : -1);
    return 'sw=' + sw + ' title=' + await p.locator('#songTitle').textContent();
  });

  await browser.close();
  process.exit(failures ? 1 : 0);
})();
