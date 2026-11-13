// Rodar: node --test teste_nucleo.js   (sem rede, sem banco)
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const N = require('./nucleo.js');

const compra = { mercado: 'cripto', tipo: 'compra', ativo: 'BTCBRL', instante_utc: '2026-11-13T22:00:00Z', quantidade: 0.0005, valor_brl: 200, taxa_brl: 0.2 };
const venda = { mercado: 'cripto', tipo: 'venda', ativo: 'BTCBRL', instante_utc: '2026-11-13T23:00:00Z', quantidade: 0.0005, valor_brl: 210, taxa_brl: 0.21 };

test('sem operações: caixa 1000 e nenhuma posição', () => {
  const c = N.conta([], 'cripto');
  assert.strictEqual(c.caixa, 1000); assert.deepStrictEqual(c.posicoes, {}); assert.strictEqual(c.erro, null);
});

test('compra reduz caixa por valor + taxa e marca a mercado', () => {
  const c = N.conta([compra], 'cripto');
  assert.ok(Math.abs(c.caixa - 799.8) < 1e-9);
  const v = N.patrimonioAoVivo(c, { BTCBRL: 440000 });
  assert.ok(Math.abs(v.ativos - 220) < 1e-9);
  assert.ok(Math.abs(v.patrimonio - 1019.8) < 1e-9);
});

test('sem preço de posição aberta o total é null (não inventa)', () => {
  const v = N.patrimonioAoVivo(N.conta([compra], 'cripto'), {});
  assert.strictEqual(v.patrimonio, null); assert.deepStrictEqual(v.faltando, ['BTCBRL']);
  assert.strictEqual(N.patrimonioAoVivo(N.conta([compra], 'cripto'), { BTCBRL: NaN }).patrimonio, null);
});

test('compra e venda completa devolve caixa líquido de taxas', () => {
  const c = N.conta([compra, venda], 'cripto');
  assert.ok(Math.abs(c.caixa - (1000 - 200.2 + 209.79)) < 1e-9);
  assert.strictEqual(c.posicoes.BTCBRL.qtd, 0);
});

test('venda sem posição e saldo negativo são sinalizados', () => {
  assert.match(N.conta([venda], 'cripto').erro, /venda sem posição/);
  assert.match(N.conta([{ ...compra, valor_brl: 5000 }], 'cripto').erro, /saldo negativo/);
});

test('mercados são separados', () => {
  assert.strictEqual(N.conta([compra], 'cambio').caixa, 1000);
});

test('série de patrimônio ignora linhas sem valor e ordena', () => {
  const s = N.serie([
    { mercado: 'cripto', tipo: 'patrimonio', instante_utc: '2026-11-13T22:00:00Z', patrimonio_brl: 1005 },
    { mercado: 'cripto', tipo: 'patrimonio', instante_utc: '2026-11-13T21:00:00Z', patrimonio_brl: 1000 },
    { mercado: 'cripto', tipo: 'decisao', instante_utc: '2026-11-13T21:30:00Z', patrimonio_brl: null },
    { mercado: 'cripto', tipo: 'patrimonio', instante_utc: '2026-11-13T23:00:00Z', patrimonio_brl: null },
  ], 'cripto');
  assert.deepStrictEqual(s.map(p => p.v), [1000, 1005]);
});

test('esc neutraliza HTML', () => {
  assert.strictEqual(N.esc('<img src=x onerror="a()">'), '&lt;img src=x onerror=&quot;a()&quot;&gt;');
});

test('formatadores tratam ausência', () => {
  assert.strictEqual(N.moeda(null), '—'); assert.strictEqual(N.pct(undefined), '—');
  assert.strictEqual(N.enderecoCurto('0xec5cca1f1c077fe9118366437472f40ad504b842'), '0xec5c…b842');
});

test('pacote real (dados.json) é válido e a carteira está intacta', () => {
  const p = JSON.parse(fs.readFileSync(path.join(__dirname, 'dados.json'), 'utf8'));
  assert.deepStrictEqual(N.validarPacote(p), []);
  assert.strictEqual(N.conta(p.tabelas.registros, 'cripto').caixa, 1000);
});

