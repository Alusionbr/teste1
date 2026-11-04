/*
 * Sinastria (compatibilidade entre dois mapas).
 * Recebe dois resultados de MapaAstral.calcularMapa() e devolve uma nota de 0 a 100,
 * notas por área (atração, emoções, diálogo, afinidade) e os aspectos mais marcantes.
 * Funciona no navegador (window.Sinastria) e no Node (require).
 */
(function (root) {
  'use strict';

  var PONTOS = ['sol', 'lua', 'mercurio', 'venus', 'marte', 'jupiter', 'saturno', 'asc'];
  var NOMES = { sol: 'Sol', lua: 'Lua', mercurio: 'Mercúrio', venus: 'Vênus', marte: 'Marte', jupiter: 'Júpiter', saturno: 'Saturno', asc: 'Ascendente' };

  var ASPECTOS = [
    { nome: 'conjunção', angulo: 0, orbe: 8 },
    { nome: 'sextil', angulo: 60, orbe: 5 },
    { nome: 'quadratura', angulo: 90, orbe: 6 },
    { nome: 'trígono', angulo: 120, orbe: 7 },
    { nome: 'oposição', angulo: 180, orbe: 7 }
  ];

  // Peso de cada par de planetas na relação (ordem não importa)
  var PESO_PAR = {
    'venus-marte': 3, 'sol-lua': 3, 'lua-lua': 2.2, 'venus-lua': 2.2, 'venus-venus': 2,
    'sol-venus': 2, 'lua-marte': 1.6, 'sol-sol': 1.5, 'mercurio-mercurio': 1.5, 'sol-asc': 1.5,
    'lua-asc': 1.5, 'venus-asc': 1.5, 'marte-marte': 1.2, 'sol-marte': 1.4, 'mercurio-lua': 1.2,
    'saturno-venus': 1.4, 'saturno-lua': 1.4, 'saturno-sol': 1.2, 'jupiter-venus': 1.2, 'jupiter-sol': 1.2, 'jupiter-lua': 1.2
  };

  var AREAS = {
    atracao: { nome: 'Atração', pontos: ['venus', 'marte'] },
    emocoes: { nome: 'Emoções', pontos: ['lua'] },
    dialogo: { nome: 'Diálogo', pontos: ['mercurio'] },
    afinidade: { nome: 'Afinidade', pontos: ['sol', 'asc', 'jupiter', 'saturno'] }
  };

  var TEMA_PAR = {
    'venus-marte': 'atração física e química entre vocês',
    'sol-lua': 'como um acolhe e o outro ilumina',
    'lua-lua': 'a sintonia emocional no dia a dia',
    'venus-lua': 'carinho, afeto e cuidado mútuo',
    'venus-venus': 'o jeito de amar e de curtir a vida a dois',
    'sol-venus': 'admiração e encanto um pelo outro',
    'lua-marte': 'desejo e reações emocionais',
    'sol-sol': 'o encontro das essências',
    'mercurio-mercurio': 'a conversa e a forma de pensar',
    'sol-asc': 'a primeira impressão e a identificação',
    'lua-asc': 'o conforto de estar junto',
    'venus-asc': 'o charme que um vê no outro',
    'marte-marte': 'a energia e a forma de agir',
    'sol-marte': 'iniciativa e estímulo mútuo',
    'mercurio-lua': 'entender o que o outro sente',
    'saturno-venus': 'compromisso e responsabilidade afetiva',
    'saturno-lua': 'segurança e limites emocionais',
    'saturno-sol': 'estabilidade e cobranças',
    'jupiter-venus': 'generosidade e alegria no amor',
    'jupiter-sol': 'crescimento e incentivo',
    'jupiter-lua': 'otimismo e acolhimento'
  };

  // Calibração: desloca as notas para que a mediana de casais aleatórios fique perto de 60
  var AJUSTE = { total: -2.5, escala: 7, area: -1 };

  function chave(a, b) { return [a, b].sort().join('-'); }
  [PESO_PAR,TEMA_PAR].forEach(function(t){Object.keys(t).forEach(function(k){var ids=k.split('-');var normal=chave(ids[0],ids[1]);if(normal!==k){t[normal]=t[k];delete t[k];}});});

  function valorAspecto(asp, a, b) {
    var suaves = ['sol', 'lua', 'venus', 'jupiter', 'asc'];
    switch (asp) {
      case 'trígono': return 1;
      case 'sextil': return 0.8;
      case 'conjunção':
        if (a === 'saturno' || b === 'saturno') return -0.2;
        return (suaves.indexOf(a) >= 0 || suaves.indexOf(b) >= 0) ? 0.9 : 0.4;
      case 'quadratura': return -0.7;
      case 'oposição': return (a === 'saturno' || b === 'saturno') ? -0.6 : -0.2;
    }
    return 0;
  }

  function pontosDoMapa(m) {
    var lista = m.planetas.filter(function (p) { return PONTOS.indexOf(p.id) >= 0; })
      .map(function (p) { return { id: p.id, lon: p.longitude, signoIndice: p.signoIndice }; });
    if (m.ascendente) lista.push({ id: 'asc', lon: m.ascendente.longitude, signoIndice: m.ascendente.signoIndice });
    return lista;
  }

  function nota(soma, escala) {
    var n = 50 + 50 * Math.tanh(soma / escala);
    return Math.max(5, Math.min(98, Math.round(n)));
  }

  function calcular(mapaA, mapaB) {
    var pa = pontosDoMapa(mapaA), pb = pontosDoMapa(mapaB);
    var aspectos = [];
    var total = 0;
    var areas = {};
    Object.keys(AREAS).forEach(function (k) { areas[k] = 0; });

    pa.forEach(function (x) {
      pb.forEach(function (y) {
        var d = Math.abs(((x.lon - y.lon) % 360 + 360) % 360);
        if (d > 180) d = 360 - d;
        for (var i = 0; i < ASPECTOS.length; i++) {
          var asp = ASPECTOS[i];
          var orbe = Math.abs(d - asp.angulo);
          if (orbe > asp.orbe) continue;
          var k = chave(x.id, y.id);
          var peso = PESO_PAR[k] || 0.6;
          var forca = 1 - (orbe / asp.orbe) * 0.6;
          var v = valorAspecto(asp.nome, x.id, y.id) * peso * forca;
          total += v;
          Object.keys(AREAS).forEach(function (ak) {
            var pts = AREAS[ak].pontos;
            if (pts.indexOf(x.id) >= 0 || pts.indexOf(y.id) >= 0) areas[ak] += v;
          });
          aspectos.push({
            a: x.id, b: y.id, nomeA: NOMES[x.id], nomeB: NOMES[y.id], aspecto: asp.nome,
            orbe: orbe, valor: v, tema: TEMA_PAR[k] || null
          });
          break;
        }
      });
    });

    // Elementos dos Sóis: fogo-ar e terra-água combinam; mesmo elemento também
    var elA = pa[0].signoIndice % 4, elB = pb[0].signoIndice % 4;
    // índices: 0 fogo, 1 terra, 2 ar, 3 água → fogo+ar e terra+água diferem em 2
    var bonusEl = (elA === elB) ? 1 : (Math.abs(elA - elB) === 2 ? 0.8 : -0.3);
    total += bonusEl;

    var notas = {};
    Object.keys(AREAS).forEach(function (k) { notas[k] = { nome: AREAS[k].nome, nota: nota(areas[k] + AJUSTE.area, 3) }; });

    aspectos.sort(function (x, y) { return Math.abs(y.valor) - Math.abs(x.valor); });

    // Destaques variados: no máximo uma vez cada planeta lento e pelo menos um ponto de atrito, se houver
    var destaques = [], usados = {};
    var comTema = aspectos.filter(function (a) { return a.tema; });
    var tenso = comTema.filter(function (a) { return a.valor < 0; })[0];
    comTema.forEach(function (a) {
      if (destaques.length >= (tenso ? 3 : 4)) return;
      if (a === tenso) return;
      var lentoA = ['jupiter', 'saturno'].indexOf(a.a) >= 0 ? a.a : null;
      var lentoB = ['jupiter', 'saturno'].indexOf(a.b) >= 0 ? a.b : null;
      if ((lentoA && usados[lentoA]) || (lentoB && usados[lentoB])) return;
      if (lentoA) usados[lentoA] = true;
      if (lentoB) usados[lentoB] = true;
      destaques.push(a);
    });
    if (tenso) destaques.push(tenso);

    return {
      nota: nota(total + AJUSTE.total, AJUSTE.escala),
      areas: notas,
      aspectos: aspectos,
      destaques: destaques
    };
  }

  function resumo(n) {
    if (n >= 85) return 'O índice simbólico reúne mais aspectos classificados como harmônicos. Isso não prevê sentimentos nem o futuro da relação.';
    if (n >= 70) return 'Nesta leitura simbólica predominam aspectos harmônicos, com diferenças a explorar por meio do diálogo.';
    if (n >= 55) return 'Boa compatibilidade, com pontos de encaixe claros e algumas diferenças que pedem diálogo.';
    if (n >= 40) return 'A pontuação reúne aspectos de diferentes tipos. Use os temas como reflexão, sem presumir atração ou sentimentos.';
    return 'Combinação desafiadora. Há atrito entre os jeitos de ser, e a relação exige maturidade e vontade dos dois.';
  }

  function descreverAspecto(as, nomeA, nomeB) {
    var bom = as.valor >= 0;
    var base = as.nomeA + ' de ' + (nomeA || 'Pessoa 1') + ' em ' + as.aspecto + ' com ' + as.nomeB + ' de ' + (nomeB || 'Pessoa 2');
    var efeito = bom ? 'favorece ' + as.tema : 'pede cuidado com ' + as.tema;
    return base + ' — ' + efeito + '.';
  }

  var API = { AJUSTE: AJUSTE, calcular: calcular, resumo: resumo, descreverAspecto: descreverAspecto, NOMES: NOMES };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.Sinastria = API;
})(typeof window !== 'undefined' ? window : globalThis);
