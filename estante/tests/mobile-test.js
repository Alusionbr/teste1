const { chromium } = require('./playwright.js');
const BASE = 'http://localhost:8777/estante/';
const L = 'C       G\nera uma vez uma canção\n[Refrão]\nAm      F\nque a banda tocava no bar\n[Solo]\nC G Am F\n[Final]\nfim';
let falhas = 0;
const ok = (nome, cond, extra = '') => { console.log((cond ? 'ok    ' : 'FALHA ') + nome + (extra ? ' — ' + extra : '')); if (!cond) falhas++; };

const APARELHOS = [['iPhone SE', 375, 667], ['iPhone 14', 390, 844], ['Android pequeno', 360, 800], ['iPad retrato', 768, 1024]];

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  for (const [nome, width, height] of APARELHOS) {
    const ctx = await browser.newContext({ viewport: { width, height }, isMobile: width < 700, hasTouch: true });
    const p = await ctx.newPage();
    p.on('pageerror', e => errors.push(`${nome}: ${e.message}`));
    await p.goto(BASE, { waitUntil: 'load' });
    await p.waitForFunction(() => typeof openSong === 'function' && typeof toggleAuto === 'function');
    await p.evaluate(() => localStorage.clear());
    await p.waitForTimeout(800);
    await p.evaluate(async l => {
      await openSong({ title: 'Canção do Bar da Esquina', artist: 'Trio da Esquina', lyrics: l, duration: 214 });
      addSong(); saveSongNotes('entra em Ré · 2ª voz no refrão');
      await openSong({ title: 'Outra', artist: 'Trio', lyrics: l, duration: 180 }); addSong();
      await openSong(state.setlist[0]); state.currentIndex = 0;
      // 3.12.0: a pedaleira agora é opcional e o padrão é o modo toque. Este
      // arquivo mede o LAYOUT DA PEDALEIRA no celular, então liga o modo em
      // que ela existe. O modo toque tem verificação própria, logo abaixo.
      setPedalMode('pedaleira');
    }, L);
    await p.waitForTimeout(400);

    const m = await p.evaluate(() => {
      const vis = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.left >= -1 && r.right <= innerWidth + 1 };
      const alcancavel = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 };
      const toque = el => { const r = el.getBoundingClientRect(); return Math.min(r.width, r.height) };
      return {
        titulo: Math.round(document.getElementById('songTitle').getBoundingClientRect().width),
        tituloVisivel: vis(document.getElementById('songTitle')),
        rolar: vis(document.getElementById('scrollBtn')),
        prev: vis(document.getElementById('prevBtn')),
        next: vis(document.getElementById('nextBtn')),
        header: Math.round(document.querySelector('.songHeader').getBoundingClientRect().height),
        rotulo: getComputedStyle(document.querySelector('.control span')).display !== 'none',
        // nenhum botão da pedaleira pode ser menor que 44px no menor lado
        menorPedal: Math.min(...[...document.querySelectorAll('.transport .pedal')].map(toque)),
        // largura do documento não pode passar da tela (sem rolagem horizontal)
        estouraLargura: document.documentElement.scrollWidth > innerWidth + 1,
        notasLargura: Math.round(document.getElementById('songNotes').getBoundingClientRect().width),
        secoes: document.querySelectorAll('#sectionBar button:not(.secLoop):not(.secVoz)').length,
        // "Tela cheia" some de propósito no celular: no iOS o requestFullscreen
        // não funciona fora de vídeo e o botão não faria nada. Todo o resto
        // precisa continuar alcançável (a fileira rola de lado).
        acoesTodasAlcancaveis: [...document.querySelectorAll('.headerActions button')]
          .filter(b => getComputedStyle(b).display !== 'none').every(alcancavel),
      };
    });

    console.log(`\n— ${nome} (${width}×${height})`);
    ok('  título tem largura utilizável', m.titulo >= 120 && m.tituloVisivel, `${m.titulo}px`);
    ok('  Rolar, ‹ e › visíveis sem arrastar', m.rolar && m.prev && m.next, JSON.stringify({ r: m.rolar, p: m.prev, n: m.next }));
    ok('  cabeçalho em uma linha', m.header <= 70, `${m.header}px`);
    ok('  rótulos dos controles à vista', m.rotulo);
    ok('  pedais com alvo de toque ≥ 44px', m.menorPedal >= 44, `${m.menorPedal}px`);
    ok('  página não rola de lado', !m.estouraLargura);
    ok('  faixa de anotações ocupa a largura', m.notasLargura > width * 0.8, `${m.notasLargura}px de ${width}`);
    ok('  seções listadas', m.secoes === 3, String(m.secoes));
    ok('  todas as ações do cabeçalho existem', m.acoesTodasAlcancaveis);

    // diálogo grande cabe e rola dentro da tela
    await p.evaluate(() => openSongEditor());
    await p.waitForTimeout(250);
    const d = await p.evaluate(() => {
      const dl = document.getElementById('editDialog'), r = dl.getBoundingClientRect();
      return { cabe: r.height <= innerHeight + 1, rola: getComputedStyle(dl).overflowY, botao: !!dl.querySelector('.accent') };
    });
    ok('  editor cabe na tela', d.cabe);
    ok('  editor rola por dentro se precisar', d.rola === 'auto' || d.rola === 'scroll', d.rola);
    await p.evaluate(() => document.getElementById('editDialog').close());

    await ctx.close();
  }

  console.log(errors.length ? '\nERROS DE PÁGINA:\n  ' + errors.join('\n  ') : '\nsem erros de página');
  await browser.close();
  console.log(falhas ? `\n${falhas} falha(s)` : '\nmobile ok');
  process.exit(falhas || errors.length ? 1 : 0);
})();