test('pacote inválido é recusado', () => {
  assert.ok(N.validarPacote({}).length > 0);
  assert.ok(N.validarPacote({ gerado_em: '2026-11-13T22:00:00Z', tabelas: { registros: [{ chave: 'x' }], traders: [], metricas: [], operacoes_publicas: [], altas: [] } }).length > 0);
});

test('miniTicker da Binance: lê preço e variação; rejeita lixo', () => {
  const msg = '{"stream":"btcbrl@miniTicker","data":{"e":"24hrMiniTicker","E":1,"s":"BTCBRL","c":"390432.00","o":"404836.00","q":"75494394.07"}}';
  const r = N.lerMiniTicker(msg);
  assert.strictEqual(r.simbolo, 'BTCBRL'); assert.strictEqual(r.preco, 390432);
  assert.ok(Math.abs(r.var24 - ((390432 / 404836 - 1) * 100)) < 1e-9);
  assert.strictEqual(N.lerMiniTicker('nao e json'), null);
  assert.strictEqual(N.lerMiniTicker('{"data":{"e":"24hrMiniTicker","s":"X","c":"0","o":"1"}}'), null);
  assert.strictEqual(N.lerMiniTicker('{"data":{"e":"outro","s":"X","c":"1"}}'), null);
});

test('execuções da Hyperliquid: normaliza, descarta inválidas e gera chave estável', () => {
  const f = { coin: 'BTC', px: '95000.5', sz: '0.01', side: 'B', time: 1794600000000, dir: 'Open Long', closedPnl: '0.0', hash: '0xabc', tid: 7 };
  const a = N.fillsParaLinhas('0xAbC', [f, { ...f, px: '0' }, { ...f, coin: '' }, null, { ...f, time: 'x' }], 'ao vivo');
  assert.strictEqual(a.length, 1);
  assert.strictEqual(a[0].lado, 'compra'); assert.strictEqual(a[0].endereco, '0xabc'); assert.strictEqual(a[0].origem, 'ao vivo');
  assert.strictEqual(a[0].chave, N.fillsParaLinhas('0xabc', [f], 'recente')[0].chave);
  assert.strictEqual(N.fillsParaLinhas('0x1', [{ ...f, side: 'A' }], 'x')[0].lado, 'venda');
  assert.deepStrictEqual(N.fillsParaLinhas('0x1', 'nao-lista', 'x'), []);
});

test('recentes ordena do mais novo e respeita o limite', () => {
  const r = N.recentes([{ t: 1 }, { t: 3 }, { t: 2 }], 2);
  assert.deepStrictEqual(r.map(x => x.t), [3, 2]);
});

test('resultado em texto/ícone: ganho, perda, sem variação e ausente', () => {
  assert.deepStrictEqual(N.resultadoTexto(3.2), { icone: '▲', rotulo: 'ganho', classe: 'good' });
  assert.deepStrictEqual(N.resultadoTexto(-3.2), { icone: '▼', rotulo: 'perda', classe: 'badc' });
  assert.strictEqual(N.resultadoTexto(0.001).rotulo, 'sem variação');
  assert.strictEqual(N.resultadoTexto(null).rotulo, 'sem resultado');
});

test('resumo de série e data brasileira', () => {
  assert.strictEqual(N.resumoSerie([]), null);
  const r = N.resumoSerie([{ t: 1, v: 1000 }, { t: 2, v: 1010 }, { t: 3, v: 990 }]);
  assert.strictEqual(r.n, 3); assert.ok(Math.abs(r.variacao + 0.01) < 1e-9); assert.strictEqual(r.min, 990); assert.strictEqual(r.max, 1010);
  assert.strictEqual(N.dataBR('2026-11-13'), '13/11/2026');
  assert.strictEqual(N.dataBR(''), '—');
});

test('ordens com formatos de data misturados são ordenadas pelo instante real', () => {
  const a = { chave: 'a', mercado: 'cripto', tipo: 'compra', ativo: 'BTCBRL', instante_utc: '2026-11-13T21:24:29.699186+00:00', quantidade: 1, valor_brl: 100, taxa_brl: 0.1 };
  const b = { chave: 'b', mercado: 'cripto', tipo: 'venda', ativo: 'BTCBRL', instante_utc: '2026-11-13T21:24:30Z', quantidade: 1, valor_brl: 110, taxa_brl: 0.1 };
  assert.strictEqual(N.conta([b, a], 'cripto').erro, null);
});
