// Estante 3.9.0 — as tres decisoes: toque duplo, parser de LRC e link com letra.
const { chromium } = require('./playwright.js');
const BASE = 'http://localhost:8777/estante/';
let falhas = 0;
const ok = (n, c, e = '') => { console.log((c ? 'ok    ' : 'FALHA ') + n + (e ? ' — ' + e : '')); if (!c) falhas++; };

const LRC = [
  '[ar:Fulano]', '[ti:Teste]', '[offset:0]',
  '[00:01.00][Refrao]',
  '[00:02.00]C       G',
  '[00:04.00]primeiro verso da musica',
  '[00:08.00]',
  '[00:10.00][Solo]',
  '[00:12.00]Am      F',
  '[00:16.00]segundo verso da musica',
].join('\n');

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

  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof openSong === 'function' && typeof tapSyncLine === 'function');
  await page.evaluate(() => localStorage.clear());
  await page.waitForTimeout(300);

  // ================= 1. parser de LRC =================
  const p1 = await page.evaluate(LRCtxt => {
    const l = parseLRC(LRCtxt);
    return { n: l.length, textos: l.map(x => x.text) };
  }, LRC);
  ok('cabecalhos [ar:]/[ti:]/[offset:] nao viram linha', p1.n === 7, JSON.stringify(p1));
  ok('[Refrao] sobrevive ao parser de LRC', p1.textos.includes('[Refrao]') && p1.textos.includes('[Solo]'), JSON.stringify(p1.textos));

  const p2 = await page.evaluate(async LRCtxt => {
    await openSong({ title: 'Sincronizada', artist: 'A', synced: LRCtxt, lyrics: '', duration: 60 });
    return {
      tipos: state.lines.map(l => l.type),
      secoes: state.lines.filter(l => l.type === 'section').map(l => l.text),
      barraVisivel: !$('sectionBar').hidden,
      // 3.13.0: a tira ganhou ⟳ (repetir trecho) e, em música com naipe, o
      // botão de voz. A asserção é sobre as SEÇÕES, então eles ficam de fora.
      botoesSecao: [...$('sectionBar').querySelectorAll('button:not(.secLoop):not(.secVoz)')].map(b => b.textContent),
      tomVisivel: !$('keyControl').hidden,
      capoVisivel: !$('capoControl').hidden,
      sincroLigavel: !$('syncBtn').disabled,
    };
  }, LRC);
  ok('letra .lrc reconhece cifra', p2.tipos.filter(t => t === 'chord').length === 2, JSON.stringify(p2.tipos));
  ok('letra .lrc reconhece secao', p2.secoes.join('|') === 'Refrao|Solo', JSON.stringify(p2.secoes));
  ok('tira de secoes aparece em musica sincronizada', p2.barraVisivel && p2.botoesSecao.join('|') === 'Refrao|Solo', JSON.stringify(p2.botoesSecao));
  ok('controles de Tom e Capo aparecem em .lrc com cifra', p2.tomVisivel && p2.capoVisivel, JSON.stringify(p2));
  ok('o botao Sincro continua habilitado', p2.sincroLigavel);

  const p3 = await page.evaluate(() => {
    const antes = [...$('paper').querySelectorAll('.chord')].map(e => e.textContent);
    changeKey(2);
    const depois = [...$('paper').querySelectorAll('.chord')].map(e => e.textContent);
    changeCapo(1);
    const comCapo = [...$('paper').querySelectorAll('.chord')].map(e => e.textContent);
    changeKey(-2); changeCapo(-1);
    return { antes, depois, comCapo };
  });
  ok('transpor funciona em letra sincronizada', /^D\s+A$/.test(p3.depois[0]) && /^Bm\s+G$/.test(p3.depois[1] || ''), JSON.stringify(p3.depois));
  ok('capotraste desloca as cifras da letra sincronizada', /^C#\s+G#$/.test(p3.comCapo[0]), JSON.stringify(p3.comCapo));

  // ================= 2. toque na letra sincronizada =================
  const t1 = await page.evaluate(async () => {
    state.syncing = false; syncOffset = 0; pausouNoToque = false; ultimaLinhaTocada = -1; ultimaDicaEm = -Infinity;
    const linhas = $('paper').children;
    linhas[5].click();                       // um toque so, sincronia desligada
    await new Promise(r => setTimeout(r, 30));
    return { syncing: state.syncing, offset: syncOffset, dica: $('notice').textContent };
  });
  ok('um toque nao liga a sincronia sozinho', t1.syncing === false && t1.offset === 0, JSON.stringify(t1));
  ok('um toque explica como reposicionar', /duas vezes/i.test(t1.dica), t1.dica);

  const t2 = await page.evaluate(async () => {
    const linhas = $('paper').children;
    linhas[5].click(); linhas[5].click();    // toque duplo na mesma linha
    await new Promise(r => setTimeout(r, 30));
    return { syncing: state.syncing, offset: Math.round(syncOffset) };
  });
  ok('toque duplo reposiciona e comeca dali', t2.syncing === true && t2.offset === 12, JSON.stringify(t2));

  const t3 = await page.evaluate(async () => {
    // com a sincronia rodando, encostar na letra pausa em vez de saltar
    const antes = Math.round(syncOffset);
    const linhas = $('paper').children;
    linhas[2].dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    linhas[2].click();
    await new Promise(r => setTimeout(r, 30));
    return { syncing: state.syncing, antes, depois: Math.round(syncOffset) };
  });
  ok('encostar na letra pausa a sincronia', t3.syncing === false, JSON.stringify(t3));
  ok('encostar nao salta o tempo da musica', Math.abs(t3.depois - t3.antes) <= 1, JSON.stringify(t3));

  const t4 = await page.evaluate(async () => {
    const linhas = $('paper').children;
    linhas[5].click();                       // toque 1
    await new Promise(r => setTimeout(r, 600));
    linhas[5].click();                       // toque 2, tarde demais
    await new Promise(r => setTimeout(r, 30));
    return { syncing: state.syncing };
  });
  ok('dois toques lentos nao contam como toque duplo', t4.syncing === false, JSON.stringify(t4));

  const t5 = await page.evaluate(async () => {
    // ir ao Solo com a sincronia rodando move o relogio, senao ela volta sozinha
    state.syncing = false; toggleSync();
    scrollToLine(state.lines.findIndex(l => l.text === 'Solo'));
    await new Promise(r => setTimeout(r, 30));
    const comSync = Math.round(syncOffset);
    stopAll();
    return { comSync };
  });
  ok('atalho de secao move o relogio quando a sincronia esta ligada', t5.comSync === 10, JSON.stringify(t5));

  const t6 = await page.evaluate(async () => {
    // com a rolagem ligada, o salto tem de ser instantaneo (smooth briga com o tick)
    const letra = Array.from({ length: 60 }, (_, i) => (i === 40 ? '[Final]' : 'linha ' + i)).join('\n');
    await openSong({ title: 'Longa', artist: 'A', lyrics: letra, duration: 300 });
    const vp = $('paperViewport'); vp.scrollTop = 0;
    state.scrolling = true;
    scrollToLine(40);
    const logoDepois = vp.scrollTop;         // sem esperar animacao nenhuma
    state.scrolling = false;
    return { logoDepois };
  });
  ok('atalho de secao salta na hora com a rolagem ligada', t6.logoDepois > 100, JSON.stringify(t6));

  // ================= 3. link com letra =================
  const s1 = await page.evaluate(async LRCtxt => {
    state.setlists = []; loadSetlists();
    await openSong({ title: 'Com letra', artist: 'A', lyrics: 'verso um\nverso dois', duration: 100 }); addSong();
    changeKey(3);
    await openSong({ title: 'Sincronizada', artist: 'B', synced: LRCtxt, lyrics: '', duration: 60 }); addSong();
    const completo = await makeShareUrl(true), simples = await makeShareUrl(false);
    return { completo: completo.length, simples: simples.length, zip: completo.startsWith(location.origin + location.pathname + '#setlistz='), url: completo };
  }, LRC);
  ok('o link completo usa a compactacao nativa do navegador', s1.zip, s1.completo + ' caracteres');
  ok('o link completo e maior que o de so a ordem', s1.completo > s1.simples, JSON.stringify({ completo: s1.completo, simples: s1.simples }));

  const s2 = await page.evaluate(async url => {
    const dados = await unpackShare(url.slice((location.origin + location.pathname).length));
    return { v: dados.v, comLetras: dados.comLetras, n: dados.songs.length, letra: dados.songs[0].lyrics, sync: !!dados.songs[1].synced, tom: dados.songs[0].key };
  }, s1.url);
  ok('a letra viaja no link', /verso um/.test(s2.letra || '') && s2.sync, JSON.stringify(s2));
  ok('tom por musica viaja junto', s2.tom === 3, JSON.stringify(s2));

  const s3 = await page.evaluate(async () => {
    const simples = await makeShareUrl(false);
    const dados = await unpackShare(simples.slice((location.origin + location.pathname).length));
    return { letra: dados.songs[0].lyrics, tom: dados.songs[0].key, comLetras: dados.comLetras };
  });
  ok('"so a ordem" nao leva letra mas leva o tom', !s3.letra && s3.tom === 3 && s3.comLetras === false, JSON.stringify(s3));

  const s4 = await page.evaluate(async () => {
    await openShareDialog();
    await new Promise(r => setTimeout(r, 200));
    const aberto = $('shareDialog').open, resumo = $('shareSummary').textContent;
    $('shareDialog').close();
    return { aberto, resumo };
  });
  ok('compartilhar pergunta antes, mostrando o tamanho', s4.aberto && /com letra guardada/.test(s4.resumo), s4.resumo);

  const s5 = await page.evaluate(async () => {
    // repertorio grande: o aviso de link longo precisa aparecer
    const rnd = n => Array.from({ length: n }, () => Math.random().toString(36).slice(2, 9)).join(' ');
    for (let i = 0; i < 30; i++) {
      const letrao = Array.from({ length: 45 }, () => rnd(9)).join('\n');
      await openSong({ title: 'Musica ' + i, artist: 'Banda', lyrics: letrao, duration: 200 }); addSong();
    }
    await openShareDialog();
    await new Promise(r => setTimeout(r, 400));
    const r = { avisou: !$('shareWarn').hidden, texto: $('shareWarn').textContent, tam: (await makeShareUrl(true)).length, limite: LINK_LONGO };
    $('shareDialog').close();
    return r;
  });
  ok('avisa quando o link fica longo demais para colar', s5.tam > s5.limite && s5.avisou && /cortam/.test(s5.texto), JSON.stringify({ tam: s5.tam, limite: s5.limite }));

  // ler um link recebido: letra chega inteira e o dialogo diz isso
  const s6url = await page.evaluate(async () => {
    localStorage.clear(); state.setlists = []; loadSetlists();
    await openSong({ title: 'Recebida', artist: 'C', lyrics: 'linha vinda do link', duration: 90 }); addSong();
    return makeShareUrl(true);
  });
  const page2 = await ctx.newPage();
  page2.on('pageerror', e => errors.push('p2: ' + e.message));
  await page2.goto(s6url, { waitUntil: 'load' });
  await page2.waitForFunction(() => typeof readSharedLink === 'function');
  await page2.waitForTimeout(500);
  const s6 = await page2.evaluate(() => ({
    aberto: $('sharedDialog').open,
    resumo: $('sharedSummary').textContent,
    detalhe: $('sharedDetail').textContent,
    letra: (incomingSetlist || []).map(x => x.lyrics).join(''),
  }));
  ok('link recebido abre o dialogo com a letra dentro', s6.aberto && /linha vinda do link/.test(s6.letra), JSON.stringify(s6));
  ok('o dialogo avisa que as letras vieram junto', /sem internet/.test(s6.detalhe), s6.detalhe);

  // link no formato antigo (v1, sem compactacao) ainda tem de abrir
  const s7 = await page2.evaluate(async () => {
    const payload = { v: 1, name: 'Antigo', songs: [{ title: 'Velha', artist: 'D', album: '', duration: 0 }] };
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    let bin = ''; bytes.forEach(b => bin += String.fromCharCode(b));
    const hash = '#setlist=' + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    history.replaceState(null, '', location.pathname + hash);
    const lista = await readSharedLink();
    return { n: lista ? lista.length : 0, titulo: lista && lista[0].title, detalhe: (showIncomingSetlist(lista), $('sharedDetail').textContent) };
  });
  ok('link antigo (v1) continua abrindo', s7.n === 1 && s7.titulo === 'Velha', JSON.stringify(s7));
  ok('e avisa que ele nao trouxe letra', /so a ordem|só a ordem/i.test(s7.detalhe), s7.detalhe);

  console.log(errors.length ? 'ERROS DE PÁGINA:\n  ' + errors.join('\n  ') : 'sem erros de página');
  await browser.close();
  console.log(falhas ? `\n${falhas} falha(s)` : '\n3.9.0: tudo passou');
  process.exit(falhas || errors.length ? 1 : 0);
})();
