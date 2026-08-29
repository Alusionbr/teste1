const { chromium } = require('./playwright.js');
const BASE = 'http://localhost:8777/estante/';
const LETRA = 'C       G\nprimeira linha da letra\nAm      F\nsegunda linha da letra';

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext()).newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto(BASE);
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(400);

  // Duas músicas com cifra no repertório
  await page.evaluate(letra => {
    openSong({ title: 'Música A', artist: 'Banda', lyrics: letra, duration: 200 });
    addSong();
    openSong({ title: 'Música B', artist: 'Banda', lyrics: letra, duration: 150 });
    addSong();
  }, LETRA);
  await page.waitForTimeout(300);

  const controles = await page.evaluate(() => ({
    tomVisivel: !document.getElementById('keyControl').hidden,
    capoVisivel: !document.getElementById('capoControl').hidden,
    acordes: [...document.querySelectorAll('.chord')].map(n => n.textContent.trim())
  }));
  console.log('controles:', JSON.stringify(controles));

  await page.evaluate(() => setPedalMode('pedaleira'));
  // Ajustes na música B: tom +2, capo 1, velocidade +4, anotação
  await page.click('#keyControl button[data-key="1"]');
  await page.click('#keyControl button[data-key="1"]');
  await page.click('#capoControl button[data-capo="1"]');
  await page.click('.transport button[data-speed="2"]');
  await page.click('.transport button[data-speed="2"]');
  await page.click('#notesBtn');
  await page.fill('#notesText', 'entra em Ré, 2ª voz no refrão');
  await page.click('#notesForm button.accent');
  await page.waitForTimeout(300);

  const ajustado = await page.evaluate(() => ({
    key: state.key, capo: state.capo, speed: state.speed,
    shift: chordShift(),
    acordes: [...document.querySelectorAll('.chord')].map(n => n.textContent.trim()),
    faixaNotas: document.getElementById('songNotes').textContent,
    faixaVisivel: !document.getElementById('songNotes').hidden
  }));
  console.log('ajustes na B:', JSON.stringify(ajustado));

  // Vai para A e volta para B: os valores de cada uma devem voltar
  await page.evaluate(() => { state.tab = 'setlist'; renderList(); });
  await page.evaluate(() => { state.currentIndex = 0; openSong(state.setlist[0]); });
  await page.waitForTimeout(200);
  const naA = await page.evaluate(() => ({ key: state.key, capo: state.capo, speed: state.speed, notas: document.getElementById('songNotes').hidden }));
  await page.evaluate(() => { state.currentIndex = 1; openSong(state.setlist[1]); });
  await page.waitForTimeout(200);
  const voltouB = await page.evaluate(() => ({ key: state.key, capo: state.capo, speed: state.speed, notas: document.getElementById('songNotes').textContent }));
  console.log('na A:', JSON.stringify(naA));
  console.log('voltando na B:', JSON.stringify(voltouB));

  // Persistência real: recarrega e reabre B
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(500);
  const salvo = await page.evaluate(() => {
    const b = state.setlist.find(s => s.title === 'Música B');
    return { key: b.key, capo: b.capo, speed: b.speed, notes: b.notes, prefGlobal: JSON.parse(localStorage.getItem('estante:v2:prefs')).speed };
  });
  console.log('depois de recarregar:', JSON.stringify(salvo));

  console.log(errors.length ? 'ERROS:\n  ' + errors.join('\n  ') : 'sem erros');
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})();
