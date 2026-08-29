const { chromium } = require('./playwright.js');
const BASE = 'http://localhost:8777/estante/';
const CIFRA = 'C       G\nera uma vez uma canção\n[Refrão]\nAm      F\nque a banda tocava no bar\n[Solo]\nC G Am F\n[Final]\nfim';
let falhas = 0;
const ok = (nome, cond, extra = '') => { console.log((cond ? 'ok    ' : 'FALHA ') + nome + (extra ? ' — ' + extra : '')); if (!cond) falhas++; };

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  const pronto = () => page.waitForFunction(() => typeof openSong === 'function' && typeof toggleAuto === 'function', null, { timeout: 15000 });
  const fresh = async () => {
    await page.goto(BASE, { waitUntil: 'load' });
    await pronto();
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'load' });
    await pronto();
    // 3.12.0: a pedaleira virou opcional e o padrao e o modo toque, em que ela
    // sai da tela. Esta suite mexe nos controles da barra (#autoBtn, +/- da
    // velocidade), entao liga o modo em que eles ficam a vista.
    await page.evaluate(() => setPedalMode('pedaleira'));
    await page.waitForTimeout(150);
  };

  // ---------- 1. Importação não pode apagar sem perguntar ----------
  await fresh();
  await page.evaluate(c => {
    openSong({ title: 'Minha Musica', artist: 'Banda A', lyrics: c, duration: 200 }); addSong();
    renameSetlist(state.activeSetlistId, 'Show do sabado');
  }, CIFRA);

  const arquivo = await page.evaluate(() => JSON.stringify({
    version: 3, activeId: 'x1',
    setlists: [{ id: 'x1', name: 'Importado', date: '', songs: [{ title: 'Outra', artist: 'Banda B', lyrics: 'la la', duration: 100 }] }]
  }));
  const enviar = async () => {
    await page.setInputFiles('#importFile', { name: 'r.json', mimeType: 'application/json', buffer: Buffer.from(arquivo) });
    await page.waitForTimeout(400);
  };

  await enviar();
  ok('importar abre o diálogo em vez de apagar', await page.locator('#importDialog[open]').count() === 1);
  const aviso = await page.locator('#importWarning').innerText();
  ok('o diálogo diz o que seria apagado', /1 repertório e 1 música/.test(aviso), aviso);

  await page.click('#importAddBtn');
  await page.waitForTimeout(300);
  const depoisAdd = await page.evaluate(() => ({ n: state.setlists.length, nomes: state.setlists.map(s => s.name) }));
  ok('Adicionar mantém o repertório existente', depoisAdd.n === 2 && depoisAdd.nomes.includes('Show do sabado'), JSON.stringify(depoisAdd));

  await enviar();
  await page.click('#importReplaceBtn');
  await page.waitForTimeout(300);
  const depoisRepl = await page.evaluate(() => ({ n: state.setlists.length, nomes: state.setlists.map(s => s.name) }));
  ok('Substituir troca tudo, só depois de confirmar', depoisRepl.n === 1 && depoisRepl.nomes[0] === 'Importado', JSON.stringify(depoisRepl));

  // fechar no × não pode importar nada
  await enviar();
  await page.click('#importCloseBtn');
  await page.waitForTimeout(200);
  ok('fechar o diálogo não importa nada', await page.evaluate(() => state.setlists.length) === 1);

  // ---------- 2. Gravação adiada ----------
  await fresh();
  await page.evaluate(c => { openSong({ title: 'Cancao', artist: 'Trio', lyrics: c, duration: 240 }); addSong(); }, CIFRA);
  const gravacoes = await page.evaluate(async () => {
    let n = 0;
    const real = Storage.prototype.setItem;
    Storage.prototype.setItem = function (...a) { n++; return real.apply(this, a); };
    for (let i = 0; i < 8; i++) changeSpeed(2);
    const durante = n;
    await new Promise(r => setTimeout(r, 1100));
    const depois = n;
    Storage.prototype.setItem = real;
    return { durante, depois, speed: state.speed };
  });
  ok('8 cliques na velocidade não gravam 8 vezes', gravacoes.durante === 0, JSON.stringify(gravacoes));
  ok('a gravação acontece depois, uma vez', gravacoes.depois >= 1 && gravacoes.depois <= 2, JSON.stringify(gravacoes));

  await page.reload({ waitUntil: 'load' });
  await pronto();
  const persistiu = await page.evaluate(() => { state.tab = 'setlist'; renderList(); return state.setlist[0].speed; });
  ok('a velocidade ajustada sobrevive ao reload', persistiu === gravacoes.speed, `salvo ${persistiu}, esperado ${gravacoes.speed}`);

  // velocidade de uma música não vaza para as outras
  const vazou = await page.evaluate(c => {
    const antes = state.speedGlobal;
    openSong(state.setlist[0]); changeSpeed(10);
    return { antes, depois: state.speedGlobal };
  }, CIFRA);
  ok('ajustar uma música não muda o padrão das outras', vazou.antes === vazou.depois, JSON.stringify(vazou));

  // ---------- 3. Velocidade automática ----------
  await fresh();
  const auto = await page.evaluate(c => {
    const letra = (c + '\n').repeat(40);
    openSong({ title: 'Longa', artist: 'Trio', lyrics: letra, duration: 300 }); addSong();
    toggleAuto();
    return { auto: state.auto, speed: state.speed, dist: scrollDistance() };
  }, CIFRA);
  ok('auto liga e calcula uma velocidade', auto.auto === true && auto.speed > 0, JSON.stringify(auto));
  const esperado = Math.round(auto.dist / (300 - 4));
  ok('a velocidade bate com a duração', Math.abs(auto.speed - esperado) <= 1, `calculado ${auto.speed}, esperado ${esperado}`);

  const aposFonte = await page.evaluate(() => { const antes = state.speed; document.querySelector('[data-font="2"]').click(); return { antes, depois: state.speed } });
  ok('mudar o tamanho da letra recalcula', aposFonte.depois !== aposFonte.antes || aposFonte.depois > 0, JSON.stringify(aposFonte));

  const desliga = await page.evaluate(() => { changeSpeed(2); return state.auto });
  ok('mexer no +/− desliga o automático', desliga === false);

  // sem duração: pergunta em vez de falhar
  await page.evaluate(c => openSong({ title: 'Sem duracao', artist: 'Trio', lyrics: (c + '\n').repeat(40), duration: 0 }), CIFRA);
  await page.click('#autoBtn');
  await page.waitForTimeout(250);
  ok('sem duração, o app pergunta', await page.locator('#durationDialog[open]').count() === 1);
  await page.fill('#durationInput', '3:20');
  await page.click('#durationForm .accent');
  await page.waitForTimeout(300);
  const comDuracao = await page.evaluate(() => ({ d: state.current.duration, auto: state.auto, speed: state.speed }));
  ok('a duração digitada liga o automático', comDuracao.d === 200 && comDuracao.auto === true && comDuracao.speed > 0, JSON.stringify(comDuracao));

  // ---------- 4. Editar a letra ----------
  await fresh();
  await page.evaluate(c => {
    openSong({ title: 'Para Corrigir', artist: 'Trio', lyrics: c, duration: 200 }); addSong();
    changeKey(2); changeCapo(1); saveSongNotes('entra em Re');
  }, CIFRA);
  await page.click('#editBtn');
  await page.waitForTimeout(200);
  ok('o editor abre com a letra atual', (await page.inputValue('#editText')).includes('era uma vez'));
  await page.fill('#editText', 'C\nverso corrigido na mao\n[Refrão]\nrefrao novo\n[Final]\nfim');
  await page.click('#editForm .accent');
  await page.waitForTimeout(400);
  const editado = await page.evaluate(() => ({
    letra: state.setlist[0].lyrics, key: state.setlist[0].key, capo: state.setlist[0].capo,
    notes: state.setlist[0].notes, n: state.setlist.length, naTela: $('paper').innerText
  }));
  ok('a letra editada foi salva', editado.letra.includes('verso corrigido'), editado.letra.split('\n')[1]);
  ok('não duplicou a música', editado.n === 1);
  ok('tom, capo e anotação sobreviveram', editado.key === 2 && editado.capo === 1 && editado.notes === 'entra em Re', JSON.stringify(editado));
  ok('a tela mostra o texto novo', editado.naTela.includes('verso corrigido'));

  await page.reload({ waitUntil: 'load' });
  await pronto();
  ok('a edição sobrevive ao reload', (await page.evaluate(() => state.setlist[0].lyrics)).includes('verso corrigido'));

  // renomear pela edição não cria órfã
  await page.evaluate(() => { state.tab = 'setlist'; renderList(); openSong(state.setlist[0]); });
  await page.click('#editBtn');
  await page.waitForTimeout(200);
  await page.fill('#editTitle', 'Nome Novo');
  await page.click('#editForm .accent');
  await page.waitForTimeout(300);
  const renomeado = await page.evaluate(() => ({ n: state.setlist.length, t: state.setlist[0].title }));
  ok('renomear pela edição não duplica', renomeado.n === 1 && renomeado.t === 'Nome Novo', JSON.stringify(renomeado));

  // ---------- 5. Seções ----------
  const secoes = await page.evaluate(() => ({
    escondida: $('sectionBar').hidden,
    // 3.13.0: a tira ganhou ⟳ (repetir trecho) e o botao de voz. A asserção
    // abaixo é sobre as SEÇÕES, então eles ficam de fora da contagem.
    botoes: [...$('sectionBar').querySelectorAll('button:not(.secLoop):not(.secVoz)')].map(b => b.textContent)
  }));
  ok('a tira de seções aparece', secoes.escondida === false, JSON.stringify(secoes));
  ok('lista as seções da letra', secoes.botoes.join(',') === 'Refrão,Final', JSON.stringify(secoes.botoes));

  const semSecao = await page.evaluate(() => { openSong({ title: 'Sem secao', artist: '', lyrics: 'so uma linha\ne outra' }); return $('sectionBar').hidden });
  ok('some quando a música não tem seção', semSecao === true);

  console.log(errors.length ? 'ERROS DE PÁGINA:\n  ' + errors.join('\n  ') : 'sem erros de página');
  await browser.close();
  console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo passou');
  process.exit(falhas || errors.length ? 1 : 0);
})();
