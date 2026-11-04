/*
 * Motor de cálculo do mapa natal.
 * Usa a biblioteca astronomy-engine (MIT) para as posições planetárias
 * e calcula ascendente, meio do céu e casas (Placidus, com Porfírio como reserva).
 *
 * Funciona no navegador (variável global Astronomy) e no Node (require).
 */
(function (root) {
  'use strict';

  var A = root.Astronomy || (typeof require !== 'undefined' ? require('astronomy-engine') : null);

  var V = root.Validacao || (typeof require !== 'undefined' ? require('./validacao.js') : null);
  var DEG = Math.PI / 180;
  var SIGNOS = ['Áries', 'Touro', 'Gêmeos', 'Câncer', 'Leão', 'Virgem',
    'Libra', 'Escorpião', 'Sagitário', 'Capricórnio', 'Aquário', 'Peixes'];
  var SIMBOLOS_SIGNOS = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'];

  var PLANETAS = [
    { id: 'sol', nome: 'Sol', simbolo: '☉', corpo: 'Sun' },
    { id: 'lua', nome: 'Lua', simbolo: '☽', corpo: 'Moon' },
    { id: 'mercurio', nome: 'Mercúrio', simbolo: '☿', corpo: 'Mercury' },
    { id: 'venus', nome: 'Vênus', simbolo: '♀', corpo: 'Venus' },
    { id: 'marte', nome: 'Marte', simbolo: '♂', corpo: 'Mars' },
    { id: 'jupiter', nome: 'Júpiter', simbolo: '♃', corpo: 'Jupiter' },
    { id: 'saturno', nome: 'Saturno', simbolo: '♄', corpo: 'Saturn' },
    { id: 'urano', nome: 'Urano', simbolo: '♅', corpo: 'Uranus' },
    { id: 'netuno', nome: 'Netuno', simbolo: '♆', corpo: 'Neptune' },
    { id: 'plutao', nome: 'Plutão', simbolo: '♇', corpo: 'Pluto' },
    { id: 'nodo', nome: 'Nodo Norte', simbolo: '☊', corpo: null }
  ];

  var ASPECTOS = [
    { nome: 'Conjunção', angulo: 0, orbe: 8, tipo: 'neutro' },
    { nome: 'Sextil', angulo: 60, orbe: 5, tipo: 'harmonico' },
    { nome: 'Quadratura', angulo: 90, orbe: 7, tipo: 'tenso' },
    { nome: 'Trígono', angulo: 120, orbe: 7, tipo: 'harmonico' },
    { nome: 'Oposição', angulo: 180, orbe: 8, tipo: 'tenso' }
  ];

  function norm(x) { x = x % 360; return x < 0 ? x + 360 : x; }
  function sind(x) { return Math.sin(x * DEG); }
  function cosd(x) { return Math.cos(x * DEG); }
  function tand(x) { return Math.tan(x * DEG); }
  function atan2d(y, x) { return Math.atan2(y, x) / DEG; }

  /* Longitude eclíptica geocêntrica (eclíptica verdadeira da data) */
  function longitude(corpo, time) {
    if (corpo === 'Sun') return A.SunPosition(time).elon;
    if (corpo === 'Moon') return A.EclipticGeoMoon(time).lon;
    var vec = A.GeoVector(corpo, time, true);
    return A.Ecliptic(vec).elon;
  }

  /* Nodo lunar médio (Meeus) */
  function nodoMedio(time) {
    var T = time.tt / 36525;
    return norm(125.0445479 - 1934.1362891 * T + 0.0020754 * T * T);
  }

  function obliquidade(time) {
    var T = time.tt / 36525;
    var eps0 = 23.439291111 - (46.8150 * T + 0.00059 * T * T - 0.001813 * T * T * T) / 3600;
    // nutação em obliquidade (termos principais)
    var om = 125.04452 - 1934.136261 * T;
    var L = 280.4665 + 36000.7698 * T;
    var Lm = 218.3165 + 481267.8813 * T;
    var deps = (9.20 * cosd(om) + 0.57 * cosd(2 * L) + 0.10 * cosd(2 * Lm) - 0.09 * cosd(2 * om)) / 3600;
    return eps0 + deps;
  }

  function posicaoSigno(lon) {
    lon = norm(lon);
    var idx = Math.floor(lon / 30);
    var g = lon - idx * 30;
    var graus = Math.floor(g);
    var min = Math.floor((g - graus) * 60);
    return {
      longitude: lon,
      signoIndice: idx,
      signo: SIGNOS[idx],
      simboloSigno: SIMBOLOS_SIGNOS[idx],
      grau: g,
      texto: graus + '°' + (min < 10 ? '0' : '') + min + '′ ' + SIGNOS[idx]
    };
  }

  /* Converte RA (graus) em longitude eclíptica, para pontos sobre a eclíptica */
  function raParaLongitude(ra, eps) {
    return norm(atan2d(sind(ra), cosd(ra) * cosd(eps)));
  }

  function ascendente(ramc, lat, eps) {
    var asc = atan2d(cosd(ramc), -(sind(ramc) * cosd(eps) + tand(lat) * sind(eps)));
    return norm(asc);
  }

  function meioDoCeu(ramc, eps) {
    return norm(atan2d(sind(ramc), cosd(ramc) * cosd(eps)));
  }

  function cuspidePlacidus(ramc, lat, eps, fracao, acima) {
    // acima=true: casas 11 e 12 (semiarco diurno); false: casas 2 e 3 (semiarco noturno)
    var ra = acima ? ramc + fracao * 90 : ramc + 180 - fracao * 90;
    var lon = raParaLongitude(ra, eps);
    for (var i = 0; i < 60; i++) {
      var dec = Math.asin(sind(eps) * sind(lon)) / DEG;
      var x = tand(lat) * tand(dec);
      if (Math.abs(x) >= 1) return null; // latitude alta: Placidus não se aplica
      var ad = Math.asin(x) / DEG;
      var novaRa = acima ? ramc + fracao * (90 + ad) : ramc + 180 - fracao * (90 - ad);
      var novaLon = raParaLongitude(novaRa, eps);
      if (Math.abs(((novaLon - lon + 540) % 360) - 180) < 1e-7) { lon = novaLon; break; }
      lon = novaLon;
    }
    return norm(lon);
  }

  function casas(ramc, lat, eps) {
    var asc = ascendente(ramc, lat, eps);
    var mc = meioDoCeu(ramc, eps);
    var c11 = cuspidePlacidus(ramc, lat, eps, 1 / 3, true);
    var c12 = cuspidePlacidus(ramc, lat, eps, 2 / 3, true);
    var c2 = cuspidePlacidus(ramc, lat, eps, 2 / 3, false);
    var c3 = cuspidePlacidus(ramc, lat, eps, 1 / 3, false);
    var sistema = 'Placidus';
    if (c11 === null || c12 === null || c2 === null || c3 === null) {
      // Porfírio: divide cada quadrante em três partes iguais
      sistema = 'Porfírio';
      var q1 = norm(asc - mc) / 3; // MC -> ASC
      var q2 = norm(mc + 180 - asc) / 3; // ASC -> IC
      c11 = norm(mc + q1); c12 = norm(mc + 2 * q1);
      c2 = norm(asc + q2); c3 = norm(asc + 2 * q2);
    }
    var c = [asc, c2, c3, norm(mc + 180), norm(c11 + 180), norm(c12 + 180),
      norm(asc + 180), norm(c2 + 180), norm(c3 + 180), mc, c11, c12];
    return { cuspides: c, ascendente: asc, meioDoCeu: mc, sistema: sistema };
  }

  function casaDe(lon, cuspides) {
    for (var i = 0; i < 12; i++) {
      var ini = cuspides[i], fim = cuspides[(i + 1) % 12];
      var tam = norm(fim - ini);
      if (norm(lon - ini) < tam) return i + 1;
    }
    return 1;
  }

  /*
   * Converte data/hora local de nascimento para UTC usando o fuso IANA
   * (respeita horário de verão histórico conforme a base do navegador).
   */
  function localParaUTC(ano, mes, dia, hora, minuto, fusoIANA) {
    var palpite = Date.UTC(ano, mes - 1, dia, hora, minuto);
    if (!fusoIANA) return new Date(palpite);
    function deslocamento(ms) {
      var fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: fusoIANA, hourCycle: 'h23',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
      var p = {};
      fmt.formatToParts(new Date(ms)).forEach(function (x) { p[x.type] = x.value; });
      var comoUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
      return comoUTC - ms;
    }
    var off = deslocamento(palpite);
    var utc = palpite - off;
    var off2 = deslocamento(utc);
    if (off2 !== off) utc = palpite - off2;
    return new Date(utc);
  }

  function calcularAspectos(pontos) {
    var lista = [];
    for (var i = 0; i < pontos.length; i++) {
      for (var j = i + 1; j < pontos.length; j++) {
        var a = pontos[i], b = pontos[j];
        var d = Math.abs(norm(a.longitude - b.longitude));
        if (d > 180) d = 360 - d;
        for (var k = 0; k < ASPECTOS.length; k++) {
          var asp = ASPECTOS[k];
          var orbe = Math.abs(d - asp.angulo);
          if (orbe <= asp.orbe) {
            lista.push({ a: a.id, b: b.id, nomeA: a.nome, nomeB: b.nome, aspecto: asp.nome, tipo: asp.tipo, orbe: orbe });
            break;
          }
        }
      }
    }
    lista.sort(function (x, y) { return x.orbe - y.orbe; });
    return lista;
  }

  /*
   * dados: { ano, mes, dia, hora, minuto, latitude, longitude, fuso, horaDesconhecida }
   */
  function calcularMapa(dados) {
    V.validar(dados, false);
    var horaDesconhecida = !!dados.horaDesconhecida;
    var h = horaDesconhecida ? 12 : dados.hora;
    var m = horaDesconhecida ? 0 : dados.minuto;
    var dataUTC = localParaUTC(dados.ano, dados.mes, dados.dia, h, m, dados.fuso);
    var time = A.MakeTime(dataUTC);
    var amanha = A.MakeTime(new Date(dataUTC.getTime() + 86400000));
    var eps = obliquidade(time);

    var gast = A.SiderealTime(time); // horas
    var ramc = norm(gast * 15 + dados.longitude);
    var c = casas(ramc, dados.latitude, eps);

    var planetas = PLANETAS.map(function (p) {
      var lon, lon2;
      if (p.corpo) { lon = longitude(p.corpo, time); lon2 = longitude(p.corpo, amanha); }
      else { lon = nodoMedio(time); lon2 = nodoMedio(amanha); }
      var vel = ((lon2 - lon + 540) % 360) - 180;
      var pos = posicaoSigno(lon);
      pos.id = p.id; pos.nome = p.nome; pos.simbolo = p.simbolo;
      pos.retrogrado = p.corpo !== null && p.corpo !== 'Sun' && p.corpo !== 'Moon' && vel < 0;
      pos.casa = horaDesconhecida ? null : casaDe(lon, c.cuspides);
      return pos;
    });

    var pontosAspecto = planetas.filter(function (p) { return p.id !== 'nodo'; });
    if (!horaDesconhecida) {
      var ascP = posicaoSigno(c.ascendente); ascP.id = 'asc'; ascP.nome = 'Ascendente';
      var mcP = posicaoSigno(c.meioDoCeu); mcP.id = 'mc'; mcP.nome = 'Meio do Céu';
      pontosAspecto = pontosAspecto.concat([ascP, mcP]);
    }

    var elementos = { Fogo: 0, Terra: 0, Ar: 0, Água: 0 };
    var modalidades = { Cardinal: 0, Fixo: 0, Mutável: 0 };
    var nomesEl = ['Fogo', 'Terra', 'Ar', 'Água'];
    var nomesMod = ['Cardinal', 'Fixo', 'Mutável'];
    planetas.forEach(function (p) {
      if (p.id === 'nodo') return;
      var peso = (p.id === 'sol' || p.id === 'lua') ? 2 : 1;
      elementos[nomesEl[p.signoIndice % 4]] += peso;
      modalidades[nomesMod[p.signoIndice % 3]] += peso;
    });
    if (!horaDesconhecida) {
      var ia = Math.floor(c.ascendente / 30);
      elementos[nomesEl[ia % 4]] += 2;
      modalidades[nomesMod[ia % 3]] += 2;
    }

    return {
      avisoHora: horaDesconhecida ? 'Sem hora: posições estimadas ao meio-dia; a Lua pode mudar de signo. Ascendente e casas não são calculados.' : null,
      entrada: dados,
      dataUTC: dataUTC.toISOString(),
      horaDesconhecida: horaDesconhecida,
      planetas: planetas,
      ascendente: horaDesconhecida ? null : posicaoSigno(c.ascendente),
      meioDoCeu: horaDesconhecida ? null : posicaoSigno(c.meioDoCeu),
      casas: horaDesconhecida ? null : c.cuspides.map(posicaoSigno),
      sistemaCasas: horaDesconhecida ? null : c.sistema,
      aspectos: calcularAspectos(pontosAspecto),
      elementos: elementos,
      modalidades: modalidades
    };
  }

  var API = {
    calcularMapa: calcularMapa,
    localParaUTC: localParaUTC,
    posicaoSigno: posicaoSigno,
    SIGNOS: SIGNOS,
    SIMBOLOS_SIGNOS: SIMBOLOS_SIGNOS,
    PLANETAS: PLANETAS,
    _interno: { ascendente: ascendente, meioDoCeu: meioDoCeu, obliquidade: obliquidade, casas: casas, longitude: longitude }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.MapaAstral = API;
})(typeof window !== 'undefined' ? window : globalThis);
