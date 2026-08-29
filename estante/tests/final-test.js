const { chromium } = require('./playwright.js');
const BASE = 'http://localhost:8777';
const OUT = '/tmp/claude-0/-home-user-teste1/a32fdda7-de13-5be9-bde1-3d3880e9df80/scratchpad';
const LETRA = 'C       G\nera uma vez uma canção\nAm      F\nque a banda tocava no bar';
let falhas = 0;
const ok = (nome, cond, extra = '') => { console.log((cond ? 'ok   ' : 'FALHA ') + nome + (extra ? ' — ' + extra : '')); if (!cond) falhas++; };

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('requestfailed', r => errors.push('request falhou: ' + r.url()));

  // Compartilhamento: gera o link com um repertório e abre em outra sessão
  await page.goto(BASE + '/estante/');
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(400);
  // 3.9.0: o link leva a letra e sai compactado (#setlistz=) quando o
  // navegador tem CompressionStream; makeShareUrl passou a ser assíncrono.
  const link = await page.evaluate(async letra => {
    await openSong({ title: 'Canção do Bar', artist: 'Trio', lyrics: letra, duration: 214 }); addSong();
    await openSong({ title: 'Outra', artist: 'Trio', lyrics: letra, duration: 180 }); addSong();
    renameSetlist(state.activeSetlistId, 'Sábado no bar');
    return makeShareUrl(true);
  }, LETRA);
  ok('link de compartilhamento gerado', /#setlistz?=/.test(link));

  const ctx2 = await browser.newContext();
  const p2 = await ctx2.newPage();
  p2.on('pageerror', e => errors.push('recebedor: ' + e.message));
  await p2.goto(link.replace('http://localhost:8777', BASE));
  await p2.waitForTimeout(600);
  ok('diálogo de repertório recebido abre', await p2.locator('#sharedDialog[open]').count() === 1);
  await p2.click('#sharedNewBtn');
  await p2.waitForTimeout(300);
  const recebido = await p2.evaluate(() => ({ total: state.setlists.length, nome: activeSetlist().name, n: state.setlist.length }));
  ok('recebido em repertório novo', recebido.n === 2 && recebido.nome === 'Sábado no bar', JSON.stringify(recebido));
  const comLetra = await p2.evaluate(() => state.setlist.every(s => !!s.lyrics));
  ok('as músicas recebidas já vêm com a letra', comLetra);
  await ctx2.close();

  // Impressão: gera PDF de verdade
  await page.evaluate(() => { state.tab = 'setlist'; renderList(); });
  await page.click('#printBtn');
  await page.waitForTimeout(200);
  ok('diálogo de impressão abre', await page.locator('#printDialog[open]').count() === 1);
  await page.evaluate(() => { buildPrintArea(false); $('printDialog').close(); });
  await page.pdf({ path: `${OUT}/repertorio.pdf`, format: 'A4', printBackground: true });
  ok('PDF da lista gerado', require('fs').statSync(`${OUT}/repertorio.pdf`).size > 1000);

  // Confere que o conteúdo impresso é o repertório e não a tela do app
  const textoImpresso = await page.evaluate(() => document.getElementById('printArea').innerText);
  ok('impressão traz o nome do repertório', textoImpresso.includes('Sábado no bar'), textoImpresso.split('\n')[0]);
  ok('impressão lista as músicas', textoImpresso.includes('Canção do Bar') && textoImpresso.includes('Outra'));

  // Ajuda continua abrindo
  await page.click('#helpBtn');
  await page.waitForTimeout(200);
  ok('ajuda abre', await page.locator('#helpDialog[open]').count() === 1);
  await page.keyboard.press('Escape');

  // Busca offline não quebra a tela
  await ctx.setOffline(true);
  await page.fill('#searchInput', 'teste');
  await page.click('#searchForm button');
  await page.waitForTimeout(600);
  const aviso = await page.locator('#notice').innerText();
  ok('busca offline avisa sem quebrar', /offline|internet/i.test(aviso), aviso.trim());
  await ctx.setOffline(false);

  console.log(errors.length ? 'ERROS DE PÁGINA:\n  ' + errors.join('\n  ') : 'sem erros de página');
  await browser.close();
  process.exit(falhas || errors.length ? 1 : 0);
})();
