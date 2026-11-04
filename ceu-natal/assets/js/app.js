/*
 * Lógica da página: formulário, busca de cidade, desenho da roda do mapa,
 * leitura gratuita, vitrine de produtos, anúncios e aviso de cookies.
 */
(function () {
  'use strict';

  var CFG = window.CONFIG;
  var M = window.MapaAstral;
  var I = window.Interpretacoes;
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };

  var campoCidade;

  /* ---------- Roda do mapa (SVG) ---------- */
  var CORES_ELEMENTO = ['#e4572e', '#3f8f5b', '#d9a521', '#3a7bd5'];

  function desenharRoda(mapa) {
    var S = 520, C = S / 2, R1 = 250, R2 = 210, R3 = 170, R4 = 95;
    var asc = mapa.ascendente ? mapa.ascendente.longitude : 0;
    function ang(lon) { return (180 - (lon - asc)) * Math.PI / 180; }
    function pt(lon, r) { var a = ang(lon); return [C + r * Math.cos(a), C - r * Math.sin(a)]; }
    var svg = ['<svg viewBox="0 0 ' + S + ' ' + S + '" class="roda" role="group" aria-label="Roda interativa do mapa astral"><title>Roda do mapa astral</title><desc>Use Tab para selecionar planetas e casas. Os mesmos dados estão na tabela.</desc>'];
    svg.push('<circle cx="' + C + '" cy="' + C + '" r="' + R1 + '" class="roda-fundo"/>');

    for (var i = 0; i < 12; i++) {
      var l0 = i * 30, l1 = l0 + 30;
      var a = pt(l0, R1), b = pt(l1, R1), c2 = pt(l1, R2), d = pt(l0, R2);
      svg.push('<path d="M' + a + ' A' + R1 + ' ' + R1 + ' 0 0 1 ' + b + ' L' + c2 + ' A' + R2 + ' ' + R2 + ' 0 0 0 ' + d + ' Z" fill="' + CORES_ELEMENTO[i % 4] + '" fill-opacity="0.18" stroke="currentColor" stroke-opacity="0.25"/>');
      var m = pt(l0 + 15, (R1 + R2) / 2);
      svg.push('<text x="' + m[0] + '" y="' + m[1] + '" class="glifo-signo" fill="' + CORES_ELEMENTO[i % 4] + '">' + M.SIMBOLOS_SIGNOS[i] + '︎</text>');
    }
    svg.push('<circle cx="' + C + '" cy="' + C + '" r="' + R2 + '" class="linha"/>');
    svg.push('<circle cx="' + C + '" cy="' + C + '" r="' + R4 + '" class="linha"/>');

    if (mapa.casas) {
      mapa.casas.forEach(function (cs, idx) {
        var p1 = pt(cs.longitude, R2), p2 = pt(cs.longitude, R4);
        var eixo = idx % 3 === 0;
        svg.push('<line x1="' + p1[0] + '" y1="' + p1[1] + '" x2="' + p2[0] + '" y2="' + p2[1] + '" class="' + (eixo ? 'eixo' : 'linha') + '"/>');
        var prox = mapa.casas[(idx + 1) % 12].longitude;
        var meio = cs.longitude + (((prox - cs.longitude) % 360) + 360) % 360 / 2;
        var n = pt(meio, R4 + 12);
        svg.push('<g class="roda-casa" data-casa="' + (idx + 1) + '" role="button" tabindex="0" aria-label="Casa ' + (idx + 1) + ', cúspide ' + cs.texto + '"><circle cx="' + n[0] + '" cy="' + n[1] + '" r="14"/><text x="' + n[0] + '" y="' + n[1] + '" class="num-casa">' + (idx + 1) + '</text></g>');
      });
      var pa = pt(asc, R4 + 26);
      svg.push('<text x="' + pa[0] + '" y="' + (pa[1] - 9) + '" class="rotulo-eixo" text-anchor="middle">ASC</text>');
      var pm = pt(mapa.meioDoCeu.longitude, R4 + 26);
      svg.push('<text x="' + (pm[0] + 14) + '" y="' + pm[1] + '" class="rotulo-eixo" text-anchor="middle">MC</text>');
    }

    // Rótulos preservam a ordem circular e usam a maior lacuna como início.
    var ps = mapa.planetas.map(function (p) { return { p: p, pos: p.longitude }; }).sort(function (x, y) { return x.pos - y.pos; });
    var maiorGap = -1, inicio = 0;
    ps.forEach(function (o, i) {
      var prox = ps[(i + 1) % ps.length].pos + (i === ps.length - 1 ? 360 : 0);
      if (prox - o.pos > maiorGap) { maiorGap = prox - o.pos; inicio = (i + 1) % ps.length; }
    });
    ps = ps.slice(inicio).concat(ps.slice(0, inicio));
    var volta = 0, anteriorReal = -1, anteriorRotulo = -100;
    ps.forEach(function (o) {
      if (o.pos < anteriorReal) volta = 360;
      var real = o.pos + volta;
      o.rotulo = Math.max(real, anteriorRotulo + 9);
      anteriorReal = o.pos;
      anteriorRotulo = o.rotulo;
    });
    var mapaPos = {};
    ps.forEach(function (o) { mapaPos[o.p.id] = pt(o.p.longitude, R4); });
    if (mapa.ascendente) mapaPos.asc = pt(mapa.ascendente.longitude, R4);
    if (mapa.meioDoCeu) mapaPos.mc = pt(mapa.meioDoCeu.longitude, R4);
    mapa.aspectos.forEach(function (as, idx) {
      var p1 = mapaPos[as.a], p2 = mapaPos[as.b];
      if (!p1 || !p2 || as.aspecto === 'Conjunção') return;
      svg.push('<line x1="' + p1[0] + '" y1="' + p1[1] + '" x2="' + p2[0] + '" y2="' + p2[1] + '" data-aspecto-index="' + idx + '" class="aspecto ' + as.tipo + '"/>');
    });
    ps.forEach(function (o) {
      var g = pt(o.rotulo, (R2 + R3) / 2 - 8);
      var tick = pt(o.p.longitude, R2), tick2 = pt(o.p.longitude, R2 - 8);
      svg.push('<line x1="' + tick[0] + '" y1="' + tick[1] + '" x2="' + tick2[0] + '" y2="' + tick2[1] + '" class="eixo"/>');
      if (Math.abs(((o.rotulo - o.p.longitude + 540) % 360) - 180) > 1) {
        svg.push('<line x1="' + tick2[0] + '" y1="' + tick2[1] + '" x2="' + g[0] + '" y2="' + g[1] + '" class="roda-guia"/>');
      }
      svg.push('<g class="roda-ponto" data-ponto="' + o.p.id + '" role="button" tabindex="0" aria-label="' + o.p.nome + ' em ' + o.p.texto + '"><circle cx="' + g[0] + '" cy="' + g[1] + '" r="16"/><text x="' + g[0] + '" y="' + g[1] + '" class="glifo-planeta">' + o.p.simbolo + '︎</text></g>');
    });

    svg.push('</svg>');
    return svg.join('');
  }

  /* ---------- Leitura gratuita ---------- */
  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  function maior(obj) {
    return Object.keys(obj).reduce(function (a, b) { return obj[a] >= obj[b] ? a : b; });
  }

  function textoDoPlaneta(p) {
    var texto = p.id === 'sol' ? I.SOL[p.signoIndice] : p.id === 'lua' ? I.LUA[p.signoIndice] : I.textoPlaneta(p);
    if ((p.id === 'sol' || p.id === 'lua') && p.casa) texto += ' Na casa ' + p.casa + ', essa vivência aparece em temas de ' + I.CASAS[p.casa - 1] + '.';
    return texto;
  }

  function baixarDados(mapa) {
    var linhas = [['Tipo', 'Nome', 'Signo', 'Longitude (graus)', 'Casa', 'Orbe (graus)']];
    mapa.planetas.forEach(function (p) { linhas.push(['Planeta', p.nome, p.signo, p.longitude.toFixed(6), p.casa || '', '']); });
    if (mapa.ascendente) linhas.push(['Ângulo', 'Ascendente', mapa.ascendente.signo, mapa.ascendente.longitude.toFixed(6), 1, '']);
    if (mapa.meioDoCeu) linhas.push(['Ângulo', 'Meio do Céu', mapa.meioDoCeu.signo, mapa.meioDoCeu.longitude.toFixed(6), 10, '']);
    if (mapa.casas) mapa.casas.forEach(function (c, i) { linhas.push(['Cúspide', 'Casa ' + (i + 1), c.signo, c.longitude.toFixed(6), i + 1, '']); });
    mapa.aspectos.forEach(function (a) { linhas.push(['Aspecto', a.nomeA + ' ' + a.aspecto + ' ' + a.nomeB, '', '', '', a.orbe.toFixed(3)]); });
    linhas.push(['Instante UTC', mapa.dataUTC, '', '', '', '']);
    linhas.push(['Fuso IANA', mapa.entrada.fuso, '', '', '', '']);
    var csv = '\uFEFF' + linhas.map(function (linha) { return linha.map(function (campo) { return '"' + String(campo).replace(/"/g, '""') + '"'; }).join(';'); }).join('\r\n');
    var url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    var link = document.createElement('a'); link.href = url; link.download = 'ceu-natal-dados.csv'; link.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function renderResultado(mapa, nome, cidade, opcoes) {
    var sol = mapa.planetas[0], lua = mapa.planetas[1];
    var h = [];
    var entrada = mapa.entrada;
    var dataLocal = String(entrada.dia).padStart(2, '0') + '/' + String(entrada.mes).padStart(2, '0') + '/' + entrada.ano;
    var local = cidade ? cidade.nome + (cidade.detalhe ? ' · ' + cidade.detalhe : '') : 'local informado';
    h.push('<div class="resultado-topo"><p class="sobretitulo">Seu atlas pessoal · acesso gratuito</p><h2>' + (nome ? 'O céu de ' + esc(nome) : 'O seu céu de nascimento') + '</h2>');
    h.push('<p class="dados-nascimento">' + dataLocal + ' · ' + (mapa.horaDesconhecida ? 'hora não informada' : String(entrada.hora).padStart(2, '0') + ':' + String(entrada.minuto).padStart(2, '0')) + ' · ' + esc(local) + '</p>');
    if (entrada.horarioRepetido) h.push('<p class="nota">Hora repetida no horário de verão: ' + (entrada.horarioRepetido === 'primeiro' ? 'primeira ocorrência' : 'segunda ocorrência') + ' selecionada.</p>');
    h.push('<p class="trio"><span>☉︎ Sol <b>' + sol.signo + '</b></span><span>☽︎ Lua <b>' + lua.signo + '</b></span>' +
      (mapa.ascendente ? '<span>↑ Ascendente <b>' + mapa.ascendente.signo + '</b></span>' : '') + '</p>');
    if (mapa.avisoHora) h.push('<p class="aviso-mapa">' + esc(mapa.avisoHora) + '</p>');
    h.push('<a class="editar-dados" href="#calcular">Corrigir dados de nascimento</a></div>');
    h.push('<nav class="mapa-nav" aria-label="Capítulos do mapa"><a href="#mapa-visao">Visão geral</a><a href="#mapa-planetas">Planetas</a><a href="#mapa-casas">Casas</a><a href="#mapa-aspectos">Aspectos</a><a href="#mapa-dados">Dados do cálculo</a></nav>');

    h.push('<section id="mapa-visao" class="capitulo"><div class="capitulo-cabecalho"><p class="sobretitulo">01 / Visão geral</p><h3>Seu mapa, ponto por ponto</h3><p>Selecione um símbolo na roda ou use os botões das seções abaixo para explorar. A leitura é simbólica e não determina acontecimentos.</p></div>');
    h.push('<div class="resultado-grade"><div class="roda-caixa">' + desenharRoda(mapa) + '</div><div class="foco-caixa" id="foco-mapa" role="status" aria-live="polite"><p class="sobretitulo">Selecionado na roda</p><h4 id="foco-titulo"></h4><p id="foco-texto"></p></div></div>');
    var el = maior(mapa.elementos), mo = maior(mapa.modalidades);
    h.push('<div class="equilibrio"><h4>Elementos em destaque</h4><p>' + I.ELEMENTO[el] + ' ' + I.MODALIDADE[mo] + '</p>' + barras(mapa.elementos) + '</div></section>');

    h.push('<section id="mapa-planetas" class="capitulo"><div class="capitulo-cabecalho"><p class="sobretitulo">02 / Planetas</p><h3>As peças da sua leitura</h3><p>Signo descreve o estilo; casa mostra o tema da vida. Cada posição está disponível gratuitamente.</p></div><div class="grade-leituras">');
    mapa.planetas.forEach(function (p) {
      h.push('<article class="mapa-card"><div class="mapa-card-topo"><span class="simbolo-grande" aria-hidden="true">' + p.simbolo + '</span><div><h4>' + p.nome + ' em ' + p.signo + '</h4><p>' + p.texto + (p.casa ? ' · Casa ' + p.casa : '') + (p.retrogrado ? ' · retrógrado' : '') + '</p></div></div><p>' + textoDoPlaneta(p) + '</p><button type="button" class="link-acao" data-ponto="' + p.id + '" data-ir-roda>Destacar na roda</button></article>');
    });
    if (mapa.ascendente) h.push('<article class="mapa-card"><div class="mapa-card-topo"><span class="simbolo-grande" aria-hidden="true">↑</span><div><h4>Ascendente em ' + mapa.ascendente.signo + '</h4><p>' + mapa.ascendente.texto + ' · Casa 1</p></div></div><p>' + I.ASCENDENTE[mapa.ascendente.signoIndice] + '</p><button type="button" class="link-acao" data-ponto="asc" data-ir-roda>Ver no resumo</button></article>');
    h.push('</div></section>');

    h.push('<section id="mapa-casas" class="capitulo"><div class="capitulo-cabecalho"><p class="sobretitulo">03 / Casas</p><h3>Doze áreas, um só mapa</h3><p>Uma casa sem planetas continua fazendo parte da leitura. A cúspide marca o início de cada casa.</p></div>');
    if (mapa.casas) {
      h.push('<div class="lista-casas">');
      mapa.casas.forEach(function (c, i) {
        var ocupantes = mapa.planetas.filter(function (p) { return p.casa === i + 1; }).map(function (p) { return p.nome; });
        h.push('<article class="mapa-card"><p class="casa-numero">CASA ' + String(i + 1).padStart(2, '0') + '</p><h4>' + c.signo + ' · ' + c.texto + '</h4><p>' + I.CASAS[i] + '.</p><p class="nota">' + (ocupantes.length ? 'Planetas nesta casa: ' + ocupantes.join(', ') + '.' : 'Sem planetas nesta casa.') + '</p><button type="button" class="link-acao" data-casa="' + (i + 1) + '" data-ir-roda>Destacar na roda</button></article>');
      });
      h.push('</div>');
    } else h.push('<p class="aviso-mapa">Sem hora de nascimento, não mostramos casas ou ascendente. Informe a hora para completar esta parte.</p>');
    h.push('</section>');

    h.push('<section id="mapa-aspectos" class="capitulo"><div class="capitulo-cabecalho"><p class="sobretitulo">04 / Aspectos</p><h3>Como os pontos se relacionam</h3><p>Todos os aspectos calculados estão abaixo, ordenados pelo orbe. A interpretação é uma hipótese de leitura, não um diagnóstico.</p></div><div class="lista-aspectos">');
    mapa.aspectos.forEach(function (a, i) {
      h.push('<details class="aspecto-card"' + (i < 3 ? ' open' : '') + '><summary><span>' + a.nomeA + ' ' + a.aspecto.toLowerCase() + ' ' + a.nomeB + '</span><small>Orbe ' + a.orbe.toFixed(1) + '°</small></summary><p>' + I.textoAspecto(a, mapa) + '</p><button type="button" class="link-acao" data-aspecto-index="' + i + '" data-ir-roda>Destacar na roda</button></details>');
    });
    if (!mapa.aspectos.length) h.push('<p>Nenhum dos cinco aspectos principais ficou dentro dos orbes usados neste cálculo.</p>');
    h.push('</div></section>');

    h.push('<section id="mapa-dados" class="capitulo"><div class="capitulo-cabecalho"><p class="sobretitulo">05 / Dados do cálculo</p><h3>Conferência e método</h3><p>Posições geocêntricas no zodíaco tropical. A hora local foi convertida pelo fuso IANA da cidade informada.</p></div>');
    h.push('<div class="tabela-caixa"><table class="tabela"><caption>Posições usadas na leitura</caption><thead><tr><th>Planeta</th><th>Posição</th><th>Casa</th></tr></thead><tbody>');
    mapa.planetas.forEach(function (p) { h.push('<tr><td><button type="button" class="tabela-link" data-ponto="' + p.id + '" data-ir-roda>' + p.simbolo + '︎ ' + p.nome + '</button></td><td>' + p.texto + (p.retrogrado ? ' <abbr title="retrógrado">R</abbr>' : '') + '</td><td>' + (p.casa || '—') + '</td></tr>'); });
    if (mapa.ascendente) h.push('<tr><td><button type="button" class="tabela-link" data-ponto="asc" data-ir-roda>↑ Ascendente</button></td><td>' + mapa.ascendente.texto + '</td><td>1</td></tr><tr><td>MC Meio do Céu</td><td>' + mapa.meioDoCeu.texto + '</td><td>10</td></tr>');
    h.push('</tbody></table></div>');
    if (mapa.casas) {
      h.push('<details class="dados-casas"><summary>Ver as cúspides das 12 casas</summary><div class="tabela-caixa"><table class="tabela"><caption>Início de cada casa</caption><thead><tr><th>Casa</th><th>Posição</th></tr></thead><tbody>');
      mapa.casas.forEach(function (c, i) { h.push('<tr><td>Casa ' + (i + 1) + '</td><td>' + c.texto + '</td></tr>'); });
      h.push('</tbody></table></div></details>');
    }
    h.push('<p class="nota">Instante UTC: ' + mapa.dataUTC + '. Fuso: ' + esc(entrada.fuso) + '. Casas: ' + (mapa.sistemaCasas || 'não calculadas') + '.</p>');
    if (mapa.sistemaCasas === 'Porfírio') h.push('<p class="aviso-mapa">Nesta latitude, Placidus não se resolveu; o sistema Porfírio foi usado e indicado no resultado.</p>');
    h.push('<p class="nota">Motor planetário: Astronomy Engine. A referência independente de testes usa Swiss Ephemeris Moshier. A interpretação é simbólica e não constitui previsão verificável.</p>');
    h.push('<button type="button" class="btn secundario" id="btn-csv">Baixar dados em CSV</button></section>');

    h.push('<div class="cta-extra"><a class="cartao-link" href="compatibilidade.html"><b>♡ Explorar compatibilidade</b><span>Comparação simbólica de dois mapas</span></a></div>');
    h.push('<div class="acoes"><button type="button" class="btn secundario" id="btn-compartilhar">Compartilhar</button><button type="button" class="btn secundario" id="btn-imprimir">Salvar mapa em PDF</button></div>');

    var box = $('#resultado');
    box.innerHTML = h.join('');
    box.hidden = false;
    $$('button[data-ponto],button[data-casa],button[data-aspecto-index],.roda [role="button"]', box).forEach(function (el) { el.setAttribute('aria-pressed', 'false'); });
    if (!opcoes || !opcoes.semRolagem) box.scrollIntoView({ behavior: 'smooth' });
    var tituloResultado = $('.resultado-topo h2', box);
    tituloResultado.tabIndex = -1;
    tituloResultado.focus({ preventScroll: true });
    function destacar(tipo, chave) {
      $$('.ativo', box).forEach(function (el) { el.classList.remove('ativo'); if (el.matches('button,[role="button"]')) el.setAttribute('aria-pressed', 'false'); });
      var titulo = '', texto = '', pontos = [];
      if (tipo === 'ponto') {
        var p = mapa.planetas.find(function (item) { return item.id === chave; });
        if (p) { titulo = p.nome + ' em ' + p.signo; texto = textoDoPlaneta(p); pontos = [chave]; }
        else if (chave === 'asc' && mapa.ascendente) { titulo = 'Ascendente em ' + mapa.ascendente.signo; texto = I.ASCENDENTE[mapa.ascendente.signoIndice]; pontos = [chave]; }
      } else if (tipo === 'casa' && mapa.casas) {
        var n = Number(chave), c = mapa.casas[n - 1];
        if (c) { titulo = 'Casa ' + n + ' em ' + c.signo; texto = 'Cúspide em ' + c.texto + '. Tema simbólico: ' + I.CASAS[n - 1] + '.'; }
      } else if (tipo === 'aspecto') {
        var a = mapa.aspectos[Number(chave)];
        if (a) { titulo = a.nomeA + ' ' + a.aspecto.toLowerCase() + ' ' + a.nomeB; texto = I.textoAspecto(a, mapa); pontos = [a.a, a.b]; }
      }
      if (!titulo) return;
      $('#foco-titulo', box).textContent = titulo;
      $('#foco-texto', box).textContent = texto;
      function marcar(seletor) { $$(seletor, box).forEach(function (el) { el.classList.add('ativo'); if (el.matches('button,[role="button"]')) el.setAttribute('aria-pressed', 'true'); }); }
      pontos.forEach(function (id) { marcar('[data-ponto="' + id + '"]'); });
      if (tipo === 'casa') marcar('[data-casa="' + chave + '"]');
      if (tipo === 'aspecto') marcar('[data-aspecto-index="' + chave + '"]');
    }
    box.onclick = function (e) {
      var alvo = e.target.closest('[data-ponto], [data-casa], [data-aspecto-index]');
      if (!alvo || !box.contains(alvo)) return;
      if (alvo.dataset.ponto) destacar('ponto', alvo.dataset.ponto);
      else if (alvo.dataset.casa) destacar('casa', alvo.dataset.casa);
      else if (alvo.dataset.aspectoIndex) destacar('aspecto', alvo.dataset.aspectoIndex);
      if (alvo.hasAttribute('data-ir-roda')) $('#mapa-visao', box).scrollIntoView({ behavior: 'smooth' });
    };
    box.onkeydown = function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.roda [role="button"]')) { e.preventDefault(); e.target.click(); } };
    destacar('ponto', 'sol');
    $('#btn-imprimir').addEventListener('click', function () { window.print(); });
    $('#btn-csv').addEventListener('click', function () { baixarDados(mapa); });
    $('#btn-compartilhar').addEventListener('click', function () {
      var texto = 'Meu mapa astral: Sol em ' + sol.signo + ', Lua em ' + lua.signo +
        (mapa.ascendente ? ', Ascendente em ' + mapa.ascendente.signo : '') + '. Faça o seu grátis: ' + new URL('index.html', location.href).href;
      Comum.compartilhar(texto);
    });
  }

  function barras(obj) {
    var total = Object.keys(obj).reduce(function (s, k) { return s + obj[k]; }, 0) || 1;
    return '<div class="barras">' + Object.keys(obj).map(function (k, i) {
      var pct = Math.round(obj[k] / total * 100);
      return '<div class="barra"><span>' + k + '</span><div><i style="width:' + pct + '%;background:' + CORES_ELEMENTO[i] + '"></i></div><em>' + pct + '%</em></div>';
    }).join('') + '</div>';
  }

  /* ---------- Formulário ---------- */
  function iniciarFormulario() {
    var form = $('#form-mapa');
    var semHora = $('#sem-hora');
    var repetido = $('#horario-repetido');
    function limparHoraRepetida() {
      repetido.hidden = true;
      $$('input[name="horario-repetido"]', repetido).forEach(function (el) { el.checked = false; });
    }
    semHora.addEventListener('change', function () { $('#hora').disabled = semHora.checked; limparHoraRepetida(); });
    form.addEventListener('input', function (e) { if (['data', 'hora', 'cidade'].indexOf(e.target.id) >= 0) limparHoraRepetida(); });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var erro = $('#form-erro');
      erro.textContent = '';
      var data = $('#data').value;
      var hora = $('#hora').value;
      if (!data) { erro.textContent = 'Informe a data de nascimento.'; return; }
      if (!semHora.checked && !hora) { erro.textContent = 'Informe a hora ou marque "não sei a hora".'; return; }

      var processar = function (cidade) {
        if (!cidade) { erro.textContent = 'Escolha a cidade de nascimento na lista.'; return; }
        var d = data.split('-').map(Number);
        var hm = (hora || '12:00').split(':').map(Number);
        try {
          Validacao.pessoa({data:data,hora:semHora.checked?'':hora,cidade:cidade});
          var mapa = M.calcularMapa({
            ano: d[0], mes: d[1], dia: d[2], hora: hm[0], minuto: hm[1],
            latitude: cidade.lat, longitude: cidade.lon, fuso: cidade.fuso,
            horaDesconhecida: semHora.checked,
            horarioRepetido: $('input[name="horario-repetido"]:checked', repetido)?.value
          });
          repetido.hidden = true;
          renderResultado(mapa, $('#nome').value.trim(), cidade);
          Comum.evento('mapa_gerado', { signo_sol: mapa.planetas[0].signo, origem: Comum.origem() });
        } catch (err) {
          if (/duas vezes/.test(err.message)) repetido.hidden = false;
          erro.textContent = /horário de verão/.test(err.message) ? err.message : 'Não foi possível calcular o mapa. Confira os dados e tente novamente.';
        }
      };

      campoCidade.resolver().then(processar);
    });
  }

  function abrirPelaUrl() {
    var pessoa = arguments[0];
    if (!pessoa) return;
    Validacao.pessoa(pessoa);
    $('#nome').value = pessoa.nome;
    $('#data').value = pessoa.data;
    if (pessoa.hora) $('#hora').value = pessoa.hora;
    else { $('#sem-hora').checked = true; $('#hora').disabled = true; }
    campoCidade.definir(pessoa.cidade);
    var d = pessoa.data.split('-').map(Number);
    var hm = (pessoa.hora || '12:00').split(':').map(Number);
    try {
      var mapa = M.calcularMapa({ ano: d[0], mes: d[1], dia: d[2], hora: hm[0], minuto: hm[1],
        latitude: pessoa.cidade.lat, longitude: pessoa.cidade.lon, fuso: pessoa.cidade.fuso, horaDesconhecida: !pessoa.hora });
      renderResultado(mapa, pessoa.nome, pessoa.cidade);
      Comum.evento('mapa_aberto_por_link', { origem: Comum.origem() });
    } catch (e) {
      if (/duas vezes/.test(e.message)) { $('#horario-repetido').hidden = false; $('#form-erro').textContent = e.message; }
    }
  }

  /* ---------- Início ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    var detalhesAbertos = null;
    window.addEventListener('beforeprint', function () {
      var resultado = $('#resultado');
      if (!resultado || resultado.hidden || detalhesAbertos) return;
      detalhesAbertos = $$('details', resultado).map(function (el) { return el.open; });
      $$('details', resultado).forEach(function (el) { el.open = true; });
    });
    window.addEventListener('afterprint', function () {
      if (!detalhesAbertos) return;
      $$('details', $('#resultado')).forEach(function (el, i) { el.open = detalhesAbertos[i]; });
      detalhesAbertos = null;
    });
    campoCidade = Cidades.autocompletar($('#cidade'), $('#cidade-lista'));
    iniciarFormulario();

    Comum.iniciar();
    Acesso.receber('mapa',function(d){abrirPelaUrl(d.pessoa);});
  });
})();
