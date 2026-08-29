const { chromium } = require('./playwright.js');
const BASE = 'http://localhost:8777/estante/';
let falhas = 0;
const ok = (n, c, e = '') => { console.log((c ? 'ok    ' : 'FALHA ') + n + (e ? ' — ' + e : '')); if (!c) falhas++; };

const ACERVO = { version: 1, songs: [{ title: 'Do Acervo', artist: 'Banda Casa', lyrics: 'letra que so existe aqui em casa', duration: 180 }] };

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const ctx = await browser.newContext({ serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(e.message));

  let ovhHits = 0;
  await page.route('**/acervo.json*', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ACERVO) }));
  // LRCLIB não conhece nenhuma delas
  await page.route('https://lrclib.net/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('https://api.vagalume.com.br/**', r => r.fulfill({ status: 503, contentType: 'text/html', body: '503' }));
  await page.route('https://musicbrainz.org/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"recordings":[]}' }));
  await page.route('https://api.lyrics.ovh/**', r => {
    ovhHits++;
    const u = decodeURIComponent(r.request().url());
    if (/Banda Fora/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ lyrics: 'letra vinda da lyrics.ovh\nsegunda linha' }) });
    r.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'No lyrics found' }) });
  });

  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof fetchLyricsOvh === 'function' && typeof fetchFromAcervo === 'function');
  await page.evaluate(() => localStorage.clear());
  await page.waitForTimeout(400);

  // 1. Faixa só de catálogo (Deezer/Apple), sem letra em lugar nenhum salvo lyrics.ovh
  const r1 = await page.evaluate(async () => {
    await openSong({ title: 'So No Catalogo', artist: 'Banda Fora', source: 'Deezer', sources: ['Deezer'], duration: 200 });
    return { letra: state.current.lyrics, fonte: state.current.source, naTela: $('paper').innerText.slice(0, 60) };
  });
  ok('faixa só de catálogo agora abre com letra (lyrics.ovh)', /lyrics\.ovh/.test(r1.letra) && r1.fonte === 'lyrics.ovh', JSON.stringify(r1));
  ok('a letra aparece na tela, não a mensagem de erro', r1.naTela.includes('lyrics.ovh'), r1.naTela);

  // 2. Acervo tem prioridade sobre a lyrics.ovh
  const antes = ovhHits;
  const r2 = await page.evaluate(async () => {
    await openSong({ title: 'Do Acervo', artist: 'Banda Casa', source: 'Apple', sources: ['Apple'] });
    return { letra: state.current.lyrics, fonte: state.current.source };
  });
  ok('o acervo do site é consultado antes da rede', r2.letra.includes('so existe aqui em casa'), JSON.stringify(r2));
  ok('e nem chega a chamar a lyrics.ovh nesse caso', ovhHits === antes, `hits antes=${antes} depois=${ovhHits}`);

  // 3. Nada em lugar nenhum: continua avisando direito, sem quebrar
  const r3 = await page.evaluate(async () => {
    await openSong({ title: 'Nao Existe Em Lugar Nenhum', artist: 'Ninguem', source: 'Apple', sources: ['Apple'] });
    return { letra: state.current.lyrics || '', naTela: $('paper').innerText.slice(0, 80) };
  });
  ok('sem letra em nenhuma fonte, explica em vez de quebrar', !r3.letra && /letra|encontrei/i.test(r3.naTela), r3.naTela);

  console.log(errors.length ? 'ERROS DE PÁGINA:\n  ' + errors.join('\n  ') : 'sem erros de página');
  await browser.close();
  console.log(falhas ? `\n${falhas} falha(s)` : '\nreservas de letra: tudo passou');
  process.exit(falhas || errors.length ? 1 : 0);
})();
