/*
 * Textos de interpretação do mapa gratuito.
 * Leituras simbólicas abertas durante o piloto gratuito.
 */
(function (root) {
  'use strict';

  var SOL = [
    'Seu Sol em Áries mostra uma essência pioneira, que precisa começar coisas e sentir que está avançando. Você se afirma pela ação, aprende fazendo e brilha quando tem um desafio pela frente. O aprendizado é transformar impulso em direção, sem atropelar o próprio caminho.',
    'Com o Sol em Touro, sua identidade se constrói pela constância. Você valoriza o que é concreto, bonito e duradouro, e costuma ser a pessoa que sustenta o que os outros só começam. Seu desafio é não confundir segurança com resistência a mudanças necessárias.',
    'O Sol em Gêmeos traz uma mente curiosa, que se renova pela troca de ideias. Você se sente vivo quando aprende, conversa e conecta pessoas e assuntos. O desafio é aprofundar alguns caminhos em vez de se espalhar em muitos ao mesmo tempo.',
    'Com o Sol em Câncer, você brilha cuidando. Sua força está na sensibilidade, na memória afetiva e na capacidade de criar um ambiente de acolhimento. O crescimento vem quando você aprende a se proteger sem se fechar.',
    'Na leitura do Sol em Leão, expressão, criação e inspiração ganham destaque. Generosidade e presença podem ser recursos importantes. Uma pergunta útil é como reconhecer seu valor sem depender sempre do aplauso dos outros.',
    'Com o Sol em Virgem, você se realiza aperfeiçoando. Tem olhar para detalhes, senso prático e vontade genuína de ser útil. O aprendizado é aceitar que o bom feito é melhor que o perfeito não começado.',
    'O Sol em Libra busca harmonia, beleza e justiça. Você se descobre nas relações e tem talento para mediar, negociar e enxergar os dois lados. O desafio é não abrir mão das próprias vontades para manter a paz.',
    'Com o Sol em Escorpião, sua essência é intensa e transformadora. Você não se contenta com a superfície e tem coragem de atravessar crises e renascer delas. O crescimento vem quando a intensidade se torna confiança, e não controle.',
    'O Sol em Sagitário traz uma alma exploradora, movida por sentido, liberdade e expansão. Você aprende viajando, estudando ou questionando. O desafio é transformar o entusiasmo em compromisso com aquilo que realmente importa.',
    'Com o Sol em Capricórnio, você se constrói com disciplina e visão de longo prazo. Assume responsabilidades cedo e conquista respeito pelo que entrega. O aprendizado é permitir-se descansar e celebrar o caminho, não só a chegada.',
    'O Sol em Aquário traz originalidade e espírito coletivo. Você pensa à frente do seu tempo e se sente bem quando contribui para algo maior. O desafio é unir independência com proximidade emocional.',
    'Com o Sol em Peixes, sua essência é sensível, intuitiva e criativa. Você sente o que está no ar e tem enorme capacidade de compaixão. O crescimento vem quando aprende a dar forma aos sonhos e a colocar limites saudáveis.'
  ];

  var LUA = [
    'Lua em Áries: suas emoções são rápidas e diretas. Você precisa de autonomia e reage na hora, mas também esquece rápido. Sente-se seguro quando pode agir.',
    'Lua em Touro: você se acalma com rotina, conforto e presença física. Afeto, para você, é constância. Mudanças bruscas tiram seu chão.',
    'Lua em Gêmeos: você processa sentimentos falando e entendendo. Precisa de conversa, novidade e leveza para se sentir bem.',
    'Lua em Câncer: emoções profundas e memória afetiva forte. Família e lar são seu porto seguro, e cuidar é sua forma de amar.',
    'Lua em Leão: você precisa se sentir visto e valorizado. Expressa afeto com calor e generosidade e floresce com reconhecimento sincero.',
    'Lua em Virgem: você se tranquiliza organizando e sendo útil. Demonstra carinho com gestos práticos, mas precisa cuidar da autocrítica.',
    'Lua em Libra: seu bem-estar depende de harmonia nas relações. Você evita conflitos e se sente em paz em ambientes equilibrados e bonitos.',
    'Lua em Escorpião: emoções intensas e reservadas. Você confia devagar, mas quando se entrega é por inteiro. Precisa de lealdade profunda.',
    'Lua em Sagitário: você precisa de liberdade, humor e horizonte. Lida com as emoções buscando sentido e otimismo.',
    'Lua em Capricórnio: emoções contidas e responsáveis. Você se sente seguro com estrutura e metas, e aprende a mostrar vulnerabilidade com o tempo.',
    'Lua em Aquário: você precisa de espaço e de amizade dentro dos vínculos. Racionaliza o que sente e valoriza relações sem cobranças.',
    'Lua em Peixes: sensibilidade enorme, empatia e imaginação. Você absorve o clima à sua volta e precisa de momentos de recolhimento.'
  ];

  var ASCENDENTE = [
    'Ascendente em Áries: você chega com energia, franqueza e iniciativa. As pessoas percebem alguém decidido e direto.',
    'Ascendente em Touro: sua presença transmite calma, firmeza e bom gosto. Você passa confiança logo de cara.',
    'Ascendente em Gêmeos: você aparece como alguém comunicativo, curioso e ágil, que puxa assunto com facilidade.',
    'Ascendente em Câncer: sua primeira impressão é acolhedora e sensível. As pessoas se sentem à vontade perto de você.',
    'Ascendente em Leão: presença marcante, carisma e calor humano. Difícil passar despercebido.',
    'Ascendente em Virgem: você transmite discrição, cuidado e competência. Observa antes de se expor.',
    'Ascendente em Libra: elegância, simpatia e diplomacia definem sua forma de chegar aos lugares.',
    'Ascendente em Escorpião: olhar intenso e postura magnética. Você revela pouco no início e percebe muito.',
    'Ascendente em Sagitário: entusiasmo, bom humor e espontaneidade. Você abre portas com seu otimismo.',
    'Ascendente em Capricórnio: postura séria, madura e confiável. Você inspira respeito desde o primeiro contato.',
    'Ascendente em Aquário: estilo próprio, jeito original e mente aberta. As pessoas notam sua autenticidade.',
    'Ascendente em Peixes: presença suave, sensível e acolhedora. Você se adapta ao ambiente com facilidade.'
  ];

  // Como cada signo "colore" a energia de um planeta
  var ESTILO_SIGNO = [
    'de forma direta, corajosa e impulsiva',
    'de forma estável, sensorial e paciente',
    'de forma curiosa, versátil e comunicativa',
    'de forma sensível, protetora e afetiva',
    'de forma criativa, generosa e expressiva',
    'de forma analítica, prática e cuidadosa',
    'de forma harmoniosa, sociável e diplomática',
    'de forma intensa, profunda e estratégica',
    'de forma otimista, livre e aventureira',
    'de forma disciplinada, ambiciosa e realista',
    'de forma original, independente e coletiva',
    'de forma intuitiva, compassiva e imaginativa'
  ];

  var FUNCAO_PLANETA = {
    mercurio: 'Mercúrio mostra como você pensa, aprende e se comunica',
    venus: 'Vênus revela como você ama, se relaciona e o que considera bonito e valioso',
    marte: 'Marte indica como você age, luta pelo que quer e expressa a sua energia',
    jupiter: 'Júpiter aponta temas de crescimento, oportunidade e busca de sentido',
    saturno: 'Saturno mostra onde estão suas lições, responsabilidades e conquistas de longo prazo',
    urano: 'Urano, de ciclo geracional, indica como sua geração busca liberdade e inovação',
    netuno: 'Netuno, de ciclo geracional, fala dos sonhos e ideais da sua geração',
    plutao: 'Plutão, de ciclo geracional, mostra os temas de transformação profunda da sua geração',
    nodo: 'O Nodo Norte representa temas simbólicos de aprendizado e direção'
  };

  var CASAS = [
    'identidade e forma de se apresentar',
    'dinheiro, recursos e valores',
    'comunicação, estudos e irmãos',
    'lar, família e raízes',
    'criatividade, romance e prazer',
    'trabalho diário, rotina e saúde',
    'parcerias e relacionamentos',
    'intimidade, crises e transformação',
    'viagens, filosofia e estudos superiores',
    'carreira, reputação e vocação',
    'amizades, grupos e projetos futuros',
    'inconsciente, espiritualidade e recolhimento'
  ];

  var ELEMENTO = {
    Fogo: 'Predomínio de Fogo: entusiasmo, iniciativa e necessidade de movimento. Você se motiva por desafios e inspira os outros.',
    Terra: 'Predomínio de Terra: senso prático, foco em resultados e estabilidade. Você constrói com paciência e confiabilidade.',
    Ar: 'Predomínio de Ar: mente ativa, sociabilidade e facilidade com ideias. Você se movimenta pela troca e pelo conhecimento.',
    'Água': 'Predomínio de Água: sensibilidade, intuição e profundidade emocional. Você sente antes de pensar e percebe o que os outros não dizem.'
  };

  var MODALIDADE = {
    Cardinal: 'Modalidade cardinal em destaque: você gosta de iniciar e liderar.',
    Fixo: 'Modalidade fixa em destaque: você tem foco, persistência e lealdade.',
    'Mutável': 'Modalidade mutável em destaque: você se adapta bem e lida com mudanças com flexibilidade.'
  };

  var TIPO_ASPECTO = {
    harmonico: 'facilita a troca entre essas energias',
    tenso: 'gera tensão que pede ajuste, mas também impulsiona o crescimento',
    neutro: 'funde essas energias, intensificando ambas'
  };

  var TEMAS_PONTO = {
    sol: 'identidade e vontade', lua: 'necessidades emocionais', mercurio: 'pensamento e comunicação',
    venus: 'afeto e valores', marte: 'iniciativa e ação', jupiter: 'expansão e sentido',
    saturno: 'limites e responsabilidade', urano: 'mudança e autonomia',
    netuno: 'imaginação e ideais', plutao: 'transformação',
    asc: 'forma de se apresentar', mc: 'direção pública e carreira'
  };
  var DINAMICA_ASPECTO = {
    'Conjunção': 'aparecem próximos e podem se reforçar ou pedir diferenciação',
    'Sextil': 'encontram uma oportunidade de colaboração que pede iniciativa',
    'Quadratura': 'mostram um contraste que pode pedir ajuste e negociação',
    'Trígono': 'se relacionam com fluidez, um recurso que pode ser usado conscientemente',
    'Oposição': 'apontam para polos que pedem equilíbrio'
  };

  function textoPlaneta(p) {
    var base = FUNCAO_PLANETA[p.id];
    if (!base) return '';
    var t = base + '. Em ' + p.signo + ', essa energia se expressa ' + ESTILO_SIGNO[p.signoIndice] + '.';
    if (p.casa) t += ' Na casa ' + p.casa + ', ela atua em temas de ' + CASAS[p.casa - 1] + '.';
    if (p.retrogrado) t += ' Por estar retrógrado, essa energia tende a ser vivida de forma mais interna e reflexiva.';
    return t;
  }

  function textoAspecto(aspecto, mapa) {
    var pontos = mapa.planetas.slice();
    if (mapa.ascendente) pontos.push(Object.assign({ id: 'asc', casa: 1 }, mapa.ascendente));
    if (mapa.meioDoCeu) pontos.push(Object.assign({ id: 'mc', casa: 10 }, mapa.meioDoCeu));
    function posicao(id) {
      var p = pontos.find(function (item) { return item.id === id; });
      return p ? p.signo + (p.casa ? ', casa ' + p.casa : '') : 'posição não informada';
    }
    return 'Na leitura simbólica, ' + TEMAS_PONTO[aspecto.a] + ' (' + posicao(aspecto.a) + ') e ' +
      TEMAS_PONTO[aspecto.b] + ' (' + posicao(aspecto.b) + ') ' +
      DINAMICA_ASPECTO[aspecto.aspecto] + '. O orbe de ' + aspecto.orbe.toFixed(1) +
      '° mede a distância até o ângulo exato; menor orbe indica maior proximidade geométrica, não uma certeza sobre a pessoa.';
  }

  var API = {
    SOL: SOL, LUA: LUA, ASCENDENTE: ASCENDENTE, ESTILO_SIGNO: ESTILO_SIGNO,
    CASAS: CASAS, ELEMENTO: ELEMENTO, MODALIDADE: MODALIDADE, TIPO_ASPECTO: TIPO_ASPECTO,
    textoPlaneta: textoPlaneta, textoAspecto: textoAspecto
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.Interpretacoes = API;
})(typeof window !== 'undefined' ? window : globalThis);
