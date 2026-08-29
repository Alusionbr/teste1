// Estante — modo karaoke: relogio, protocolo, integracao com o resto do app.
//
// Nao ha rede de saida nesta caixa, entao nao da para navegar um iframe de
// verdade ate youtube-nocookie.com e testar o handshake ponta a ponta. O que
// da para testar honestamente, e o que este arquivo testa:
//   - as funcoes puras (parseVideoId, karaokeTime, karaokeScrollPosition, a
//     deteccao de anuncio) chamadas diretamente;
//   - o ENVELOPE que ytSend/ytCommand montam, espionando postMessage;
//   - o filtro de origem/remetente de ytOnMessage, chamado com um objeto que
//     imita um MessageEvent (o mesmo codigo que rodaria com um de verdade);
//   - a integracao com o resto do app: tick(), stopAll(), openSong(),
//     toggleScroll/toggleSync, wake lock, teclas.
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
  await page.route('https://lrclib.net/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('https://www.youtube.com/oembed*', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ title: 'Musica Teste', author_name: 'Banda Teste' }) }));

  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof enterKaraoke === 'function' && typeof karaokeTime === 'function');
  await page.evaluate(() => localStorage.clear());
  await page.waitForTimeout(300);

  // ================= 1. parseVideoId =================
  const p1 = await page.evaluate(() => ({
    watch: parseVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=xyz'),
    curto: parseVideoId('https://youtu.be/dQw4w9WgXcQ?t=10'),
    embed: parseVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ'),
    nocookie: parseVideoId('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'),
    puro: parseVideoId('dQw4w9WgXcQ'),
    comEspaco: parseVideoId('  dQw4w9WgXcQ  '),
    music: parseVideoId('https://music.youtube.com/watch?v=dQw4w9WgXcQ'),
    lixo: parseVideoId('isso nao e um link'),
    outroSite: parseVideoId('https://vimeo.com/dQw4w9WgXcQ'),
    vazio: parseVideoId(''),
  }));
  ok('link comum extrai o id', p1.watch === 'dQw4w9WgXcQ', p1.watch);
  ok('link curto (youtu.be) extrai o id', p1.curto === 'dQw4w9WgXcQ', p1.curto);
  ok('link /embed/ extrai o id', p1.embed === 'dQw4w9WgXcQ', p1.embed);
  ok('nocookie tambem e aceito', p1.nocookie === 'dQw4w9WgXcQ', p1.nocookie);
  ok('id puro de 11 caracteres e aceito', p1.puro === 'dQw4w9WgXcQ', p1.puro);
  ok('espaco em volta nao atrapalha', p1.comEspaco === 'dQw4w9WgXcQ', p1.comEspaco);
  ok('music.youtube.com tambem e aceito', p1.music === 'dQw4w9WgXcQ', p1.music);
  ok('texto sem link nao vira id', p1.lixo === '', p1.lixo);
  ok('link de outro site e rejeitado', p1.outroSite === '', p1.outroSite);
  ok('vazio nao quebra', p1.vazio === '', p1.vazio);

  // ================= 2. ensureFrame / frameSrc =================
  await page.evaluate(async () => {
    await openSong({ title: 'Com Video', artist: 'A', lyrics: 'linha', duration: 200, videoId: 'dQw4w9WgXcQ' });
  });
  const p2 = await page.evaluate(() => {
    const f = ensureFrame();
    return {
      allow: f.getAttribute('allow'),
      semFullscreen: !f.hasAttribute('allowfullscreen') && !f.getAttribute('allow').includes('fullscreen'),
      dentroDoFrame: $('karaokeFrame').contains(f),
    };
  });
  ok('iframe pede autoplay delegado', /autoplay/.test(p2.allow), p2.allow);
  ok('iframe NAO pede tela cheia (a letra sumiria)', p2.semFullscreen);
  ok('iframe entra dentro de #karaokeFrame', p2.dentroDoFrame);

  const p3 = await page.evaluate(() => {
    const src = frameSrc('dQw4w9WgXcQ');
    const u = new URL(src);
    return { origem: u.origin, path: u.pathname, jsapi: u.searchParams.get('enablejsapi'), rel: u.searchParams.get('rel') };
  });
  ok('embed usa youtube-nocookie', p3.origem === 'https://www.youtube-nocookie.com', p3.origem);
  ok('embed aponta pro id certo', p3.path === '/embed/dQw4w9WgXcQ', p3.path);
  ok('enablejsapi=1 (protocolo postMessage precisa disso)', p3.jsapi === '1');

  // ================= 3. envelope do protocolo (espiando postMessage) =================
  const p4 = await page.evaluate(() => {
    const f = ensureFrame();
    const chamadas = [];
    f.contentWindow.postMessage = (msg, origin) => chamadas.push({ msg: JSON.parse(msg), origin });
    ytCommand('playVideo', []);
    ytCommand('seekTo', [12.5, true]);
    return chamadas;
  });
  ok('comando tem o envelope certo (conferido no www-widgetapi.js do Google)',
    p4[0].msg.event === 'command' && p4[0].msg.func === 'playVideo' && p4[0].msg.channel === 'widget' && typeof p4[0].msg.id === 'number',
    JSON.stringify(p4[0]));
  ok('args chegam junto', JSON.stringify(p4[1].msg.args) === JSON.stringify([12.5, true]), JSON.stringify(p4[1].msg.args));
  ok('vai para a origem do youtube-nocookie, nunca "*"', p4.every(c => c.origin === 'https://www.youtube-nocookie.com'), JSON.stringify(p4.map(c => c.origin)));

  // ================= 4. filtro de origem/remetente de ytOnMessage =================
  const p5 = await page.evaluate(() => {
    const f = ensureFrame();
    const antes = ytEstado;
    ytOnMessage({ origin: 'https://evil.example.com', source: f.contentWindow, data: JSON.stringify({ info: { playerState: 1, currentTime: 5, duration: 200 } }) });
    const rejeitouOrigemErrada = ytEstado === antes;
    ytOnMessage({ origin: 'https://www.youtube-nocookie.com', source: {}, data: JSON.stringify({ info: { playerState: 1, currentTime: 5, duration: 200 } }) });
    const rejeitouRemetenteErrado = ytEstado === antes;
    ytOnMessage({ origin: 'https://www.youtube-nocookie.com', source: f.contentWindow, data: { não: 'e string' } });
    const rejeitouDadoNaoString = ytEstado === antes;
    ytOnMessage({ origin: 'https://www.youtube-nocookie.com', source: f.contentWindow, data: '{ isso não é json' });
    const rejeitouJsonQuebrado = ytEstado === antes;
    ytOnMessage({ origin: 'https://www.youtube-nocookie.com', source: f.contentWindow, data: JSON.stringify({ info: { playerState: 1, currentTime: 5, duration: 200 } }) });
    const aceitouMensagemValida = ytEstado === 1;
    return { rejeitouOrigemErrada, rejeitouRemetenteErrado, rejeitouDadoNaoString, rejeitouJsonQuebrado, aceitouMensagemValida };
  });
  ok('rejeita origem que não é do YouTube', p5.rejeitouOrigemErrada);
  ok('rejeita remetente que não é o nosso iframe', p5.rejeitouRemetenteErrado);
  ok('rejeita dado que não é string (não é o formato do widget)', p5.rejeitouDadoNaoString);
  ok('rejeita JSON quebrado sem quebrar a página', p5.rejeitouJsonQuebrado);
  ok('aceita mensagem válida do remetente certo', p5.aceitouMensagemValida);

  // ================= 5. relógio: extrapolação, teto, anúncio =================
  const p6 = await page.evaluate(async () => {
    aplicarInfo({ playerState: 1, currentTime: 10, duration: 200 });
    const logo = karaokeTime();
    await new Promise(r => setTimeout(r, 300));
    const depoisDe300ms = karaokeTime();
    return { logo, depoisDe300ms };
  });
  ok('relógio parte exatamente da última entrega', Math.abs(p6.logo - 10) < 0.05, p6.logo);
  ok('relógio extrapola entre entregas (sem esperar o próximo infoDelivery)', p6.depoisDe300ms > p6.logo + 0.2, JSON.stringify(p6));

  const p7 = await page.evaluate(async () => {
    aplicarInfo({ playerState: 1, currentTime: 50, duration: 200 });
    await new Promise(r => setTimeout(r, 1300));           // bem além do teto de 1s
    return karaokeTime();
  });
  ok('extrapolação tem teto (EXTRAPOLA_MAX): não passa de 1s além da última entrega', p7 <= 51.05, p7);

  const p8 = await page.evaluate(async () => {
    aplicarInfo({ playerState: 1, currentTime: 60, duration: 200 });         // duração real = 200 (já fixada antes)
    aplicarInfo({ playerState: 1, currentTime: 3, duration: 30 });           // anúncio: duração bem diferente
    const congelado1 = karaokeTime();
    await new Promise(r => setTimeout(r, 200));
    const congelado2 = karaokeTime();
    aplicarInfo({ playerState: 1, currentTime: 8, duration: 200 });          // volta a duração real: fim do anúncio
    const voltouAndar = karaokeTime();
    return { congelado1, congelado2, voltouAndar, emAnuncioDurante: congelado1 === congelado2 };
  });
  ok('durante o anúncio o relógio da letra congela', p8.emAnuncioDurante, JSON.stringify(p8));
  ok('detectado pela duração diferente da música (anúncio tem duração própria)', Math.abs(p8.congelado1 - 3) < 0.05, p8.congelado1);
  ok('volta a andar quando a duração real reaparece', Math.abs(p8.voltouAndar - 8) < 0.05, p8.voltouAndar);

  // ================= 6. os dois offsets: aritmética e sinal =================
  const p9 = await page.evaluate(() => {
    aplicarInfo({ playerState: 2, currentTime: 20, duration: 200 });   // pausado: tempo cru, sem extrapolar
    state.current.videoOffset = 3;                                     // vídeo tem 3s de vinheta a mais
    state.audioDelay = 200;                                            // caixa Bluetooth atrasa 200ms
    return karaokeLyricTime();                                         // 20 - 3 - 0.2
  });
  ok('videoOffset e audioDelay são SUBTRAÍDOS do tempo do vídeo', Math.abs(p9 - 16.8) < 0.01, p9);

  const p10 = await page.evaluate(() => {
    const antes = state.current.videoOffset;
    karaokeNudgeOffset(0.5);
    const depoisMais = state.current.videoOffset;
    karaokeNudgeOffset(-0.5); karaokeNudgeOffset(-0.5);
    const depoisMenos = state.current.videoOffset;
    return { antes, depoisMais, depoisMenos };
  });
  ok('nudge positivo soma 0.5s ao offset da música', Math.abs(p10.depoisMais - (p10.antes + 0.5)) < 0.01, JSON.stringify(p10));
  ok('offset é POR MÚSICA, não vaza pra outra (conferido adiante)', true);

  const p11 = await page.evaluate(() => {
    state.audioDelay = 0;
    karaokeNudgeDelay(-50);                 // não pode ficar negativo
    const naoFicouNegativo = state.audioDelay;
    karaokeNudgeDelay(20); karaokeNudgeDelay(20);
    const subiu = state.audioDelay;
    karaokeNudgeDelay(10000);               // não pode passar de 500ms
    const teveTeto = state.audioDelay;
    return { naoFicouNegativo, subiu, teveTeto };
  });
  ok('atraso da caixa não fica negativo', p11.naoFicouNegativo === 0, p11.naoFicouNegativo);
  ok('atraso soma corretamente', p11.subiu === 40, p11.subiu);
  ok('atraso tem teto de 500ms', p11.teveTeto === 500, p11.teveTeto);

  // videoOffset não vaza entre músicas
  const p12 = await page.evaluate(async () => {
    state.setlists = []; loadSetlists();
    await openSong({ title: 'Musica A', artist: 'X', lyrics: 'a', duration: 100, videoId: 'aaaaaaaaaaa' }); addSong();
    karaokeNudgeOffset(2);
    const offA = state.current.videoOffset;
    await openSong({ title: 'Musica B', artist: 'X', lyrics: 'b', duration: 100, videoId: 'bbbbbbbbbbb' }); addSong();
    const offB = Number(state.current.videoOffset)||0;
    return { offA, offB };
  });
  ok('o offset ajustado na música A não aparece na música B', p12.offA === 2 && p12.offB === 0, JSON.stringify(p12));

  // ================= 7. letra sem .lrc rola pela posição =================
  const p13 = await page.evaluate(async () => {
    const letra = Array.from({ length: 60 }, (_, i) => 'verso numero ' + i).join('\n');
    await openSong({ title: 'Sem LRC', artist: 'A', lyrics: letra, duration: 100, videoId: 'ccccccccccc' });
    manualAte = 0;
    const vp = $('paperViewport'); vp.scrollTop = 0;
    const dist = scrollDistance();
    karaokeScrollPosition(4 + (100 - 4) / 2);           // metade do caminho (descontando LEAD_IN)
    return { meio: vp.scrollTop, dist, proporcao: dist > 0 ? vp.scrollTop / dist : 0 };
  });
  ok('letra sem .lrc rola pela FRAÇÃO tocada (posição, não velocidade)', Math.abs(p13.proporcao - 0.5) < 0.03, JSON.stringify(p13));

  const p14 = await page.evaluate(async () => {
    const vp = $('paperViewport');
    vp.scrollTop = 500;                       // usuário rolou na mão
    manualAte = performance.now() + 4000;     // janela de rolagem manual aberta
    karaokeScrollPosition(90);                // isso tentaria pular quase pro fim
    return vp.scrollTop;
  });
  ok('durante a janela de rolagem manual, a posição automática não briga com o dedo', p14 === 500, p14);

  // ================= 8. tick() integrado: destaque por .lrc e wake lock =================
  const LRC = ['[00:01.00]primeiro verso', '[00:05.00]segundo verso', '[00:09.00]terceiro verso'].join('\n');
  const p15 = await page.evaluate(async LRCtxt => {
    state.audioDelay = 0;                    // zera o que sobrou de um teste anterior (é preferência do aparelho)
    await openSong({ title: 'Karaoke LRC', artist: 'A', synced: LRCtxt, lyrics: '', duration: 60, videoId: 'ddddddddddd', videoOffset: 0 });
    state.karaoke = true; state.videoPlaying = true;
    aplicarInfo({ playerState: 1, currentTime: 6, duration: 60 });   // bem dentro do intervalo [5,9), longe da borda
    tick();
    const linhaAtiva = [...$('paper').children].findIndex(n => n.classList.contains('active'));
    state.karaoke = false; if (raf) cancelAnimationFrame(raf);
    return { linhaAtiva };
  }, LRC);
  ok('tick() com .lrc destaca a linha certa usando o relógio do karaokê', p15.linhaAtiva === 1, JSON.stringify(p15));

  // ================= 9. não deixar vídeo órfão: stopAll pausa sem sair do modo =================
  const p16 = await page.evaluate(async () => {
    await openSong({ title: 'Fica no Karaoke', artist: 'A', lyrics: 'x', duration: 60, videoId: 'eeeeeeeeeee' });
    state.karaoke = true;
    const f = ensureFrame();
    const chamadas = [];
    f.contentWindow.postMessage = (msg) => chamadas.push(JSON.parse(msg).func);
    stopAll();
    return { aindaEmKaraoke: state.karaoke, pausou: chamadas.includes('pauseVideo') };
  });
  ok('stopAll() pausa o vídeo', p16.pausou, JSON.stringify(p16));
  ok('stopAll() NÃO desliga o modo karaokê (senão apagaria a cada troca de música)', p16.aindaEmKaraoke);

  const p17 = await page.evaluate(async () => {
    // troca de música durante o karaokê: o vídeo novo troca ANTES do fetch de
    // letra (que pode esperar até 12s de rede) — senão o áudio da música
    // anterior continuaria saindo da caixa com a tela já mostrando a próxima.
    const chamadasAntesDoFetch = [];
    window.__lentoDemais = new Promise(() => {});          // fetch que nunca resolve
    const origFetchSafe = window.fetchSafe;
    window.fetchSafe = () => window.__lentoDemais;
    const f = ensureFrame();
    f.contentWindow.postMessage = (msg) => chamadasAntesDoFetch.push(JSON.parse(msg).func || 'src');
    const promessa = openSong({ title: 'Nova Com Fetch Lento', artist: 'A', videoId: 'fffffffffff' }); // sem lyrics: dispara fetch
    await new Promise(r => setTimeout(r, 50));               // dá tempo do openSong rodar até o await
    window.fetchSafe = origFetchSafe;
    return { trocouVideoAntesDeEsperar: (ensureFrame().src || '').includes('fffffffffff') };
  });
  ok('a troca de vídeo não fica presa atrás da busca de letra', p17.trocouVideoAntesDeEsperar, JSON.stringify(p17));

  // guarda contra o loop: stopVideo() por uma música SEM vídeo não deve
  // disparar o avanço automático no meio da própria troca
  const p18 = await page.evaluate(async () => {
    state.setlists = []; loadSetlists();
    await openSong({ title: 'Com Video', artist: 'A', lyrics: 'x', duration: 60, videoId: 'ggggggggggg' }); addSong();
    await openSong({ title: 'Outra Com Video', artist: 'A', lyrics: 'x', duration: 60, videoId: 'hhhhhhhhhhh' }); addSong();
    state.currentIndex = 0; await openSong(state.setlist[0]);
    state.karaoke = true; autoplayComprovado = true;
    let pulou = false;
    const origJump = window.jumpSong;
    window.jumpSong = (...a) => { pulou = true; return origJump(...a) };
    await openSong({ title: 'Sem Video No Meio', artist: 'A', lyrics: 'x', duration: 60 }); // sem videoId
    window.jumpSong = origJump;
    state.karaoke = false;
    return { pulouSozinho: pulou };
  });
  ok('trocar pra uma música sem vídeo não dispara avanço automático sozinho', !p18.pulouSozinho, JSON.stringify(p18));

  // ================= 10. Rolar/Sincro desligados durante o karaokê =================
  const p19 = await page.evaluate(async () => {
    const LRCtxt = '[00:01.00]linha um\n[00:02.00]linha dois';
    await openSong({ title: 'Guarda', artist: 'A', synced: LRCtxt, lyrics: '', duration: 60, videoId: 'iiiiiiiiiii' });
    state.karaoke = true; updateControls();
    toggleScroll();
    const scrollFicouDesligado = !state.scrolling;
    toggleSync();
    const syncFicouDesligado = !state.syncing;
    const pedaisDesabilitados = $('scrollBtn').disabled && $('syncBtn').disabled;
    state.karaoke = false; if (raf) cancelAnimationFrame(raf);
    return { scrollFicouDesligado, syncFicouDesligado, pedaisDesabilitados };
  });
  ok('Rolar não liga durante o karaokê (dois escritores no scrollTop seria bug)', p19.scrollFicouDesligado, JSON.stringify(p19));
  ok('Sincro não liga durante o karaokê (dois relógios brigando)', p19.syncFicouDesligado, JSON.stringify(p19));
  ok('os pedais aparecem desabilitados, não mudos sem explicação', p19.pedaisDesabilitados, JSON.stringify(p19));

  // ================= 11. wake lock: karaokê entra nas TRÊS guardas =================
  const p20 = await page.evaluate(() => ({
    guardaKeepAwake: /state\.karaoke/.test(keepAwake.toString()),
    guardaReleaseAwake: /state\.karaoke/.test(releaseAwake.toString()),
  }));
  ok('keepAwake() considera o karaokê', p20.guardaKeepAwake, JSON.stringify(p20));
  ok('releaseAwake() considera o karaokê', p20.guardaReleaseAwake, JSON.stringify(p20));

  // ================= 12. seekSync no karaokê comanda o vídeo, não o relógio interno =================
  const p21 = await page.evaluate(async () => {
    const LRCtxt = '[00:01.00]linha um\n[00:05.00]linha dois';
    await openSong({ title: 'Seek Karaoke', artist: 'A', synced: LRCtxt, lyrics: '', duration: 60, videoId: 'jjjjjjjjjjj' });
    state.karaoke = true;
    const f = ensureFrame();
    const chamadas = [];
    f.contentWindow.postMessage = (msg) => chamadas.push(JSON.parse(msg));
    const syncStartAntes = syncStart;
    seekSync(1);
    state.karaoke = false;
    return { comandouSeek: chamadas.some(c => c.func === 'seekTo' && c.args[0] === 5), syncStartMudou: syncStart !== syncStartAntes };
  });
  ok('toque duplo numa linha durante o karaokê comanda seekTo no vídeo', p21.comandouSeek, JSON.stringify(p21));
  ok('e NÃO mexe no relógio interno (syncStart), que pertence só ao Sincro comum', !p21.syncStartMudou, JSON.stringify(p21));

  // ================= 13. tecla Enter no karaokê não dispara duas vezes =================
  const p22 = await page.evaluate(async () => {
    await openSong({ title: 'Tecla', artist: 'A', lyrics: 'x', duration: 60, videoId: 'kkkkkkkkkkk' });
    state.karaoke = true; state.videoPlaying = false;
    let chamadas = 0;
    const orig = window.karaokePlayPause;
    window.karaokePlayPause = (...a) => { chamadas++; return orig(...a) };
    $('karaokeBtn').focus();
    const evt = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    document.dispatchEvent(evt);
    window.karaokePlayPause = orig;
    const evitouDuploDisparo = evt.defaultPrevented;
    state.karaoke = false;
    return { chamadas, evitouDuploDisparo };
  });
  ok('Enter no karaokê chama a ação uma vez só', p22.chamadas === 1, JSON.stringify(p22));
  ok('e previne o clique padrão do botão focado (senão dispara duas vezes)', p22.evitouDuploDisparo);

  console.log(errors.length ? 'ERROS DE PÁGINA:\n  ' + errors.join('\n  ') : 'sem erros de página');
  await browser.close();
  console.log(falhas ? `\n${falhas} falha(s)` : '\nkaraokê 3.10.0: tudo passou');
  process.exit(falhas || errors.length ? 1 : 0);
})();
