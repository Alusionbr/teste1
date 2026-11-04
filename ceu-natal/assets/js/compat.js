/*
 * Página de compatibilidade: formulário de duas pessoas, cálculo da sinastria,
 * nota do casal, notas por área e aspectos em destaque.
 */
(function () {
  'use strict';

  var CFG = window.CONFIG;
  var M = window.MapaAstral;
  var S = window.Sinastria;
  var $ = Comum.$, esc = Comum.esc;
  var campos = {};

  function mapaDe(pessoa) {
    Validacao.pessoa(pessoa);
    var d = pessoa.data.split('-').map(Number);
    var hm = (pessoa.hora || '12:00').split(':').map(Number);
    return M.calcularMapa({ ano: d[0], mes: d[1], dia: d[2], hora: hm[0], minuto: hm[1],
      latitude: pessoa.cidade.lat, longitude: pessoa.cidade.lon, fuso: pessoa.cidade.fuso, horaDesconhecida: !pessoa.hora });
  }

  function anel(nota) {
    var r = 70, c = 2 * Math.PI * r, dash = c * nota / 100;
    return '<svg viewBox="0 0 180 180" class="anel" role="img" aria-label="Nota ' + nota + ' de 100">' +
      '<circle cx="90" cy="90" r="' + r + '" class="anel-fundo"/>' +
      '<circle cx="90" cy="90" r="' + r + '" class="anel-valor" stroke-dasharray="' + dash + ' ' + c + '" transform="rotate(-90 90 90)"/>' +
      '<text x="90" y="98" class="anel-num">' + nota + '</text></svg>';
  }

  function render(a, b) {
    var ma = mapaDe(a), mb = mapaDe(b);
    var r = S.calcular(ma, mb);
    var nA = a.nome || 'Pessoa 1', nB = b.nome || 'Pessoa 2';
    var h = [];
    h.push('<div class="compat-topo">' + anel(r.nota) + '<div><h2>' + esc(nA) + ' &amp; ' + esc(nB) + '</h2>' +
      '<p class="trio"><span>☉︎ ' + ma.planetas[0].signo + '</span><span>×</span><span>☉︎ ' + mb.planetas[0].signo + '</span></p>' +
      '<p>' + S.resumo(r.nota) + '</p></div></div>');
    h.push('<div class="barras areas">');
    Object.keys(r.areas).forEach(function (k) {
      var ar = r.areas[k];
      h.push('<div class="barra"><span>' + ar.nome + '</span><div><i style="width:' + ar.nota + '%"></i></div><em>' + ar.nota + '/100</em></div>');
    });
    h.push('</div>');
    h.push('<div class="anuncio" id="anuncio-compat" data-bloco="compatibilidade"></div>');
    if (r.destaques.length) {
      h.push('<div class="leitura"><h3>O que mais marca a relação</h3><ul class="aspectos">');
      r.destaques.forEach(function (d) { h.push('<li>' + esc(S.descreverAspecto(d, nA, nB)) + '</li>'); });
      h.push('</ul></div>');
    }
    h.push('<p class="nota">Índice simbólico de 0 a 100. Não representa uma probabilidade, não revela sentimentos e não determina o futuro da relação.</p>');
    if(ma.avisoHora||mb.avisoHora)h.push('<p class="nota">Sem hora, usamos posições aproximadas ao meio-dia; a Lua e o índice podem mudar.</p>');
    h.push('<div class="acoes"><button type="button" class="btn secundario" id="btn-compartilhar">Compartilhar resultado</button><a class="btn secundario" href="index.html">Fazer meu mapa astral</a></div>');

    var box = $('#resultado-compat');
    box.innerHTML = h.join('');
    box.hidden = false;
    box.scrollIntoView({ behavior: 'smooth' });
    Comum.carregarAnuncio($('#anuncio-compat'));
    $('#btn-compartilhar').addEventListener('click', function () {
      Comum.compartilhar('Nosso índice simbólico no mapa astral foi ' + r.nota + '/100 (índice simbólico). Explore o seu: ' + new URL('compatibilidade.html', location.href).href);
    });
    Comum.evento('compatibilidade_gerada', { nota: r.nota, origem: Comum.origem() });
  }

  function lerPessoa(p) {
    return { nome: $('#' + p + '-nome').value.trim(), data: $('#' + p + '-data').value, hora: $('#' + p + '-hora').value };
  }

  function preencher(p, pessoa) {
    $('#' + p + '-nome').value = pessoa.nome;
    $('#' + p + '-data').value = pessoa.data;
    $('#' + p + '-hora').value = pessoa.hora;
    campos[p].definir(pessoa.cidade);
  }

  document.addEventListener('DOMContentLoaded', function () {
    campos.a = Cidades.autocompletar($('#a-cidade'), $('#a-cidade-lista'));
    campos.b = Cidades.autocompletar($('#b-cidade'), $('#b-cidade-lista'));
    Comum.iniciar();

    $('#form-compat').addEventListener('submit', function (e) {
      e.preventDefault();
      var erro = $('#compat-erro');
      erro.textContent = '';
      var a = lerPessoa('a'), b = lerPessoa('b');
      if (!a.data || !b.data) { erro.textContent = 'Informe a data de nascimento das duas pessoas.'; return; }
      Promise.all([campos.a.resolver(), campos.b.resolver()]).then(function (cs) {
        if (!cs[0] || !cs[1]) { erro.textContent = 'Escolha a cidade de nascimento das duas pessoas.'; return; }
        a.cidade = cs[0]; b.cidade = cs[1];
        try { render(a, b); } catch (err) { erro.textContent = 'Não foi possível calcular. Confira os dados.'; }
      });
    });

    Acesso.receber('compat',function(d){Validacao.pessoa(d.a);Validacao.pessoa(d.b);preencher('a',d.a);preencher('b',d.b);render(d.a,d.b);});

  });
})();
