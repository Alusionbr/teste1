const { chromium } = require('./playwright.js');
const BASE = 'http://localhost:8777/estante/';
let falhas = 0;
const ok = (n, c, e = '') => { console.log((c ? 'ok    ' : 'FALHA ') + n + (e ? ' — ' + e : '')); if (!c) falhas++; };

const MB = {
  recordings: [{
    id: 'mbid-1', title: 'Cantiga Regional', length: 214000,
    'artist-credit': [{ name: 'Grupo do Norte' }],
    releases: [{ title: 'Album Regional' }]
  }]
};

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const ctx = await browser.newContext({ serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/503|Service Unavailable|404/.test(m.text())) errors.push('console: ' + m.text()); });

  let mbHits = 0, ovhTentativas = [];
  await page.route('**/acervo.json*', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"version":1,"songs":[]}' }));
  await page.route('https://musicbrainz.org/**', r => { mbHits++; r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MB) }); });
  await page.route('https://lrclib.net/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('https://api.vagalume.com.br/**', r => r.fulfill({ status: 503, contentType: 'text/html', body: '503' }));
  const jv = key => r => { const cb = new URL(r.request().url()).searchParams.get('callback'); r.fulfill({ status: 200, contentType: 'application/javascript', body: `${cb}({${key}:[]})` }) };
  await page.route('https://itunes.apple.com/**', jv('results'));
  await page.route('https://api.deezer.com/**', jv('data'));
  await page.route('https://api.lyrics.ovh/**', r => {
    const u = decodeURIComponent(r.request().url()).replace('https://api.lyrics.ovh/v1/', '');
    ovhTentativas.push(u);
    // só responde para o nome LIMPO, sem "feat." e sem "(Ao Vivo)"
    if (u === 'Zeca/Moda de Viola') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ lyrics: 'letra achada com o nome limpo' }) });
    r.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'No lyrics found' }) });
  });

  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof searchMusicBrainz === 'function');
  await page.evaluate(() => localStorage.clear());
  await page.waitForTimeout(400);

  // 1. MusicBrainz entra na busca Inteligente e traz duração/álbum
  await page.click('.chip[data-source="smart"]');
  await page.fill('#searchInput', 'cantiga regional');
  await page.click('#searchForm button');
  await page.waitForTimeout(5000);
  const r1 = await page.evaluate(() => state.results.map(x => ({ t: x.title, a: x.artist, alb: x.album, dur: x.duration, src: x.source })));
  ok('MusicBrainz aparece nos resultados', r1.some(x => x.t === 'Cantiga Regional' && /MusicBrainz/.test(x.src)), JSON.stringify(r1));
  ok('traz duração em segundos (não ms)', r1[0] && r1[0].dur === 214, JSON.stringify(r1[0]));
  ok('traz o álbum, que o LRCLIB usa no /api/get', r1[0] && r1[0].alb === 'Album Regional', JSON.stringify(r1[0]));
  ok('é consultado uma vez só por busca (limite de 1/s)', mbHits === 1, `hits=${mbHits}`);

  // 2. lyrics.ovh tenta a variação limpa do nome
  ovhTentativas = [];
  const r2 = await page.evaluate(async () => {
    await openSong({ title: 'Moda de Viola (Ao Vivo)', artist: 'Zeca feat. Tiao', source: 'Deezer', sources: ['Deezer'] });
    return { letra: state.current.lyrics, fonte: state.current.source };
  });
  ok('acha a letra tentando o nome sem feat. e sem "(Ao Vivo)"', /nome limpo/.test(r2.letra), JSON.stringify(r2));
  ok('tentou primeiro o nome original, depois o limpo', ovhTentativas.length === 2 && /feat/i.test(ovhTentativas[0]) && ovhTentativas[1] === 'Zeca/Moda de Viola', JSON.stringify(ovhTentativas));

  // 3. Modo Trecho com Vagalume fora: mensagem honesta, sem prometer a Inteligente
  await page.click('.chip[data-source="excerpt"]');
  await page.fill('#searchInput', 'um verso qualquer que ninguem tem');
  await page.click('#searchForm button');
  await page.waitForTimeout(3000);
  const aviso = await page.locator('#notice').innerText();
  ok('explica que trecho depende só do Vagalume', /peda[çc]o da letra depende s[óo] dele/i.test(aviso) && /nunca o texto/i.test(aviso), aviso.trim().slice(0, 150));
  ok('não sugere a Inteligente no modo Trecho', !/Inteligente/i.test(aviso), aviso.trim().slice(0, 150));
  ok('não oferece o atalho enganoso para a Inteligente', await page.locator('#trySmartBtn').count() === 0);

  // mas em modo Brasil o atalho continua fazendo sentido
  await page.click('.chip[data-source="vagalume"]');
  await page.fill('#searchInput', 'qualquer coisa');
  await page.click('#searchForm button');
  await page.waitForTimeout(3000);
  ok('no modo Brasil o atalho para a Inteligente continua', await page.locator('#trySmartBtn').count() === 1);

  console.log(errors.length ? 'ERROS DE PÁGINA:\n  ' + errors.join('\n  ') : 'sem erros de página');
  await browser.close();
  console.log(falhas ? `\n${falhas} falha(s)` : '\nMusicBrainz + variações: tudo passou');
  process.exit(falhas || errors.length ? 1 : 0);
})();
