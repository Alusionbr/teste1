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
    var svg = ['<svg viewBox="0 0 ' + S + ' ' + S + '" class="roda" role="img" aria-label="Roda do mapa astral">'];
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
        svg.push('<text x="' + n[0] + '" y="' + n[1] + '" class="num-casa">' + (idx + 1) + '</text>');
      });
      var pa = pt(asc, R4 + 26);
      svg.push('<text x="' + pa[0] + '" y="' + (pa[1] - 9) + '" class="rotulo-eixo" text-anchor="middle">ASC</text>');
      var pm = pt(mapa.meioDoCeu.longitude, R4 + 26);
      svg.push('<text x="' + (pm[0] + 14) + '" y="' + pm[1] + '" class="rotulo-eixo" text-anchor="middle">MC</text>');
    }

    // Planetas: afasta símbolos muito próximos
    var ps = mapa.planetas.map(function (p) { return { p: p, pos: p.longitude }; }).sort(function (x, y) { return x.pos - y.pos; });
    for (var k = 0; k < 3; k++) {
      for (var j = 1; j < ps.length; j++) {
        if (ps[j].pos - ps[j - 1].pos < 8) ps[j].pos = ps[j - 1].pos + 8;
      }
    }
    var mapaPos = {};
    ps.forEach(function (o) {
      mapaPos[o.p.id] = pt(o.p.longitude, R4);
      var g = pt(o.pos, (R2 + R3) / 2 - 8);
      var tick = pt(o.p.longitude, R2), tick2 = pt(o.p.longitude, R2 - 8);
      svg.push('<line x1="' + tick[0] + '" y1="' + tick[1] + '" x2="' + tick2[0] + '" y2="' + tick2[1] + '" class="eixo"/>');
      svg.push('<text x="' + g[0] + '" y="' + g[1] + '" class="glifo-planeta"><title>' + o.p.nome + ' ' + o.p.texto + '</title>' + o.p.simbolo + '︎</text>');
    });

    mapa.aspectos.forEach(function (as) {
      var p1 = mapaPos[as.a], p2 = mapaPos[as.b];
      if (!p1 || !p2 || as.aspecto === 'Conjunção') return;
      svg.push('<line x1="' + p1[0] + '" y1="' + p1[1] + '" x2="' + p2[0] + '" y2="' + p2[1] + '" class="aspecto ' + as.tipo + '"/>');
    });

    svg.push('</svg>');
    return svg.join('');
  }

  /* ---------- Leitura gratuita ---------- */
  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  function maior(obj) {
    return Object.keys(obj).reduce(function (a, b) { return obj[a] >= obj[b] ? a : b; });
  }

  function renderResultado(mapa, nome, opcoes) {
    var sol = mapa.planetas[0], lua = mapa.planetas[1];
    var h = [];
    if(mapa.avisoHora)h.push('<p class="nota">'+esc(mapa.avisoHora)+'</p>');
    h.push('<div class="resultado-topo"><h2>' + (nome ? 'Mapa astral de ' + esc(nome) : 'Seu mapa astral') + '</h2>');
    h.push('<p class="trio"><span>☉︎ Sol em <b>' + sol.signo + '</b></span><span>☽︎ Lua em <b>' + lua.signo + '</b></span>' +
      (mapa.ascendente ? '<span>↑ Ascendente em <b>' + mapa.ascendente.signo + '</b></span>' : '') + '</p></div>');

    h.push('<div class="resultado-grade"><div class="roda-caixa">' + desenharRoda(mapa) + '</div><div class="tabela-caixa"><table class="tabela"><thead><tr><th>Planeta</th><th>Posição</th><th>Casa</th></tr></thead><tbody>');
    mapa.planetas.forEach(function (p) {
      h.push('<tr><td>' + p.simbolo + '︎ ' + p.nome + '</td><td>' + p.texto + (p.retrogrado ? ' <abbr title="retrógrado">R</abbr>' : '') + '</td><td>' + (p.casa || '—') + '</td></tr>');
    });
    if (mapa.ascendente) {
      h.push('<tr><td>↑ Ascendente</td><td>' + mapa.ascendente.texto + '</td><td>1</td></tr>');
      h.push('<tr><td>MC Meio do Céu</td><td>' + mapa.meioDoCeu.texto + '</td><td>10</td></tr>');
    }
    h.push('</tbody></table>');
    if (mapa.sistemaCasas) h.push('<p class="nota">Casas: sistema ' + mapa.sistemaCasas + '. Zodíaco tropical.</p>');
    if (mapa.horaDesconhecida) h.push('<p class="nota">Sem a hora de nascimento, não é possível calcular ascendente e casas. A Lua pode ter mudado de signo nesse dia.</p>');
    h.push('</div></div>');

    h.push('<div id="anuncio-resultado" class="anuncio" data-bloco="resultado"></div>');

    h.push('<div class="leitura">');
    h.push('<article><h3>☉︎ Sol em ' + sol.signo + ' — sua essência</h3><p>' + I.SOL[sol.signoIndice] + '</p></article>');
    h.push('<article><h3>☽︎ Lua em ' + lua.signo + ' — suas emoções</h3><p>' + I.LUA[lua.signoIndice] + '</p></article>');
    if (mapa.ascendente) h.push('<article><h3>↑ Ascendente em ' + mapa.ascendente.signo + ' — como você se mostra</h3><p>' + I.ASCENDENTE[mapa.ascendente.signoIndice] + '</p></article>');
    var el = maior(mapa.elementos), mo = maior(mapa.modalidades);
    h.push('<article><h3>Equilíbrio do seu mapa</h3><p>' + I.ELEMENTO[el] + ' ' + I.MODALIDADE[mo] + '</p>' + barras(mapa.elementos) + '</article>');
    h.push('</div>');

    h.push('<details class="leitura"><summary>Explore os outros planetas</summary>');
    mapa.planetas.slice(2).forEach(function (p, idx) {
      var cls = '';
      h.push('<p' + cls + '><b>' + p.simbolo + '︎ ' + p.nome + ' em ' + p.signo + '.</b> ' + I.textoPlaneta(p) + '</p>');
    });
    h.push('</details>');
    h.push('<div class="cta-desbloquear"><p>Uma leitura simbólica pode abrir perguntas. Ela não determina quem você é ou o que vai acontecer.</p><a href="#produtos" class="btn">Conheça o Céu Natal</a></div>');

    if (mapa.aspectos.length) {
      h.push('<div class="leitura"><h3>Aspectos mais fortes</h3><ul class="aspectos">');
      mapa.aspectos.slice(0, 5).forEach(function (a) {
        h.push('<li><b>' + a.nomeA + ' ' + a.aspecto.toLowerCase() + ' ' + a.nomeB + '</b>: ' + I.TIPO_ASPECTO[a.tipo] + '.</li>');
      });
      h.push('</ul></div>');
    }

    h.push('<div class="cta-extra"><a class="cartao-link" href="compatibilidade.html"><b>♡ Compatibilidade grátis</b><span>Explore temas da convivência</span></a>' +
      '<a class="cartao-link" data-link-telegram href="#"><b>✦ Previsão diária no Telegram</b><span>Seu horóscopo calculado pelo seu mapa</span></a></div>');

    h.push('<div class="acoes"><button type="button" class="btn secundario" id="btn-compartilhar">Compartilhar</button><button type="button" class="btn secundario" id="btn-imprimir">Salvar em PDF</button></div>');

    var box = $('#resultado');
    box.innerHTML = h.join('');
    box.hidden = false;
    if (!opcoes || !opcoes.semRolagem) box.scrollIntoView({ behavior: 'smooth' });
    Comum.$$('[data-link-telegram]', box).forEach(function (el) {
      if (CFG.telegram && /^[a-zA-Z0-9_]{5,32}$/.test(CFG.telegram.bot) && CFG.telegram.bot.indexOf('SEU_') !== 0) el.href = 'https://t.me/' + CFG.telegram.bot + '?start=site';
      else el.hidden = true;
    });
    Comum.carregarAnuncio($('#anuncio-resultado'));

    $('#btn-imprimir').addEventListener('click', function () { window.print(); });
    $('#btn-compartilhar').addEventListener('click', function () {
      var texto = 'Meu mapa astral: Sol em ' + sol.signo + ', Lua em ' + lua.signo +
        (mapa.ascendente ? ', Ascendente em ' + mapa.ascendente.signo : '') + '. Faça o seu grátis: ' + (CFG.dominio || location.origin);
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
    semHora.addEventListener('change', function () { $('#hora').disabled = semHora.checked; });

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
            horaDesconhecida: semHora.checked
          });
          renderResultado(mapa, $('#nome').value.trim());
          Comum.evento('mapa_gerado', { signo_sol: mapa.planetas[0].signo, origem: Comum.origem() });
        } catch (err) {
          erro.textContent = 'Não foi possível calcular o mapa. Confira os dados e tente novamente.';
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
      renderResultado(mapa, pessoa.nome);
      Comum.evento('mapa_aberto_por_link', { origem: Comum.origem() });
    } catch (e) { /* link inválido: segue com o formulário vazio */ }
  }

  /* ---------- Início ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    campoCidade = Cidades.autocompletar($('#cidade'), $('#cidade-lista'));
    iniciarFormulario();

    Comum.iniciar();
    Acesso.receber('mapa',function(d){abrirPelaUrl(d.pessoa);});
  });
})();
