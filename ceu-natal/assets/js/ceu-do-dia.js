/*
 * Céu do dia: fase e signo da Lua, planetas retrógrados, aspectos exatos,
 * previsão por signo (Lua passando pelas casas solares) e previsão personalizada
 * (trânsitos do dia sobre o mapa natal de uma pessoa).
 * Depende de MapaAstral (astro.js). Funciona no navegador e no Node.
 */
(function (root) {
  'use strict';

  var M = root.MapaAstral || (typeof require !== 'undefined' ? require('./astro.js') : null);
  var SIGNOS = M.SIGNOS;

  // Ponto de referência para o céu do dia: Brasília, meio-dia no horário de Brasília
  var REF = { latitude: -15.7939, longitude: -47.8828, fuso: 'America/Sao_Paulo' };

  var LUA_SIGNO = [
    'Lua em Áries: dia de iniciativa e pressa. Bom para começar tarefas, ruim para paciência.',
    'Lua em Touro: dia de calma e prazer. Bom para cuidar do corpo, das finanças e comer bem.',
    'Lua em Gêmeos: dia de conversa e movimento. Bom para mensagens, estudos e resolver pendências rápidas.',
    'Lua em Câncer: dia sensível e caseiro. Bom para família, lembranças e cuidar de quem você ama.',
    'Lua em Leão: dia de brilho e generosidade. Bom para se expressar, criar e ser visto.',
    'Lua em Virgem: dia prático e organizado. Bom para limpar a agenda, ajustar detalhes e cuidar da rotina.',
    'Lua em Libra: dia de diplomacia e encontros. Bom para acordos, beleza e vida social.',
    'Lua em Escorpião: dia intenso e profundo. Bom para ir à raiz de um assunto e para a intimidade.',
    'Lua em Sagitário: dia otimista e expansivo. Bom para planos, viagens e aprender algo novo.',
    'Lua em Capricórnio: dia sério e produtivo. Bom para trabalho, metas e decisões de longo prazo.',
    'Lua em Aquário: dia livre e criativo. Bom para amigos, grupos e ideias fora da caixa.',
    'Lua em Peixes: dia intuitivo e sonhador. Bom para descanso, arte, espiritualidade e empatia.'
  ];

  // Lua passando pela casa N contada a partir do signo (casas solares)
  var CASA_DIA = [
    'A Lua está no seu signo: você fica mais sensível e visível. Ótimo dia para cuidar de si e tomar a frente.',
    'Foco em dinheiro e segurança. Revise gastos e valorize o que você já tem antes de comprar por impulso.',
    'Dia de conversas, mensagens e deslocamentos. Responda o que está pendente e aproveite para aprender.',
    'A casa e a família pedem atenção. Bom dia para organizar o lar e ficar perto de quem te acolhe.',
    'Clima de romance, lazer e criatividade. Faça algo que te dê prazer de verdade.',
    'Rotina, trabalho e saúde em destaque. Organize tarefas e cuide do corpo com pequenas atitudes.',
    'As parcerias ganham força. Bom dia para conversar a dois, negociar e ouvir o outro lado.',
    'Dia de intensidade emocional. Bom para encerrar ciclos, resolver questões íntimas e cuidar de finanças compartilhadas.',
    'Vontade de expandir horizontes. Estude, planeje uma viagem ou busque um novo ponto de vista.',
    'Carreira e reputação em evidência. Mostre seu trabalho e dê um passo concreto em direção a uma meta.',
    'Amizades e projetos em grupo favorecidos. Reencontre pessoas e pense no futuro que você quer.',
    'Dia de recolhimento. Descanse, reflita e evite decisões grandes; a intuição está aguçada.'
  ];

  var A = root.Astronomy || (typeof require !== 'undefined' ? require('astronomy-engine') : null);
  // Oito setores de 45°, centrados nos marcos principais (convenção editorial).
  var FASES = [
    {nome:'Lua Nova',texto:'um convite simbólico para começar'},
    {nome:'Lua Crescente',texto:'um convite para desenvolver uma intenção'},
    {nome:'Quarto Crescente',texto:'um convite para ajustar a direção'},
    {nome:'Lua Gibosa Crescente',texto:'um convite para revisar o que está em andamento'},
    {nome:'Lua Cheia',texto:'um convite para observar o que ganhou destaque'},
    {nome:'Lua Gibosa Minguante',texto:'um convite para integrar aprendizados'},
    {nome:'Quarto Minguante',texto:'um convite para rever prioridades'},
    {nome:'Lua Minguante',texto:'um convite para desacelerar e concluir'}
  ];
  var CASA_NATAL = CASA_DIA.slice();
  CASA_NATAL[0] = 'A Lua transita pela primeira casa do seu mapa: um convite para observar sua disposição e cuidar de si.';
  var ACOES = [
    ['Escolha uma pequena prioridade pessoal.','Reserve alguns minutos para perceber como está.'],
    ['Anote um gasto que merece revisão.','Separe uma necessidade de uma vontade de comprar.'],
    ['Escreva com clareza uma mensagem pendente.','Escute antes de formular sua resposta.'],
    ['Organize um pequeno espaço da casa.','Pense em um cuidado que cabe na rotina familiar.'],
    ['Reserve dez minutos para criar algo.','Escolha uma atividade de lazer possível hoje.'],
    ['Divida uma tarefa longa em um primeiro passo.','Ajuste um compromisso para uma rotina mais leve.'],
    ['Faça uma pergunta aberta em uma conversa.','Expresse uma necessidade sem presumir a intenção do outro.'],
    ['Revise uma responsabilidade compartilhada.','Escreva um limite que você precisa comunicar.'],
    ['Leia sobre um assunto que desperta curiosidade.','Reveja uma ideia à luz de outra perspectiva.'],
    ['Defina uma entrega pequena para o trabalho.','Anote um passo concreto para uma meta.'],
    ['Retome contato com alguém por vontade própria.','Identifique uma colaboração possível.'],
    ['Crie uma pausa sem notificações.','Registre o que pode esperar até amanhã.']
  ];
  function faseLunar(elong) {
    if (!Number.isFinite(elong)) throw new Error('Elongação inválida.');
    return FASES[Math.floor((((elong%360)+360)%360+22.5)/45)%8];
  }
  function eventosNoDia(iso) {
    var inicio=new Date(iso+'T03:00:00Z'),fim=inicio.getTime()+86400000;
    return [0,90,180,270].map(function(a,i){
      var t=A.SearchMoonPhase(a,inicio,2);
      if(!t||t.date.getTime()>=fim)return null;
      return {nome:FASES[i*2].nome,utc:t.date.toISOString(),hora:new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit'}).format(t.date)};
    }).filter(Boolean);
  }

  var TEMA_NATAL = {
    sol: 'sua disposição e autoestima',
    lua: 'seu humor e suas necessidades emocionais',
    mercurio: 'conversas, decisões e mensagens',
    venus: 'afetos, prazer e dinheiro',
    marte: 'sua energia e iniciativa',
    asc: 'a forma como você se apresenta',
    mc: 'carreira e objetivos'
  };

  var NOME_TRANSITO = { sol: 'O Sol', lua: 'A Lua', mercurio: 'Mercúrio', venus: 'Vênus', marte: 'Marte' };

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function hojeEmSaoPaulo(data) {
    var d = data || new Date();
    var p = {};
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(d).forEach(function (x) { p[x.type] = x.value; });
    return { ano: +p.year, mes: +p.month, dia: +p.day };
  }

  function mapaDoCeu(data) {
    var h = hojeEmSaoPaulo(data);
    return M.calcularMapa({ ano: h.ano, mes: h.mes, dia: h.dia, hora: 12, minuto: 0,
      latitude: REF.latitude, longitude: REF.longitude, fuso: REF.fuso });
  }

  function separacao(a, b) {
    var d = Math.abs(((a - b) % 360 + 360) % 360);
    return d > 180 ? 360 - d : d;
  }

  var ASPS = [['conjunção', 0, 'neutro'], ['sextil', 60, 'harmonico'], ['quadratura', 90, 'tenso'], ['trígono', 120, 'harmonico'], ['oposição', 180, 'tenso']];

  function aspectoEntre(a, b, orbeMax) {
    var d = separacao(a, b);
    for (var i = 0; i < ASPS.length; i++) {
      var o = Math.abs(d - ASPS[i][1]);
      if (o <= orbeMax) return { nome: ASPS[i][0], tipo: ASPS[i][2], orbe: o };
    }
    return null;
  }

  function ceuDoDia(data) {
    var c = mapaDoCeu(data);
    var h = hojeEmSaoPaulo(data);
    var sol = c.planetas[0], lua = c.planetas[1];
    var elong = ((lua.longitude - sol.longitude) % 360 + 360) % 360;
    var fase = faseLunar(elong);
    var lentos = c.planetas.filter(function (p) { return ['lua', 'nodo'].indexOf(p.id) < 0; });
    var aspectos = [];
    for (var i = 0; i < lentos.length; i++) {
      for (var j = i + 1; j < lentos.length; j++) {
        var as = aspectoEntre(lentos[i].longitude, lentos[j].longitude, 1);
        if (as) aspectos.push({ a: lentos[i].nome, b: lentos[j].nome, aspecto: as.nome, tipo: as.tipo, orbe: as.orbe });
      }
    }
    aspectos.sort(function (x, y) { return x.orbe - y.orbe; });
    return {
      data: h.ano + '-' + pad(h.mes) + '-' + pad(h.dia),
      dataTexto: pad(h.dia) + '/' + pad(h.mes) + '/' + h.ano,
      sol: sol,
      lua: lua,
      fase: fase,
      referencia: 'Posições calculadas para 12h, horário de Brasília.',
      eventos: eventosNoDia(h.ano + '-' + pad(h.mes) + '-' + pad(h.dia)),
      iluminacao: Math.round((1 - Math.cos(elong * Math.PI / 180)) / 2 * 100),
      energia: LUA_SIGNO[lua.signoIndice],
      retrogrados: c.planetas.filter(function (p) { return p.retrogrado; }).map(function (p) { return p.nome; }),
      aspectos: aspectos.slice(0, 3),
      porSigno: SIGNOS.map(function (s, idx) {
        var casa = ((lua.signoIndice - idx + 12) % 12) + 1;
        return { signo: s, indice: idx, simbolo: M.SIMBOLOS_SIGNOS[idx], casa: casa, texto: CASA_DIA[casa - 1] };
      })
    };
  }

  /* Previsão personalizada: trânsitos do dia sobre o mapa natal */
  function previsaoPessoal(mapaNatal, data) {
    var c = mapaDoCeu(data);
    var ceu = ceuDoDia(data);
    var natal = mapaNatal.planetas.filter(function (p) { return ['sol', 'lua', 'mercurio', 'venus', 'marte'].indexOf(p.id) >= 0; })
      .map(function (p) { return { id: p.id, lon: p.longitude }; });
    if (mapaNatal.ascendente) natal.push({ id: 'asc', lon: mapaNatal.ascendente.longitude });
    if (mapaNatal.meioDoCeu) natal.push({ id: 'mc', lon: mapaNatal.meioDoCeu.longitude });

    var transitos = [];
    c.planetas.forEach(function (t) {
      if (!NOME_TRANSITO[t.id]) return;
      var orbe = t.id === 'lua' ? 5 : 1.5;
      natal.forEach(function (n) {
        var as = aspectoEntre(t.longitude, n.lon, orbe);
        if (!as) return;
        var peso = (t.id === 'lua' ? 1 : 2) * (1 - as.orbe / orbe / 2);
        transitos.push({ transito: t.id, natal: n.id, aspecto: as.nome, tipo: as.tipo, orbe: as.orbe, peso: peso });
      });
    });
    transitos.sort(function (x, y) { return y.peso - x.peso; });

    var linhas = [];
    var casaLua;
    if (mapaNatal.casas) {
      var cusp = mapaNatal.casas.map(function (x) { return x.longitude; });
      for (var i = 0; i < 12; i++) {
        var ini = cusp[i], fim = cusp[(i + 1) % 12];
        if (((ceu.lua.longitude - ini) % 360 + 360) % 360 < ((fim - ini) % 360 + 360) % 360) { casaLua = i + 1; break; }
      }
    } else {
      casaLua = ((ceu.lua.signoIndice - mapaNatal.planetas[0].signoIndice + 12) % 12) + 1;
    }
    linhas.push((mapaNatal.casas ? CASA_NATAL : CASA_DIA)[casaLua - 1]);

    transitos.slice(0, 2).forEach(function (t) {
      var quem = NOME_TRANSITO[t.transito];
      var tema = TEMA_NATAL[t.natal];
      var frase;
      if (t.tipo === 'harmonico') frase = quem + ' em ' + t.aspecto + ' com ' + M.PLANETAS.concat([{id:'asc',nome:'Ascendente'},{id:'mc',nome:'Meio do Céu'}]).find(function(p){return p.id===t.natal;}).nome + ' natal: um convite para explorar ' + tema + '.';
      else if (t.tipo === 'tenso') frase = quem + ' em ' + t.aspecto + ': observe ' + tema + ' e dê espaço para refletir antes de agir.';
      else frase = quem + ' em ' + t.aspecto + ': dê atenção a ' + tema + '.';
      linhas.push(frase);
    });

    var dia = Math.floor(Date.parse(ceu.data+'T12:00:00Z')/86400000);
    var acao = ACOES[casaLua-1][(dia+casaLua)%2];
    return { acao: acao, aviso: mapaNatal.avisoHora, ceu: ceu, casaLua: casaLua, transitos: transitos.slice(0, 2), linhas: linhas };
  }

  var API = { faseLunar: faseLunar, eventosNoDia: eventosNoDia, ceuDoDia: ceuDoDia, previsaoPessoal: previsaoPessoal, CASA_DIA: CASA_DIA, LUA_SIGNO: LUA_SIGNO };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.CeuDoDia = API;
})(typeof window !== 'undefined' ? window : globalThis);
