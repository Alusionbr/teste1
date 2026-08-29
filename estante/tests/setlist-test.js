const { chromium } = require('./playwright.js');
const BASE = 'http://localhost:8777/estante/';

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  // 1) Migração: deixa um repertório no formato v2 antes de abrir o app.
  await page.goto(BASE);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('estante:v2:setlist', JSON.stringify([
      { title: 'Música Antiga', artist: 'Fulano', lyrics: 'C G\nlinha', duration: 180 }
    ]));
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(500);

  const migr = await page.evaluate(() => ({
    setlists: state.setlists.length,
    nome: state.setlists[0].name,
    musicas: state.setlist.length,
    v3: !!localStorage.getItem('estante:v3:setlists'),
    v2ainda: !!localStorage.getItem('estante:v2:setlist')
  }));
  console.log('migração:', JSON.stringify(migr));

  // 2) Barra aparece na aba Repertório
  await page.click('.tab[data-tab="setlist"]');
  await page.waitForTimeout(200);
  const bar = await page.evaluate(() => ({
    visivel: !document.getElementById('setlistBar').hidden,
    resumo: document.getElementById('setlistSummary').textContent,
    opcoes: document.getElementById('setlistSelect').options.length
  }));
  console.log('barra:', JSON.stringify(bar));

  // 3) Criar segundo repertório pelo diálogo
  await page.click('#setlistNew');
  await page.fill('#setlistName', 'Bar do Zé');
  await page.click('#setlistForm button.accent');
  await page.waitForTimeout(300);
  const criado = await page.evaluate(() => ({
    total: state.setlists.length,
    ativo: activeSetlist().name,
    musicasNoNovo: state.setlist.length
  }));
  console.log('novo repertório:', JSON.stringify(criado));

  // 4) Adiciona música ao novo, troca de repertório e confere isolamento
  await page.evaluate(() => {
    openSong({ title: 'Nova', artist: 'Beltrano', lyrics: 'D A\nletra', duration: 240 });
    addSong();
  });
  await page.waitForTimeout(200);
  const antes = await page.evaluate(() => state.setlist.length);
  await page.selectOption('#setlistSelect', { index: 0 });
  await page.waitForTimeout(200);
  const depois = await page.evaluate(() => ({ nome: activeSetlist().name, n: state.setlist.length }));
  console.log('isolamento: novo tinha', antes, '· ao voltar:', JSON.stringify(depois));

  // 5) Persistência após recarregar
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(500);
  const persist = await page.evaluate(() => ({
    total: state.setlists.length,
    nomes: state.setlists.map(s => s.name + ':' + s.songs.length).join(', '),
    ativo: activeSetlist().name
  }));
  console.log('persistência:', JSON.stringify(persist));

  // 6) Exportar/importar v3 (sem baixar arquivo: usa as funções direto)
  const roundtrip = await page.evaluate(() => {
    const data = { version: 3, activeId: state.activeSetlistId, setlists: state.setlists };
    const json = JSON.stringify(data);
    // simula importSetlist com um File
    return new Promise(res => {
      const file = new File([json], 'r.json', { type: 'application/json' });
      importSetlist(file);
      // Desde a 3.4.0 a importação passa pelo diálogo: confirmar é obrigatório.
      setTimeout(() => {
        const perguntou = document.getElementById('importDialog').open;
        document.getElementById('importReplaceBtn').click();
        setTimeout(() => res({ perguntou, total: state.setlists.length, musicas: state.setlist.length }), 200);
      }, 300);
    });
  });
  console.log('import v3:', JSON.stringify(roundtrip));

  // 7) Área de impressão
  const printOut = await page.evaluate(() => {
    state.setlist[0] && (state.setlist[0].key = 2, state.setlist[0].capo = 1, state.setlist[0].notes = 'entra na segunda voz');
    buildPrintArea(true);
    const a = document.getElementById('printArea');
    return { itens: a.querySelectorAll('li').length, temMarcas: !!a.querySelector('.printMarks'), temNotas: !!a.querySelector('.printNotes'), temLetra: !!a.querySelector('.printLyrics'), cabecalho: a.querySelector('h1').textContent };
  });
  console.log('impressão:', JSON.stringify(printOut));

  console.log(errors.length ? 'ERROS:\n  ' + errors.join('\n  ') : 'sem erros');
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})();
