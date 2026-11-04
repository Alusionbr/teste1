/*
 * Busca local de localidades GeoNames no site estático, com capitais embutidas
 * como reserva. O bot continua com a busca local/servidor configurada à parte.
 */
(function (root) {
  'use strict';

  var CAPITAIS = [
    ['Rio de Janeiro', 'RJ', -22.9068, -43.1729, 'America/Sao_Paulo'],
    ['São Paulo', 'SP', -23.5505, -46.6333, 'America/Sao_Paulo'],
    ['Belo Horizonte', 'MG', -19.9167, -43.9345, 'America/Sao_Paulo'],
    ['Vitória', 'ES', -20.3155, -40.3128, 'America/Sao_Paulo'],
    ['Brasília', 'DF', -15.7939, -47.8828, 'America/Sao_Paulo'],
    ['Goiânia', 'GO', -16.6869, -49.2648, 'America/Sao_Paulo'],
    ['Curitiba', 'PR', -25.4284, -49.2733, 'America/Sao_Paulo'],
    ['Florianópolis', 'SC', -27.5954, -48.548, 'America/Sao_Paulo'],
    ['Porto Alegre', 'RS', -30.0346, -51.2177, 'America/Sao_Paulo'],
    ['Salvador', 'BA', -12.9714, -38.5014, 'America/Bahia'],
    ['Recife', 'PE', -8.0476, -34.877, 'America/Recife'],
    ['Fortaleza', 'CE', -3.7319, -38.5267, 'America/Fortaleza'],
    ['Natal', 'RN', -5.7945, -35.211, 'America/Fortaleza'],
    ['João Pessoa', 'PB', -7.1195, -34.845, 'America/Fortaleza'],
    ['Maceió', 'AL', -9.6498, -35.7089, 'America/Maceio'],
    ['Aracaju', 'SE', -10.9472, -37.0731, 'America/Maceio'],
    ['Teresina', 'PI', -5.0892, -42.8019, 'America/Fortaleza'],
    ['São Luís', 'MA', -2.5307, -44.3068, 'America/Fortaleza'],
    ['Belém', 'PA', -1.4558, -48.4902, 'America/Belem'],
    ['Macapá', 'AP', 0.0349, -51.0694, 'America/Belem'],
    ['Palmas', 'TO', -10.184, -48.3336, 'America/Araguaina'],
    ['Manaus', 'AM', -3.119, -60.0217, 'America/Manaus'],
    ['Boa Vista', 'RR', 2.8235, -60.6758, 'America/Boa_Vista'],
    ['Porto Velho', 'RO', -8.7612, -63.9004, 'America/Porto_Velho'],
    ['Rio Branco', 'AC', -9.9754, -67.8249, 'America/Rio_Branco'],
    ['Cuiabá', 'MT', -15.601, -56.0974, 'America/Cuiaba'],
    ['Campo Grande', 'MS', -20.4697, -54.6201, 'America/Campo_Grande']
  ];

  function semAcento(s) { return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
  var indiceCache = {};
  var paises = typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames(['pt-BR'], { type: 'region' }) : null;

  function buscarIndice(termo) {
    var t = semAcento(termo.trim());
    var inicial = t.charAt(0).toUpperCase();
    if (!/^[A-Z]$/.test(inicial)) inicial = '_';
    if (!indiceCache[inicial]) {
      indiceCache[inicial] = fetch('assets/data/cidades/' + inicial + '.json').then(function (r) {
        if (!r.ok) throw new Error('Índice de cidades indisponível.');
        return r.json();
      }).catch(function (e) { delete indiceCache[inicial]; throw e; });
    }
    return indiceCache[inicial].then(function (dados) {
      var exatos = [], proximos = [];
      for (var i = 0; i < dados.length; i++) {
        var c = dados[i], nome = semAcento(c[0]);
        if (nome === t) exatos.push(c);
        else if (nome.indexOf(t) === 0 && proximos.length < 10) proximos.push(c);
        if (exatos.length >= 10) break;
      }
      var encontrados = exatos.concat(proximos).slice(0, 10);
      return encontrados.map(function (c) {
        var pais = paises ? paises.of(c[2]) : c[2];
        return { nome: c[0], detalhe: [c[1], pais].filter(Boolean).join(', '), lat: c[3], lon: c[4], fuso: c[5] };
      });
    });
  }

  function buscarCapitais(termo) {
    var t = semAcento(termo);
    return CAPITAIS.filter(function (c) { return semAcento(c[0]).indexOf(t) === 0; }).map(function (c) {
      return { nome: c[0], detalhe: c[1] + ', Brasil', lat: c[2], lon: c[3], fuso: c[4] };
    });
  }

  function buscarCidades(termo) {
    var servidor=typeof window==='undefined';
    var modo=servidor ? (process.env.GEOCODING_MODE||'local') : ((root.CONFIG.geocodificacao||{}).modo||'local');
    var url;
    if(modo==='local')return Promise.resolve(buscarCapitais(termo));
    if(modo==='indice' && !servidor) {
      return buscarIndice(termo).catch(function () {
        var reserva = buscarCapitais(termo);
        reserva.reduzida = true;
        return reserva;
      });
    }
    if(servidor){
      if(modo!=='comercial'||!process.env.OPEN_METEO_API_KEY)return Promise.resolve(buscarCapitais(termo));
      url='https://customer-geocoding-api.open-meteo.com/v1/search?count=5&language=pt&format=json&apikey='+encodeURIComponent(process.env.OPEN_METEO_API_KEY)+'&name='+encodeURIComponent(termo);
    }else{url='/api/cidades?q='+encodeURIComponent(termo);}
    return fetch(url,{signal:AbortSignal.timeout(6000)}).then(function(r){if(!r.ok)throw new Error('Busca indisponível');return r.json();}).then(function(j){
      if(Array.isArray(j))return j;
      var res=(j.results||[]).filter(function(c){return c.timezone;}).map(function(c){return {nome:c.name,detalhe:[c.admin1,c.country].filter(Boolean).join(', '),lat:c.latitude,lon:c.longitude,fuso:c.timezone};});
      return res.length?res:buscarCapitais(termo);
    }).catch(function(){return buscarCapitais(termo);});
  }

  /* Liga um campo de texto a uma lista de sugestões. Retorna () => cidade escolhida (ou null). */
  function autocompletar(input, lista) {
    var escolhida = null, timer, versao=0;
    var aviso = input.id ? document.getElementById(input.id + '-status') : null;
    if (aviso) input.setAttribute('aria-describedby', ((input.getAttribute('aria-describedby') || '') + ' ' + aviso.id).trim());
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-haspopup', 'listbox');
    function mostrar(aberta) { lista.hidden = !aberta; input.setAttribute('aria-expanded', String(aberta)); }
    function dizer(texto) { if (aviso) aviso.textContent = texto; }
    input.addEventListener('input', function () {
      escolhida = null;
      var atual=++versao;
      clearTimeout(timer);
      var termo = input.value.trim();
      if (termo.length < 3) { mostrar(false); dizer('Digite pelo menos três letras da cidade.'); return; }
      dizer('Buscando cidades…');
      timer = setTimeout(function () {
        buscarCidades(termo).then(function (res) {
          if(atual!==versao)return;
          lista.innerHTML = '';
          res.forEach(function (c, idx) {
            var li = document.createElement('li');
            li.setAttribute('role', 'option');
            li.id = lista.id + '-opcao-' + idx;
            li.tabIndex=0;
            li.addEventListener('keydown',function(e){
              if(e.key==='Enter'||e.key===' '){e.preventDefault();selecionar();input.focus();}
              else if(e.key==='ArrowDown'){e.preventDefault();(li.nextElementSibling||lista.firstElementChild).focus();}
              else if(e.key==='ArrowUp'){e.preventDefault();(li.previousElementSibling||input).focus();}
              else if(e.key==='Escape'){e.preventDefault();mostrar(false);input.focus();}
            });
            li.innerHTML = '<strong></strong> <span></span>';
            li.firstChild.textContent = c.nome;
            li.lastChild.textContent = c.detalhe;
            function selecionar() {
              escolhida = c;
              input.value = c.nome + (c.detalhe ? ' — ' + c.detalhe : '');
              mostrar(false);
              dizer('Cidade selecionada: ' + input.value + '.');
            }
            li.addEventListener('mousedown',function(e){e.preventDefault();selecionar();});
            li.addEventListener('click',selecionar);
            lista.appendChild(li);
          });
          mostrar(!!res.length);
          dizer(res.reduzida ? 'Busca ampliada indisponível. Mostrando apenas capitais brasileiras.' : res.length ? res.length + ' cidades encontradas. Use a seta para baixo e Enter para escolher.' : 'Nenhuma cidade encontrada. Confira o nome ou tente outra grafia.');
        });
      }, 300);
    });
    input.addEventListener('keydown',function(e){if(e.key==='ArrowDown'&&!lista.hidden&&lista.firstChild){e.preventDefault();lista.firstChild.focus();}if(e.key==='Escape')mostrar(false);});
    return {
      obter: function () { return escolhida; },
      definir: function (c) { escolhida = c; input.value = c.nome + (c.detalhe ? ' — ' + c.detalhe : ''); dizer('Cidade selecionada: ' + input.value + '.'); },
      resolver: function () { return Promise.resolve(escolhida); }

    };
  }

  /* Lê uma pessoa dos parâmetros da URL (links vindos do bot). prefixo '' ou 'a_' / 'b_' */
  function pessoaDaUrl(params, prefixo) {
    var p = prefixo || '';
    var d = params.get(p + 'd');
    var lat = parseFloat(params.get(p + 'lat')), lon = parseFloat(params.get(p + 'lon'));
    if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d) || isNaN(lat) || isNaN(lon)) return null;
    var h = params.get(p + 'h') || '';
    var pessoa = {
      nome: (params.get(p + 'n') || '').slice(0, 60),
      data: d,
      hora: /^\d{2}:\d{2}$/.test(h) ? h : '',
      cidade: { nome: params.get(p + 'c') || 'Cidade informada', detalhe: '', lat: lat, lon: lon, fuso: params.get(p + 'tz') || 'America/Sao_Paulo' }
    };
    try {(root.Validacao||(typeof require!=='undefined'?require('./validacao.js'):null)).pessoa(pessoa);return pessoa;}catch(e){return null;}
  }

  var API = { buscarCidades: buscarCidades, buscarCapitais: buscarCapitais, autocompletar: autocompletar, pessoaDaUrl: pessoaDaUrl };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.Cidades = API;
})(typeof window !== 'undefined' ? window : globalThis);
