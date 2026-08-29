// Estante 3.12.0 — busca de vídeo no app, avisos flutuantes e forma de controle.
//
// Não há chave real do YouTube aqui (nem deveria haver: ela é do aparelho do
// usuário). A busca é testada interceptando a chamada, que é o que dá para
// afirmar honestamente: que a URL sai com os filtros certos, que a duração da
// segunda chamada entra na lista, e que cada erro do Google vira uma frase
// que diz o que fazer.
const { chromium } = require('./playwright.js');
const BASE = 'http://localhost:8777/estante/';
let falhas = 0;
const ok = (n, c, e = '') => { console.log((c ? 'ok    ' : 'FALHA ') + n + (e ? ' — ' + e : '')); if (!c) falhas++; };

const BUSCA = {
  items: [
    { id: { videoId: 'aaaaaaaaaaa' }, snippet: { title: 'M&#250;sica &quot;Teste&quot;', channelTitle: 'Canal Um' } },
    { id: { videoId: 'bbbbbbbbbbb' }, snippet: { title: 'Outra versão', channelTitle: 'Canal Dois' } }
  ]
};
const DURACOES = {
  items: [
    { id: 'aaaaaaaaaaa', contentDetails: { duration: 'PT3M20S' } },   // 200s = duração da música
    { id: 'bbbbbbbbbbb', contentDetails: { duration: 'PT1H2M3S' } }   // 3723s
  ]
};

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const ctx = await browser.newContext({ serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  let urlBusca = '';
  await page.route('**/acervo.json*', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"version":1,"songs":[]}' }));
  await page.route('https://lrclib.net/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('https://www.googleapis.com/youtube/v3/search*', r => {
    urlBusca = r.request().url();
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(BUSCA) });
  });
  await page.route('https://www.googleapis.com/youtube/v3/videos*', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(DURACOES) }));

  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof openSong === 'function' && typeof searchYoutube === 'function');
  await page.evaluate(() => localStorage.clear());

  // ============ 1. funções puras ============
  const puras = await page.evaluate(() => ({
    d1: parseISODuration('PT3M45S'), d2: parseISODuration('PT1H2M3S'),
    d3: parseISODuration('PT45S'), d4: parseISODuration('P0D'), d5: parseISODuration('lixo'),
    chaveRuim: ytErrorMessage(400, { error: { details: [{ reason: 'API_KEY_INVALID' }] } }),
    cota: ytErrorMessage(403, { error: { errors: [{ reason: 'quotaExceeded' }] } }),
    referer: ytErrorMessage(403, { error: { errors: [{ reason: 'ipRefererBlocked' }] } }),
    qKaraoke: karaokeQuery({ artist: 'Trio', title: 'Canção' }, 'karaoke'),
    qOriginal: karaokeQuery({ artist: 'Trio', title: 'Canção' }, 'original')
  }));
  ok('parseISODuration lê minutos e segundos', puras.d1 === 225, String(puras.d1));
  ok('parseISODuration lê horas', puras.d2 === 3723, String(puras.d2));
  ok('parseISODuration lê só segundos', puras.d3 === 45, String(puras.d3));
  ok('transmissão ao vivo (P0D) vira 0, não uma duração falsa', puras.d4 === 0, String(puras.d4));
  ok('texto inválido vira 0 em vez de NaN', puras.d5 === 0, String(puras.d5));
  ok('chave inválida vira instrução, não "erro 400"', /chave/i.test(puras.chaveRuim) && /Ajustes/.test(puras.chaveRuim), puras.chaveRuim);
  ok('cota estourada diz o que fazer', /Procurar no YouTube/.test(puras.cota), puras.cota);
  ok('restrição de referenciador é distinguida de chave inválida', /Google Cloud/.test(puras.referer), puras.referer);
  ok('consulta padrão pede karaokê', puras.qKaraoke === 'Trio Canção karaokê', puras.qKaraoke);
  ok('modo original não pede karaokê', puras.qOriginal === 'Trio Canção', puras.qOriginal);

  // ============ 2. sem chave, a busca não sai e explica ============
  await page.evaluate(() => openSong({ title: 'Canção', artist: 'Trio', lyrics: 'linha um\nlinha dois', duration: 200 }));
  const semChave = await page.evaluate(async () => {
    state.keyYT = '';
    openKaraokeDialog();
    const aviso = !document.getElementById('karaokeNoKey').hidden;
    let msg = ''; try { await searchYoutube('teste') } catch (e) { msg = e.message }
    document.getElementById('karaokeDialog').close();
    return { aviso, msg, sugestao: document.getElementById('karaokeSearchInput').value };
  });
  ok('sem chave, o diálogo avisa e aponta Ajustes', semChave.aviso === true);
  ok('sem chave, searchYoutube recusa com instrução', /Ajustes/.test(semChave.msg), semChave.msg);
  ok('a consulta já vem preenchida com a música aberta', semChave.sugestao === 'Trio Canção karaokê', semChave.sugestao);

  // ============ 3. com chave: URL, filtros e duração ============
  const busca = await page.evaluate(async () => {
    state.keyYT = 'CHAVE-DE-TESTE';
    const rows = await searchYoutube('Trio Canção karaokê');
    return rows;
  });
  ok('filtra vídeo que aceita ser embutido na origem', /videoEmbeddable=true/.test(urlBusca), urlBusca.slice(0, 120));
  ok('pede só vídeo, não canal nem playlist', /type=video/.test(urlBusca));
  ok('a chave vai na consulta e não em cabeçalho', /key=CHAVE-DE-TESTE/.test(urlBusca));
  ok('a segunda chamada preenche a duração de cada resultado', busca[0].duration === 200 && busca[1].duration === 3723, JSON.stringify(busca.map(x => x.duration)));
  ok('entidades HTML do YouTube são decodificadas', busca[0].title === 'Música "Teste"', busca[0].title);

  const lista = await page.evaluate(() => {
    renderYoutubeResults([
      { videoId: 'aaaaaaaaaaa', title: 'Certa', channel: 'Canal', duration: 200 },
      { videoId: 'bbbbbbbbbbb', title: 'Loop de 1 hora', channel: 'Canal', duration: 3723 }
    ]);
    const bs = [...document.querySelectorAll('.ytResult')];
    return { n: bs.length, marcados: bs.filter(b => b.querySelector('.ytMatch')).length, primeiro: bs[0].dataset.videoId };
  });
  ok('a lista aponta qual resultado tem a duração da música', lista.marcados === 1, JSON.stringify(lista));

  // ============ 4. anexar: os dois caminhos gravam o mesmo ============
  const anexo = await page.evaluate(() => {
    state.current.videoOffset = 3;
    attachVideoToSong('aaaaaaaaaaa', { title: 'Certa', duration: 200 });
    const pelaBusca = { id: state.current.videoId, off: state.current.videoOffset, aviso: document.getElementById('notice').textContent };
    state.current.videoOffset = 3;
    attachVideoToSong('bbbbbbbbbbb', { title: 'Loop', duration: 3723 });
    const longo = { id: state.current.videoId, aviso: document.getElementById('notice').textContent };
    return { pelaBusca, longo };
  });
  ok('anexar grava o id', anexo.pelaBusca.id === 'aaaaaaaaaaa', anexo.pelaBusca.id);
  ok('anexar zera a sincronia do vídeo anterior', anexo.pelaBusca.off === 0, String(anexo.pelaBusca.off));
  ok('duração compatível não gera alarme falso', !/Atenção/.test(anexo.pelaBusca.aviso), anexo.pelaBusca.aviso);
  ok('vídeo muito mais longo que a música avisa na hora de anexar', /Atenção/.test(anexo.longo.aviso), anexo.longo.aviso);

  // ============ 5. o aviso aparece no celular ============
  const aviso = await page.evaluate(() => {
    const box = document.getElementById('notice');
    notify('mensagem simples', true);
    const simples = { temTimer: noticeTimer !== null, dentroDaLateral: !!box.closest('.sidebar'), fixo: getComputedStyle(box).position };
    notify('precisa decidir <button type="button" id="xBtn">Agir</button>');
    const comBotao = { temTimer: noticeTimer !== null, temFecha: !!box.querySelector('.noticeClose'), botaoVivo: !!document.getElementById('xBtn') };
    return { simples, comBotao };
  });
  ok('#notice não mora mais dentro da barra lateral', aviso.simples.dentroDaLateral === false);
  ok('#notice flutua (position:fixed), visível com a lateral fechada', aviso.simples.fixo === 'fixed', aviso.simples.fixo);
  ok('aviso simples é agendado para sumir', aviso.simples.temTimer === true);
  ok('aviso com botão NÃO some sozinho', aviso.comBotao.temTimer === false);
  ok('aviso com botão ganha × para fechar', aviso.comBotao.temFecha === true);
  ok('o botão do aviso continua existindo para ser ligado', aviso.comBotao.botaoVivo === true);
  await page.evaluate(() => notify('vai sumir', true));
  await page.waitForTimeout(5400);
  ok('e o aviso simples some mesmo, sem outra mensagem por cima',
    (await page.evaluate(() => document.getElementById('notice').textContent)) === '');

  // ============ 5b. hidden precisa esconder de verdade ============
  // A 3.11.0 consertou o empate de especificidade só para .control. O mesmo
  // defeito estava vivo em .sectionBar (faixa preta de 17px acima da folha em
  // toda música), .setlistBar e .karaokeOverlayBtn — o ✕ de sair do karaokê
  // aparecia com o karaokê desligado.
  const escondidos = await page.evaluate(() => {
    const vazam = [...document.querySelectorAll('[hidden]')]
      .filter(e => getComputedStyle(e).display !== 'none')
      .map(e => (e.id || e.className) + ':' + getComputedStyle(e).display);
    return { vazam, exit: getComputedStyle(document.getElementById('karaokeExitBtn')).display };
  });
  ok('nenhum elemento com [hidden] continua ocupando espaço', escondidos.vazam.length === 0, escondidos.vazam.join(', '));
  ok('o ✕ de sair do karaokê some mesmo fora do karaokê', escondidos.exit === 'none', escondidos.exit);

  // ============ 6. marca de vídeo na lista ============
  const marcas = await page.evaluate(() => {
    state.setlist.length = 0;
    state.setlist.push(storedSong({ title: 'Com vídeo', artist: 'A', lyrics: 'x', videoId: 'aaaaaaaaaaa' }));
    state.setlist.push(storedSong({ title: 'Sem vídeo', artist: 'B', lyrics: 'x' }));
    state.tab = 'setlist'; renderList();
    return { marcas: document.querySelectorAll('.tag.video').length, resumo: document.getElementById('setlistSummary').textContent };
  });
  ok('só a música com vídeo recebe a marca', marcas.marcas === 1, String(marcas.marcas));
  ok('o resumo do repertório conta quantas já têm vídeo', /1 com vídeo/.test(marcas.resumo), marcas.resumo);

  // ============ 7. forma de controle ============
  await page.evaluate(() => { state.tab = 'results'; openSong({ title: 'Canção', artist: 'Trio', lyrics: 'a\nb', duration: 200 }) });
  const modos = await page.evaluate(() => {
    const barra = document.querySelector('.transport');
    setPedalMode('toque');
    const toque = { barra: getComputedStyle(barra).display, fab: !document.getElementById('mainFab').hidden, tweak: !document.getElementById('tweakBtn').hidden };
    document.getElementById('tweakBtn').click();
    const aberta = { barra: getComputedStyle(barra).display, posicao: getComputedStyle(barra).position };
    document.getElementById('tweakBtn').click();
    const fechada = getComputedStyle(barra).display;
    setPedalMode('pedaleira');
    const pedaleira = { barra: getComputedStyle(barra).display, tweak: !document.getElementById('tweakBtn').hidden };
    setPedalMode('toque');
    return { toque, aberta, fechada, pedaleira };
  });
  ok('no modo toque a pedaleira sai da tela', modos.toque.barra === 'none', modos.toque.barra);
  ok('no modo toque sobram o flutuante e o ⋯', modos.toque.fab && modos.toque.tweak, JSON.stringify(modos.toque));
  ok('o ⋯ traz a barra de volta', modos.aberta.barra === 'flex', modos.aberta.barra);
  ok('e ela vem como sobreposição, sem roubar altura do viewport', modos.aberta.posicao === 'absolute', modos.aberta.posicao);
  ok('tocar no ⋯ de novo fecha', modos.fechada === 'none', modos.fechada);
  ok('no modo pedaleira a barra é a de sempre', modos.pedaleira.barra === 'flex', modos.pedaleira.barra);
  ok('e o ⋯ não aparece (a barra já está à vista)', modos.pedaleira.tweak === false);

  const chips = await page.evaluate(() => {
    // .chip é usada por três grupos (fonte de busca, tipo de vídeo, forma de
    // controle). O init da busca varria TODAS e apagava o "active" das outras.
    openKaraokeDialog();
    const k = document.querySelector('[data-yt-mode="karaoke"]').classList.contains('active');
    setYoutubeMode('original');
    const trocou = document.querySelector('[data-yt-mode="original"]').classList.contains('active')
      && !document.querySelector('[data-yt-mode="karaoke"]').classList.contains('active');
    const fonte = document.querySelectorAll('.chip[data-source].active').length;
    setYoutubeMode('karaoke');
    document.getElementById('karaokeDialog').close();
    return { k, trocou, fonte };
  });
  ok('o grupo de chips do vídeo abre marcado, sem depender do grupo da busca', chips.k === true);
  ok('trocar o tipo de vídeo marca um e desmarca o outro', chips.trocou === true);
  ok('e o grupo da fonte de busca segue com exatamente um marcado', chips.fonte === 1, String(chips.fonte));

  const sobreposta = await page.evaluate(() => {
    setPedalMode('toque');
    document.getElementById('tweakBtn').click();
    const escondeu = getComputedStyle(document.querySelector('.karaokeStickyBottom')).display;
    fecharBarra();
    return escondeu;
  });
  ok('com a barra aberta os flutuantes somem em vez de espiar por cima', sobreposta === 'none', sobreposta);

  const persistencia = await page.evaluate(() => { setPedalMode('pedaleira'); return JSON.parse(localStorage.getItem('estante:v2:prefs')).pedalMode });
  ok('a forma de controle fica guardada no aparelho', persistencia === 'pedaleira', persistencia);

  // ============ 8. o flutuante é a ação do momento ============
  const acao = await page.evaluate(() => {
    setPedalMode('toque');
    const chamadas = [];
    const s0 = toggleScroll, k0 = karaokePlayPause;
    window.toggleScroll = () => chamadas.push('scroll');
    window.karaokePlayPause = () => chamadas.push('video');
    document.getElementById('mainFab').click();
    state.karaoke = true; updateControls();
    document.getElementById('mainFab').click();
    state.karaoke = false; updateControls();
    window.toggleScroll = s0; window.karaokePlayPause = k0;
    return chamadas;
  });
  ok('fora do karaokê o flutuante rola a letra', acao[0] === 'scroll', JSON.stringify(acao));
  ok('dentro do karaokê o mesmo botão toca o vídeo', acao[1] === 'video', JSON.stringify(acao));

  // ============ 9. as teclas não dependem do modo ============
  const teclas = await page.evaluate(async () => {
    const conta = modo => {
      setPedalMode(modo);
      state.scrolling = false;
      document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
      const r = state.scrolling; if (state.scrolling) toggleScroll();
      return r;
    };
    return { toque: conta('toque'), pedaleira: conta('pedaleira') };
  });
  ok('Espaço rola a letra no modo toque', teclas.toque === true);
  ok('Espaço rola a letra no modo pedaleira, igual', teclas.pedaleira === true);

  // ============ 10. a oferta da pedaleira acontece uma vez só ============
  const oferta = await page.evaluate(() => {
    state.pedalMode = 'toque'; state.pedalOffered = false; notify('');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    const primeira = !!document.getElementById('showPedalBtn');
    notify('');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    const segunda = !!document.getElementById('showPedalBtn');
    return { primeira, segunda, guardado: JSON.parse(localStorage.getItem('estante:v2:prefs')).pedalOffered };
  });
  ok('a primeira tecla de pedaleira oferece a barra', oferta.primeira === true);
  ok('e não insiste na segunda', oferta.segunda === false);
  ok('a oferta feita fica registrada no aparelho', oferta.guardado === true);

  console.log(errors.length ? 'ERROS DE PÁGINA:\n' + errors.join('\n') : 'sem erros de página');
  if (errors.length) falhas += errors.length;
  await browser.close();
  console.log(falhas ? `\n${falhas} falha(s)` : '\n3.12.0: tudo passou');
  process.exit(falhas ? 1 : 0);
})();
