const { chromium } = require('./playwright.js');
const BASE = 'http://localhost:8777/estante/';
let falhas = 0;
const ok = (n, c, e = '') => { console.log((c ? 'ok    ' : 'FALHA ') + n + (e ? ' — ' + e : '')); if (!c) falhas++; };

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const ctx = await browser.newContext({ serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/503|404|Service Unavailable/.test(m.text())) errors.push('console: ' + m.text()); });

  await page.route('**/acervo.json*', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"version":1,"songs":[]}' }));
  await page.route('https://api.vagalume.com.br/**', r => r.fulfill({ status: 503, contentType: 'text/html', body: '503' }));
  await page.route('https://musicbrainz.org/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"recordings":[]}' }));

  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof tick === 'function' && typeof scrollDistance === 'function');
  await page.evaluate(() => localStorage.clear());
  await page.waitForTimeout(300);

  // ---- 1. dt com teto: voltar de segundo plano não teleporta ----
  const r1 = await page.evaluate(async () => {
    const letra = Array.from({ length: 120 }, (_, i) => 'linha ' + i).join('\n');
    await openSong({ title: 'T', artist: 'A', lyrics: letra, duration: 200 });
    const vp = $('paperViewport');
    state.speed = 18; state.scrolling = true; pixelRest = 0; vp.scrollTop = 0;
    lastFrame = performance.now() - 40000;           // 40s escondido
    tick();
    await new Promise(r => setTimeout(r, 60));
    const salto = Math.round(vp.scrollTop);
    state.scrolling = false; if (raf) cancelAnimationFrame(raf);
    return { salto };
  });
  ok('voltar de 40s em segundo plano não teleporta a letra', r1.salto <= 5, `saltou ${r1.salto}px (antes: 720px)`);

  // ---- 2. distância do auto-scroll bate com a última linha ----
  const r2 = await page.evaluate(async () => {
    const letra = Array.from({ length: 60 }, (_, i) => 'verso numero ' + i).join('\n');
    await openSong({ title: 'T2', artist: 'A', lyrics: letra, duration: 180 });
    const vp = $('paperViewport'), paper = $('paper');
    const ultima = paper.children[paper.children.length - 1];
    const real = Math.max(0, ultima.offsetTop + ultima.offsetHeight - vp.clientHeight);
    const usado = scrollDistance();
    return { usado: Math.round(usado), real: Math.round(real), erro: Math.abs(usado - real) };
  });
  ok('distância do auto-scroll é a real até a última linha', r2.erro <= 2, `usada ${r2.usado}px, real ${r2.real}px`);

  // letra curta que cabe na tela -> distância 0, "não precisa rolar" agora é alcançável
  const r2b = await page.evaluate(async () => {
    await openSong({ title: 'Curta', artist: 'A', lyrics: 'uma linha so', duration: 180 });
    return { dist: scrollDistance(), vel: speedForSong(state.current) };
  });
  ok('letra que cabe na tela tem distância 0', r2b.dist === 0 && r2b.vel === 0, JSON.stringify(r2b));

  // a rolagem para quando a última linha chega ao rodapé, não no vazio
  const r2c = await page.evaluate(async () => {
    const letra = Array.from({ length: 40 }, (_, i) => 'linha ' + i).join('\n');
    await openSong({ title: 'T3', artist: 'A', lyrics: letra, duration: 200 });
    const vp = $('paperViewport');
    vp.scrollTop = scrollDistance();
    return { paraAqui: atScrollEnd(), aindaTemVaoAbaixo: vp.scrollHeight - vp.clientHeight - vp.scrollTop };
  });
  ok('a rolagem para na última linha, não no preenchimento', r2c.paraAqui && r2c.aindaTemVaoAbaixo > 50, JSON.stringify(r2c));

  // ---- 3. LRCLIB 200 com letra nula cai para a reserva ----
  await page.route('https://lrclib.net/api/get**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ trackName: 'X', artistName: 'Y', albumName: 'A', duration: 200, plainLyrics: null, syncedLyrics: null, instrumental: false }) }));
  await page.route('https://lrclib.net/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('https://api.lyrics.ovh/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ lyrics: 'LETRA DA RESERVA' }) }));
  const r3 = await page.evaluate(async () => {
    await openSong({ title: 'X', artist: 'Y', album: 'A', duration: 200, source: 'Deezer' });
    return { letra: state.current.lyrics || '(VAZIA)', fonte: state.current.source, tela: $('paper').innerText.slice(0, 30) };
  });
  ok('LRCLIB com letra nula cai para a reserva em vez de abrir em branco', /RESERVA/.test(r3.letra), JSON.stringify(r3));

  // ---- 4 e 5. pedaleira ----
  const r4 = await page.evaluate(async () => {
    const L = 'C\nlinha um\nlinha dois';
    state.setlists = []; loadSetlists();
    for (const t of ['A', 'B', 'C']) { await openSong({ title: 'Musica ' + t, artist: 'X', lyrics: L, duration: 100 }); addSong(); }
    state.tab = 'setlist'; state.currentIndex = 1; await openSong(state.setlist[1]);
    // busca e abre pelos resultados a MESMA musica que ja esta no repertorio
    state.results = [{ title: 'Musica B', artist: 'X', lyrics: L, duration: 100, source: 'LRCLIB' }];
    state.tab = 'results'; renderList();
    document.querySelector('#list .songItem').click();
    await new Promise(r => setTimeout(r, 250));
    const idxDepoisDeAbrir = state.currentIndex;
    jumpSong(1);
    await new Promise(r => setTimeout(r, 250));
    return { idxDepoisDeAbrir, proxima: state.current.title };
  });
  ok('abrir pelos resultados religa o índice do repertório', r4.idxDepoisDeAbrir === 1, `índice ${r4.idxDepoisDeAbrir}`);
  ok('"próxima" vai para a seguinte, não para o começo do show', r4.proxima === 'Musica C', `foi para ${r4.proxima}`);

  const r5 = await page.evaluate(async () => {
    state.currentIndex = state.setlist.length - 1;
    await openSong(state.setlist[state.currentIndex]);
    const vp = $('paperViewport');
    vp.scrollTop = 40;
    const antes = vp.scrollTop;                    // o navegador limita ao máximo real
    jumpSong(1);                                   // ja esta na ultima
    await new Promise(r => setTimeout(r, 200));
    return { idx: state.currentIndex, antes, depois: vp.scrollTop };
  });
  ok('› na última música não reabre nem joga a rolagem para o topo', r5.antes > 0 && r5.depois === r5.antes, JSON.stringify(r5));

  const r6 = await page.evaluate(async () => {
    await openSong({ title: 'Fora do repertorio', artist: 'Z', lyrics: 'a\nb' });
    addSong();
    return state.currentIndex === state.setlist.length - 1;
  });
  ok('salvar no repertório passa a ser a música atual do show', r6);

  // ---- wake lock: existe caminho de liberação ----
  const r7 = await page.evaluate(() => ({
    temRelease: typeof releaseAwake === 'function',
    stopAllLibera: /releaseAwake/.test(stopAll.toString()),
  }));
  ok('existe liberação do wake lock e stopAll a chama', r7.temRelease && r7.stopAllLibera, JSON.stringify(r7));

  console.log(errors.length ? 'ERROS DE PÁGINA:\n  ' + errors.join('\n  ') : 'sem erros de página');
  await browser.close();
  console.log(falhas ? `\n${falhas} falha(s)` : '\npalco 3.8.0: tudo passou');
  process.exit(falhas || errors.length ? 1 : 0);
})();
