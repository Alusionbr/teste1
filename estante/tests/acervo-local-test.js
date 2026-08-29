const { chromium } = require('./playwright.js');
const BASE = 'http://localhost:8777/estante/';
let falhas = 0;
const ok = (n, c, e = '') => { console.log((c ? 'ok    ' : 'FALHA ') + n + (e ? ' — ' + e : '')); if (!c) falhas++; };

const LETRA = 'C       G\nna beira do rio sereno\n[Refrão]\nAm      F\ncanta o barqueiro do meu sertao\n[Final]\nfim';
const ACERVO = {
  version: 1, songs: [
    { title: 'Barqueiro do Sertao', artist: 'Grupo da Casa', duration: 190, lyrics: LETRA, source: 'Acervo' },
    { title: 'Cantiga Antiga', artist: 'Tradicional', duration: 120, lyrics: 'roda roda pião\nviola no salão' }
  ]
};

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  // O service worker serve acervo.json do cache, e page.route() não intercepta
  // requisição feita pelo SW — sem bloquear, o teste receberia o arquivo real
  // (vazio) em vez do acervo de teste. O comportamento do SW é coberto em
  // offline-test.js.
  const ctx = await browser.newContext({ serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(e.message));
  // O 503 do Vagalume é simulado por este teste de propósito: o navegador
  // registra no console, mas não é erro do app.
  page.on('console', m => { if (m.type() === 'error' && !/503|Service Unavailable/.test(m.text())) errors.push('console: ' + m.text()); });

  // acervo do site servido com conteúdo; todas as fontes de rede mortas
  await page.route('**/acervo.json*', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ACERVO) }));
  await page.route('https://api.vagalume.com.br/**', r => r.fulfill({ status: 503, contentType: 'text/html', body: '503' }));
  await page.route('https://musicbrainz.org/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"recordings":[]}' }));
  await page.route('https://lrclib.net/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  const jsonpVazio = key => r => { const cb = new URL(r.request().url()).searchParams.get('callback'); r.fulfill({ status: 200, contentType: 'application/javascript', body: `${cb}({${key}:[]})` }) };
  await page.route('https://itunes.apple.com/**', jsonpVazio('results'));
  await page.route('https://api.deezer.com/**', jsonpVazio('data'));

  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof searchAcervo === 'function' && typeof searchLocal === 'function');
  await page.evaluate(() => localStorage.clear());
  await page.waitForTimeout(700);

  // ---- 1. Acervo aparece na busca mesmo com todas as fontes de rede fora ----
  await page.click('.chip[data-source="smart"]');
  await page.fill('#searchInput', 'barqueiro do sertao');
  await page.click('#searchForm button');
  await page.waitForTimeout(4000);
  let r = await page.evaluate(() => state.results.map(x => ({ t: x.title, src: x.source, acervo: !!x.acervo, temLetra: !!x.lyrics })));
  ok('acha no acervo com todas as fontes de rede fora do ar', r.length === 1 && r[0].t === 'Barqueiro do Sertao' && r[0].acervo && r[0].temLetra, JSON.stringify(r));
  ok('a etiqueta "acervo do site" aparece na lista', (await page.locator('#list .tag.local').first().innerText()).toLowerCase().includes('acervo'));

  // abrir a música do acervo tem de mostrar a letra sem rede nenhuma
  await page.click('#list .songItem');
  await page.waitForTimeout(600);
  const naTela = await page.evaluate(() => $('paper').innerText);
  ok('abre a letra do acervo direto', naTela.includes('barqueiro do meu sertao'), naTela.split('\n').slice(0, 2).join(' / '));

  // ---- 2. Busca por TRECHO da letra no acervo (o que o Vagalume fazia) ----
  await page.fill('#searchInput', 'roda roda pião');
  await page.click('#searchForm button');
  await page.waitForTimeout(4000);
  r = await page.evaluate(() => state.results.map(x => ({ t: x.title, naLetra: !!x.matchedLyrics })));
  ok('acha por trecho da letra no acervo, sem Vagalume', r.length === 1 && r[0].t === 'Cantiga Antiga' && r[0].naLetra, JSON.stringify(r));

  // ---- 3. Busca no repertório salvo, inclusive por trecho ----
  await page.evaluate(async () => {
    await openSong({ title: 'Minha Autoral', artist: 'Eu Mesmo', lyrics: 'verso que so eu tenho\nguardado a sete chaves', duration: 150 });
    addSong();
  });
  await page.waitForTimeout(400);
  await page.fill('#searchInput', 'guardado a sete chaves');
  await page.click('#searchForm button');
  await page.waitForTimeout(4000);
  r = await page.evaluate(() => state.results.map(x => ({ t: x.title, local: !!x.local, naLetra: !!x.matchedLyrics })));
  ok('acha no repertório salvo por trecho da letra', r.some(x => x.t === 'Minha Autoral' && x.local && x.naLetra), JSON.stringify(r));

  // ---- 4. Offline: busca continua funcionando no que está no aparelho ----
  await ctx.setOffline(true);
  await page.fill('#searchInput', 'barqueiro');
  await page.click('#searchForm button');
  await page.waitForTimeout(1200);
  const aviso = await page.locator('#notice').innerText();
  r = await page.evaluate(() => state.results.map(x => x.title));
  ok('offline ainda acha no acervo/repertório', r.includes('Barqueiro do Sertao'), JSON.stringify(r));
  ok('o aviso diz que é do aparelho, sem parecer erro', /sem internet/i.test(aviso) && /acervo|repert/i.test(aviso), aviso.trim());

  await page.fill('#searchInput', 'coisa que nao existe aqui');
  await page.click('#searchForm button');
  await page.waitForTimeout(1000);
  ok('offline sem correspondência explica direito', /offline/i.test(await page.locator('#notice').innerText()));
  await ctx.setOffline(false);

  // ---- 5. Repertório vem antes do resultado igual vindo da rede ----
  await page.unroute('https://lrclib.net/**');
  await page.route('https://lrclib.net/**', r2 => r2.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify([{ trackName: 'Minha Autoral', artistName: 'Eu Mesmo', albumName: 'X', duration: 150, plainLyrics: 'versao da rede', syncedLyrics: '', instrumental: false }])
  }));
  await page.fill('#searchInput', 'minha autoral');
  await page.click('#searchForm button');
  await page.waitForTimeout(4000);
  r = await page.evaluate(() => state.results.map(x => ({ t: x.title, local: !!x.local, letra: (x.lyrics || '').slice(0, 20) })));
  ok('não duplica: a versão do aparelho ganha da rede', r.filter(x => x.t === 'Minha Autoral').length === 1 && r[0].local, JSON.stringify(r));
  ok('mantém a letra que estava salva, não a da rede', r[0].letra.includes('verso que so eu'), JSON.stringify(r[0]));

  console.log(errors.length ? 'ERROS DE PÁGINA:\n  ' + errors.join('\n  ') : 'sem erros de página');
  await browser.close();
  console.log(falhas ? `\n${falhas} falha(s)` : '\nacervo + busca local: tudo passou');
  process.exit(falhas || errors.length ? 1 : 0);
})();
