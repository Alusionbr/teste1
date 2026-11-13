/* Núcleo de cálculo do simulador pessoal. Sem rede, sem DOM: roda no navegador e no Node.
 * Reproduz a contabilidade do motor oficial (motor_simulacao.py): R$ 1.000 iniciais por mercado,
 * taxa simulada de 0,1% por operação, posição única por ativo. Só lê registros; nunca grava. */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.Nucleo = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  const SALDO_INICIAL = 1000;
  const EPS = 1e-8;

  /** Reconstrói caixa e posições de um mercado a partir dos registros compra/venda. */
  function conta(registros, mercado) {
    let caixa = SALDO_INICIAL;
    const posicoes = {};
    let erro = null;
    const ordens = registros
      .filter(r => r.mercado === mercado && (r.tipo === 'compra' || r.tipo === 'venda'))
      .sort((a, b) => (Date.parse(a.instante_utc) - Date.parse(b.instante_utc)) || String(a.chave).localeCompare(String(b.chave)));
    for (const r of ordens) {
      const p = (posicoes[r.ativo] = posicoes[r.ativo] || { qtd: 0, custo: 0 });
      const qtd = Number(r.quantidade), bruto = Number(r.valor_brl), taxa = Number(r.taxa_brl);
      if (![qtd, bruto, taxa].every(Number.isFinite)) { erro = 'registro de operação com número inválido'; break; }
      if (r.tipo === 'compra') {
        caixa -= bruto + taxa; p.qtd += qtd; p.custo += bruto + taxa;
      } else {
        if (p.qtd <= 0 || qtd > p.qtd + EPS) { erro = 'histórico inconsistente: venda sem posição'; break; }
        p.custo *= Math.max(0, 1 - qtd / p.qtd);
        p.qtd = Math.max(0, p.qtd - qtd);
        caixa += bruto - taxa;
      }
    }
    if (!erro && caixa < -0.01) erro = 'histórico inconsistente: saldo negativo';
    return { caixa, posicoes, erro };
  }

  /** Marca a carteira a preço de mercado. Sem preço de alguma posição aberta, não inventa total. */
  function patrimonioAoVivo(c, precos) {
    let ativos = 0;
    const faltando = [];
    for (const [ativo, p] of Object.entries(c.posicoes)) {
      if (p.qtd <= 1e-12) continue;
      const preco = precos[ativo];
      if (!(Number.isFinite(preco) && preco > 0)) { faltando.push(ativo); continue; }
      ativos += p.qtd * preco;
    }
    return { ativos, patrimonio: faltando.length ? null : c.caixa + ativos, faltando };
  }

  /** Pontos de patrimônio registrados (um por rodada horária), em ordem de tempo. */
  function serie(registros, mercado) {
    return registros
      .filter(r => r.mercado === mercado && r.tipo === 'patrimonio' && Number.isFinite(Number(r.patrimonio_brl)) && r.patrimonio_brl !== null)
      .map(r => ({ t: Date.parse(r.instante_utc), v: Number(r.patrimonio_brl) }))
      .filter(p => Number.isFinite(p.t))
      .sort((a, b) => a.t - b.t);
  }

  function ativosAbertos(registros) {
    const out = new Set();
    for (const m of ['cripto', 'cambio']) {
      const c = conta(registros, m);
      for (const [a, p] of Object.entries(c.posicoes)) if (p.qtd > 1e-12) out.add(a);
    }
    return [...out];
  }

  const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const moeda = x => (x === null || x === undefined || !Number.isFinite(Number(x))) ? '—'
    : Number(x).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const pct = (x, casas = 2) => (x === null || x === undefined || !Number.isFinite(Number(x))) ? '—'
    : (Number(x) * 100).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }) + '%';
  const pctDireto = (x, casas = 2) => (x === null || x === undefined || !Number.isFinite(Number(x))) ? '—'
    : Number(x).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }) + '%';
  const usd = x => (x === null || x === undefined || !Number.isFinite(Number(x))) ? '—'
    : Number(x).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  const enderecoCurto = e => { const s = String(e || ''); return s.length > 14 ? s.slice(0, 6) + '…' + s.slice(-4) : s; };

  /** "há 5 min", "há 2 h", "há 3 dias". */
  function idade(isoOuMs, agora = Date.now()) {
    const t = typeof isoOuMs === 'number' ? isoOuMs : Date.parse(isoOuMs);
    if (!Number.isFinite(t)) return 'data desconhecida';
    const s = Math.max(0, Math.round((agora - t) / 1000));
    if (s < 60) return 'há ' + s + ' s';
    if (s < 3600) return 'há ' + Math.round(s / 60) + ' min';
    if (s < 86400) return 'há ' + Math.round(s / 3600) + ' h';
    return 'há ' + Math.round(s / 86400) + ' dias';
  }

  /** Valida o pacote de dados (dados.json). Devolve lista de problemas; vazia = ok. */
  function validarPacote(p) {
    const problemas = [];
    if (!p || typeof p !== 'object') return ['pacote vazio ou inválido'];
    if (!p.gerado_em || !Number.isFinite(Date.parse(p.gerado_em))) problemas.push('gerado_em ausente ou inválido');
    const t = p.tabelas;
    if (!t || typeof t !== 'object') return problemas.concat('tabelas ausentes');
    for (const nome of ['registros', 'traders', 'metricas', 'operacoes_publicas', 'altas']) {
      if (!Array.isArray(t[nome])) problemas.push('tabela ' + nome + ' ausente');
    }
    if (Array.isArray(t.registros)) {
      for (const r of t.registros) {
        if (!r || !r.chave || !r.mercado || !r.tipo || !r.instante_utc) { problemas.push('registro sem chave/mercado/tipo/instante'); break; }
      }
    }
    return problemas;
  }

  const usdDec = (x, casas = 2) => (x === null || x === undefined || !Number.isFinite(Number(x))) ? '—'
    : Number(x).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: casas, maximumFractionDigits: casas });

  /** Mensagem miniTicker da Binance (fluxo combinado ou direto) -> {simbolo, preco, var24, volume} ou null. */
  function lerMiniTicker(texto) {
    let m;
    try { m = typeof texto === 'string' ? JSON.parse(texto) : texto; } catch (e) { return null; }
    const d = m && m.data ? m.data : m;
    if (!d || d.e !== '24hrMiniTicker' || typeof d.s !== 'string') return null;
    const preco = parseFloat(d.c), abertura = parseFloat(d.o), volume = parseFloat(d.q);
    if (!(preco > 0)) return null;
    return { simbolo: d.s, preco, var24: abertura > 0 ? (preco / abertura - 1) * 100 : null, volume: Number.isFinite(volume) ? volume : null };
  }

  /** Execuções da Hyperliquid (userFills) -> linhas normalizadas; descarta o que não for número válido. */
  function fillsParaLinhas(usuario, fills, origem) {
    const out = [];
    for (const f of Array.isArray(fills) ? fills : []) {
      if (!f) continue;
      const t = Number(f.time), px = Number(f.px), sz = Number(f.sz);
      if (!Number.isFinite(t) || !(px > 0) || !(sz > 0) || !f.coin) continue;
      const end = String(usuario).toLowerCase();
      const pnl = Number(f.closedPnl);
      out.push({
        chave: end + ':' + (f.tid ?? '') + ':' + (f.hash ?? '') + ':' + t,
        endereco: end, t, ativo: String(f.coin),
        lado: f.side === 'B' ? 'compra' : f.side === 'A' ? 'venda' : '—',
        direcao: String(f.dir || ''), preco: px, tamanho: sz,
        pnl: Number.isFinite(pnl) ? pnl : null, origem,
      });
    }
    return out;
  }

  /** Mais recentes primeiro, no máximo `limite`. */
  const recentes = (lista, limite) => [...lista].sort((a, b) => b.t - a.t).slice(0, limite);

  /** Ganho/perda em texto e ícone (não depende de cor). */
  function resultadoTexto(r, eps = 0.005) {
    if (r === null || r === undefined || !Number.isFinite(Number(r))) return { icone: '', rotulo: 'sem resultado', classe: '' };
    if (r > eps) return { icone: '▲', rotulo: 'ganho', classe: 'good' };
    if (r < -eps) return { icone: '▼', rotulo: 'perda', classe: 'badc' };
    return { icone: '=', rotulo: 'sem variação', classe: '' };
  }

  /** Resumo textual de uma série {t,v}: início, fim, pontos, variação, mínimo e máximo. */
  function resumoSerie(pts) {
    if (!Array.isArray(pts) || !pts.length) return null;
    const a = pts[0], b = pts[pts.length - 1], vs = pts.map(p => p.v);
    return { n: pts.length, ini: a, fim: b, variacao: a.v ? b.v / a.v - 1 : null, min: Math.min(...vs), max: Math.max(...vs) };
  }

  /** 'AAAA-MM-DD' -> 'DD/MM/AAAA' (ou o texto original se não casar). */
  const dataBR = s => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? m[3] + '/' + m[2] + '/' + m[1] : String(s || '—'); };

  return { SALDO_INICIAL, conta, patrimonioAoVivo, serie, ativosAbertos, esc, moeda, pct, pctDireto, usd, usdDec, enderecoCurto, idade, validarPacote, lerMiniTicker, fillsParaLinhas, recentes, resultadoTexto, resumoSerie, dataBR };
});
