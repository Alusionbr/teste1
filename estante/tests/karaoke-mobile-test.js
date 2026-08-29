// Estante 3.11.0 — karaoke utilizavel por toque no celular: botao de sair,
// play/pause flutuante, ajuste rapido de sincronia na barra, correcao do
// bug .control[hidden], e a janela de rolagem manual que se renova no scroll.
const { chromium } = require('./playwright.js');
const BASE = 'http://localhost:8777/estante/';
let falhas = 0;
const ok = (n, c, e = '') => { console.log((c ? 'ok    ' : 'FALHA ') + n + (e ? ' — ' + e : '')); if (!c) falhas++; };

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 800 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/503|404|Service Unavailable/.test(m.text())) errors.push('console: ' + m.text()); });

  await page.route('**/acervo.json*', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"version":1,"songs":[]}' }));
  await page.route('https://api.vagalume.com.br/**', r => r.fulfill({ status: 503, contentType: 'text/html', body: '503' }));
  await page.route('https://musicbrainz.org/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"recordings":[]}' }));
  await page.route('https://lrclib.net/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('https://www.youtube.com/oembed*', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ title: 'Musica Teste', author_name: 'Banda Teste' }) }));

  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof enterKaraoke === 'function' && typeof karaokeTime === 'function');
  await page.evaluate(() => localStorage.clear());
  await page.waitForTimeout(300);

  // ================= 1. bug .control[hidden] =================
  const r1 = await page.evaluate(() => ({
    key: getComputedStyle(document.getElementById('keyControl')).display,
    capo: getComputedStyle(document.getElementById('capoControl')).display,
  }));
  ok('Tom escondido de verdade sem música aberta', r1.key === 'none', r1.key);
  ok('Capo escondido de verdade sem música aberta', r1.capo === 'none', r1.capo);

  // ================= 2. botões flutuantes escondidos fora do karaokê =================
  await page.evaluate(() => openSong({ title: 'Com Video', artist: 'A', lyrics: 'linha', duration: 200, videoId: 'dQw4w9WgXcQ' }));
  const r2 = await page.evaluate(() => ({
    exit: document.getElementById('karaokeExitBtn').hidden,
    play: document.getElementById('mainFab').hidden,
    quick: document.getElementById('karaokeOffsetQuick').hidden,
  }));
  ok('sair escondido fora do karaokê', r2.exit === true, JSON.stringify(r2));
  // 3.12.0: o flutuante deixou de ser exclusivo do karaokê — no modo toque ele
  // é a acao do momento (Rolar/Pausar) com qualquer música aberta. No modo
  // pedaleira ele volta a aparecer só no karaokê, como na 3.11.0.
  ok('no modo toque o flutuante aparece com música aberta, fora do karaokê', r2.play === false, JSON.stringify(r2));
  const r2b = await page.evaluate(() => { setPedalMode('pedaleira'); const h = document.getElementById('mainFab').hidden; setPedalMode('toque'); return h; });
  ok('no modo pedaleira o flutuante some fora do karaokê', r2b === true, String(r2b));
  ok('ajuste rápido de sincronia escondido fora do karaokê', r2.quick === true, JSON.stringify(r2));

  // ================= 3. entrar no karaokê revela os três =================
  await page.evaluate(() => enterKaraoke());
  const r3 = await page.evaluate(() => ({
    exit: document.getElementById('karaokeExitBtn').hidden,
    play: document.getElementById('mainFab').hidden,
    quick: document.getElementById('karaokeOffsetQuick').hidden,
    quickTxt: document.getElementById('karaokeOffsetOutQuick').textContent,
    dialogTxt: document.getElementById('karaokeOffsetOut').textContent,
  }));
  ok('sair visível dentro do karaokê', r3.exit === false, JSON.stringify(r3));
  ok('play/pause flutuante visível dentro do karaokê', r3.play === false, JSON.stringify(r3));
  ok('ajuste rápido de sincronia visível dentro do karaokê', r3.quick === false, JSON.stringify(r3));
  ok('controle rápido já mostra o valor certo ao entrar (sem esperar 1º toque)', r3.quickTxt === '0.0s' && r3.dialogTxt === '0.0s', JSON.stringify(r3));

  // ================= 4. sair não apaga o vídeo salvo =================
  await page.evaluate(() => karaokeExitBtn.click());
  const r4 = await page.evaluate(() => ({
    karaoke: state.karaoke,
    videoId: state.current.videoId,
    exitHidden: document.getElementById('karaokeExitBtn').hidden,
  }));
  ok('sair desliga o modo karaokê', r4.karaoke === false, JSON.stringify(r4));
  ok('sair NÃO apaga o videoId salvo na música', r4.videoId === 'dQw4w9WgXcQ', JSON.stringify(r4));
  ok('botão de sair volta a ficar escondido', r4.exitHidden === true, JSON.stringify(r4));

  // ================= 5. play/pause flutuante chama o mesmo comando de sempre =================
  await page.evaluate(() => enterKaraoke());
  await page.evaluate(() => {
    window.__msgs = [];
    const frame = document.getElementById('ytFrame');
    const orig = frame.contentWindow.postMessage.bind(frame.contentWindow);
    frame.contentWindow.postMessage = (data, origin) => { window.__msgs.push(JSON.parse(data)); return orig(data, origin); };
  });
  await page.evaluate(() => { window.__msgs = []; mainFab.click(); });
  const r5 = await page.evaluate(() => window.__msgs.map(m => m.func));
  ok('tocar no play/pause flutuante manda um comando ao player', r5.includes('playVideo') || r5.includes('pauseVideo'), JSON.stringify(r5));

  // ================= 6. ajuste rápido na barra sincroniza com o diálogo =================
  await page.evaluate(() => document.querySelector('#karaokeOffsetQuick [data-video-offset="0.5"]').click());
  const r6 = await page.evaluate(() => ({
    quick: document.getElementById('karaokeOffsetOutQuick').textContent,
    dialog: document.getElementById('karaokeOffsetOut').textContent,
    offset: state.current.videoOffset,
  }));
  ok('nudge pela barra atualiza o output da barra', r6.quick === '0.5s', JSON.stringify(r6));
  ok('nudge pela barra também atualiza o output do diálogo, sem abri-lo', r6.dialog === '0.5s', JSON.stringify(r6));
  ok('o valor foi de fato salvo em videoOffset', r6.offset === 0.5, JSON.stringify(r6));

  await page.evaluate(() => document.querySelector('.karaokeControl [data-video-offset="-0.5"]').click());
  const r6b = await page.evaluate(() => ({
    quick: document.getElementById('karaokeOffsetOutQuick').textContent,
    dialog: document.getElementById('karaokeOffsetOut').textContent,
  }));
  ok('nudge pelo diálogo também atualiza o output da barra (mesma direção)', r6b.quick === '0.0s' && r6b.dialog === '0.0s', JSON.stringify(r6b));

  // ================= 7. janela de rolagem manual se renova no scroll, não só no toque =================
  await page.evaluate(() => openSong({ title: 'Sem LRC', artist: 'A', lyrics: Array.from({ length: 80 }, (_, i) => 'linha ' + i).join('\n'), duration: 200, videoId: 'aaaaaaaaaaa' }));
  await page.evaluate(() => enterKaraoke());
  await page.evaluate(() => { document.getElementById('paperViewport').scrollTop = 100; document.getElementById('paperViewport').dispatchEvent(new Event('pointerdown')); });
  await page.waitForTimeout(3500); // > 3s desde o pointerdown, dentro da janela de 4s
  await page.evaluate(() => document.getElementById('paperViewport').dispatchEvent(new Event('scroll')));
  const antes = await page.evaluate(() => document.getElementById('paperViewport').scrollTop);
  await page.evaluate(() => { karaokeScrollPosition(50); }); // tentaria reposicionar se a janela já tivesse expirado
  const depois = await page.evaluate(() => document.getElementById('paperViewport').scrollTop);
  ok('scroll renova a janela manual: reposicionamento automático não briga com o gesto ainda em andamento', antes === depois, `antes=${antes} depois=${depois}`);

  // ================= 8. ordem no celular: Karaokê e ajuste ficam juntos, sem a fileira de Vel./Letra no meio =================
  await page.setViewportSize({ width: 390, height: 800 });
  const r8 = await page.evaluate(() => ({
    karaoke: getComputedStyle(document.getElementById('karaokeBtn')).order,
    quick: getComputedStyle(document.getElementById('karaokeOffsetQuick')).order,
    settings: getComputedStyle(document.getElementById('karaokeSettingsBtn')).order,
  }));
  ok('no celular, Karaokê → ajuste rápido → ⚙ ficam em sequência', +r8.karaoke < +r8.quick && +r8.quick < +r8.settings, JSON.stringify(r8));

  // ================= 9. teclado/pedaleira continuam intocados =================
  // A troca de música em 7/8 navegou o <iframe> de novo, e uma navegação
  // descarta o postMessage monkeypatchado antes — precisa reinstalar (mesmo
  // padrão de karaoke-test.js: nunca reaproveitar o espião entre navegações).
  await page.evaluate(() => {
    const frame = document.getElementById('ytFrame');
    const orig = frame.contentWindow.postMessage.bind(frame.contentWindow);
    frame.contentWindow.postMessage = (data, origin) => { window.__msgs.push(JSON.parse(data)); return orig(data, origin); };
    // mainFab pode estar escondido agora (karaokeToqueNoVideo, depois
    // de 1.4s sem prova de autoplay nos testes anteriores) — igual ao gap 2,
    // de propósito. karaokeExitBtn não depende do vídeo e sempre está à
    // vista durante o karaokê, então tira o foco do campo de busca sem
    // depender de qual botão flutuante está visível agora.
    document.getElementById('karaokeExitBtn').focus();
    window.__msgs = [];
  });
  await page.keyboard.press('Space');
  const r9 = await page.evaluate(() => window.__msgs.map(m => m.func));
  ok('Espaço no karaokê continua chamando o player (não regrediu)', r9.includes('playVideo') || r9.includes('pauseVideo'), JSON.stringify(r9));

  await browser.close();
  console.log(errors.length ? 'ERROS DE PÁGINA: ' + errors.join(' | ') : 'sem erros de página');
  console.log(falhas ? `${falhas} falha(s)` : 'karaokê 3.11.0 (celular): tudo passou');
  process.exit(falhas || errors.length ? 1 : 0);
})();
