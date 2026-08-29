const { chromium } = require('./playwright.js');
const BASE = 'http://localhost:8777/estante/';
let falhas = 0;
const ok = (nome, cond, extra = '') => { console.log((cond ? 'ok    ' : 'FALHA ') + nome + (extra ? ' — ' + extra : '')); if (!cond) falhas++; };

const LRCLIB_RESULT = [{ trackName: 'Musica X', artistName: 'Banda X', albumName: 'Album X', duration: 200, plainLyrics: 'linha um\nlinha dois', syncedLyrics: '', instrumental: false }];

(async () => {
  const browser = await chromium.launch();
  const errors = [];

  // ---------- Cenário 1: Vagalume sempre fora do ar (503 persistente) ----------
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push('cenario1: ' + e.message));
    let vagalumeHits = 0;
    await page.route('https://api.vagalume.com.br/**', route => { vagalumeHits++; route.fulfill({ status: 503, contentType: 'text/html', body: '503' }); });
  await page.route('https://musicbrainz.org/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"recordings":[]}' }));
    await page.route('https://lrclib.net/api/search**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(LRCLIB_RESULT) }));
    const jsonpEmpty = key => route => { const cb = new URL(route.request().url()).searchParams.get('callback'); route.fulfill({ status: 200, contentType: 'application/javascript', body: `${cb}({${key}:[]})` }) };
    await page.route('https://itunes.apple.com/**', jsonpEmpty('results'));
    await page.route('https://api.deezer.com/**', jsonpEmpty('data'));

    await page.goto(BASE, { waitUntil: 'load' });
    await page.waitForFunction(() => typeof searchMusic === 'function');
    await page.evaluate(() => localStorage.clear());
    await page.waitForTimeout(600);

    // Modo Brasil: só Vagalume. Precisa acusar a fonte fora do ar com retry
    // (2 tentativas) e oferecer o atalho para a Inteligente.
    // (No modo Trecho o atalho é omitido de propósito — nenhuma outra fonte
    // procura dentro da letra. Isso é coberto em musicbrainz-test.js.)
    await page.click('.chip[data-source="vagalume"]');
    vagalumeHits = 0;
    await page.fill('#searchInput', 'um trecho qualquer');
    await page.click('#searchForm button');
    await page.waitForTimeout(2500);

    const aviso = await page.locator('#notice').innerText();
    ok('avisa que o Vagalume está fora do ar', /vagalume/i.test(aviso) && /ar|503/i.test(aviso), aviso);
    ok('repetiu a tentativa (retry) antes de desistir', vagalumeHits === 2, `hits=${vagalumeHits}`);
    ok('oferece o botão de atalho para a Inteligente', await page.locator('#trySmartBtn').count() === 1);

    const chipDown = await page.evaluate(() => document.querySelector('.chip[data-source="excerpt"]').classList.contains('down'));
    ok('chip Trecho fica marcado como fora do ar', chipDown);
    const chipBrasilDown = await page.evaluate(() => document.querySelector('.chip[data-source="vagalume"]').classList.contains('down'));
    ok('chip Brasil também fica marcado (mesma fonte)', chipBrasilDown);

    // clicar no atalho deve trocar para smart e re-buscar
    // (a Inteligente ainda tenta o Vagalume, com retry e backoff — dá tempo)
    await page.click('#trySmartBtn');
    await page.waitForTimeout(4000);
    const depois = await page.evaluate(() => ({ source: state.source, resultados: state.results.length, temX: state.results.some(r => r.title === 'Musica X') }));
    ok('o atalho troca para Inteligente', depois.source === 'smart', JSON.stringify(depois));
    ok('a Inteligente encontra via LRCLIB mesmo com Vagalume fora do ar', depois.temX, JSON.stringify(depois));

    console.log(errors.length ? 'ERROS cenario1:\n  ' + errors.join('\n  ') : 'cenario1: sem erros de página');
    await ctx.close();
  }

  // ---------- Cenário 2: Vagalume falha uma vez e recupera (transitório) ----------
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errors2 = [];
    page.on('pageerror', e => errors2.push(e.message));
    let hit = 0;
    await page.route('https://api.vagalume.com.br/search.artmus**', route => {
      hit++;
      if (hit === 1) return route.fulfill({ status: 503, contentType: 'text/html', body: '503' });
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ response: { docs: [{ id: 'v1', title: 'Recuperou', band: 'Banda V' }] } }) });
    });
    await page.goto(BASE, { waitUntil: 'load' });
    await page.waitForFunction(() => typeof searchMusic === 'function');
    await page.evaluate(() => localStorage.clear());
    await page.waitForTimeout(600);
    await page.click('.chip[data-source="vagalume"]');
    await page.fill('#searchInput', 'recuperou');
    await page.click('#searchForm button');
    await page.waitForTimeout(2000);
    const r = await page.evaluate(() => ({ n: state.results.length, titulo: state.results[0] && state.results[0].title }));
    ok('recupera sozinho de uma falha passageira (503 uma vez só)', r.n === 1 && r.titulo === 'Recuperou', JSON.stringify(r));
    ok('sem erro de página', errors2.length === 0, errors2.join(' | '));
    await ctx.close();
  }

  // ---------- Cenário 3: Deezer contribui resultado que as outras fontes não têm ----------
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errors3 = [];
    page.on('pageerror', e => errors3.push(e.message));
    await page.route('https://lrclib.net/api/search**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('https://api.vagalume.com.br/**', route => route.fulfill({ status: 503, contentType: 'text/html', body: '503' }));
    await page.route('https://musicbrainz.org/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"recordings":[]}' }));
    await page.route('https://itunes.apple.com/**', route => {
      const url = new URL(route.request().url());
      const cb = url.searchParams.get('callback');
      route.fulfill({ status: 200, contentType: 'application/javascript', body: `${cb}({results:[]})` });
    });
    await page.route('https://api.deezer.com/**', route => {
      const url = new URL(route.request().url());
      const cb = url.searchParams.get('callback');
      route.fulfill({ status: 200, contentType: 'application/javascript', body: `${cb}({data:[{id:99,title:'Achada no Deezer',artist:{name:'Banda D'},album:{title:'Album D'},duration:222,link:'https://deezer.com/track/99'}]})` });
    });
    await page.goto(BASE, { waitUntil: 'load' });
    await page.waitForFunction(() => typeof searchMusic === 'function');
    await page.evaluate(() => localStorage.clear());
    await page.waitForTimeout(600);
    await page.click('.chip[data-source="smart"]');
    await page.fill('#searchInput', 'achada no deezer');
    await page.click('#searchForm button');
    await page.waitForTimeout(4000);
    const r = await page.evaluate(() => state.results.map(x => ({ t: x.title, src: x.source, dur: x.duration })));
    ok('Deezer contribui um resultado que LRCLIB/Vagalume/Apple não têm', r.some(x => x.t === 'Achada no Deezer' && x.src.includes('Deezer') && x.dur === 222), JSON.stringify(r));
    ok('sem erro de página', errors3.length === 0, errors3.join(' | '));
    await ctx.close();
  }

  await browser.close();
  console.log(falhas ? `\n${falhas} falha(s)` : '\nbusca resiliente: tudo passou');
  process.exit(falhas ? 1 : 0);
})();
