/*
 * oficial.js — lista oficial de atrações do Beto Carrero World.
 *
 * Fonte: www.interno.betocarrero.com.br/atracoes (lista do próprio parque),
 * conferida em 16/10/2026. Altura mínima e horário de show vêm de lá.
 * Área temática: guia Melhores Destinos (2026), só quando bate com o texto oficial.
 *
 * osm: ids de park-data.js que são esta atração (posição vem de lá).
 *   Sem osm = o OpenStreetMap não tem a posição: aparece na lista com o botão
 *   "Estou aqui agora", e a posição informada pelos visitantes vai para o
 *   servidor (parque.lugares, kind "atracao", ref_id = id daqui).
 *
 * disputado: atração com Fast Pass à venda no parque (sinal de fila longa).
 *   É a lista usada no modo "Hora do Show".
 *
 * Mudou o parque? Edite aqui, suba a versão (store.js, sw.js, index.html).
 */
"use strict";

const OFICIAL_FONTE = "Lista oficial do parque (betocarrero.com.br), conferida em 16/10/2026";

// Shows: horário oficial de cada sessão. DURACAO_SHOW_MIN é estimativa.
const DURACAO_SHOW_MIN = 40;

const OFICIAL = [
  // ---- radicais e montanhas-russas
  { id: "of-firewhip", name: "Fire Whip", cat: "montanha", area: "Aventura Radical", altura: 1.30, disputado: true, osm: ["osm-firewhip"] },
  { id: "of-big-drop", name: "Big Drop", cat: "atracao", area: "Hot Wheels", altura: 1.30, disputado: true, osm: ["osm-big-tower"], nota: "Torre de queda de 100 m (no OpenStreetMap: Big Tower)." },
  { id: "of-rebulico", name: "Rebuliço", cat: "atracao", area: "Cowboyland", altura: 1.20, disputado: true },
  { id: "of-spin-blast", name: "Spin Blast", cat: "atracao", area: "Nerf Mania", altura: 1.20, disputado: true, nota: "Disco gigante para 40 pessoas girando num trilho em onda." },
  { id: "of-tchibum", name: "Tchibum", cat: "aquatico", area: "Aventura Radical", altura: 1.30, disputado: true, osm: ["osm-tchibum"], nota: "Molha." },
  { id: "of-crazy-river", name: "Madagascar Crazy River Adventure", cat: "aquatico", area: "Madagascar", altura: 1.05, disputado: true, osm: ["osm-madagascar-crazy-river-adventure", "osm-madagascar-crazy-river"], nota: "Molha." },
  { id: "of-portal", name: "Portal da Escuridão", cat: "atracao", area: "Aventura Radical", pago: true, osm: ["osm-portal-da-escuridao"], nota: "Idade mínima 7 anos." },
  { id: "of-tigor", name: "Tigor Mountain", cat: "montanha", area: "Vila Germânica", altura: 0.95, disputado: true, osm: ["osm-tigor-mountain"] },
  { id: "of-dum-dum", name: "Montanha-Russa Dum Dum", cat: "montanha", area: "Cowboyland", altura: 0.80, disputado: true, osm: ["osm-montanha-russa-dum-dum"] },
  { id: "of-barco-pirata", name: "Barco Pirata", cat: "atracao", area: "Ilha dos Piratas", altura: 1.20, disputado: true, osm: ["osm-barco-pirata"] },

  // ---- família e infantil
  { id: "of-turbo-drive", name: "Hot Wheels Turbo Drive", cat: "atracao", area: "Hot Wheels", altura: 0.95, disputado: true, nota: "De 0,95 m a 1,30 m só acompanhado; pilota acima de 1,30 m." },
  { id: "of-super-soaker", name: "Super Soaker Splash", cat: "aquatico", area: "Nerf Mania", altura: 0.90, disputado: true, nota: "Molha. De 0,90 m a 1,20 m só acompanhado." },
  { id: "of-raskapuska", name: "Raskapuska", cat: "aquatico", area: "Cowboyland", altura: 0.80, disputado: true, osm: ["osm-raskapuska"] },
  { id: "of-betinho-2d", name: "Betinho Carrero 2D", cat: "atracao", area: "Cowboyland", altura: 1.10 },
  { id: "of-autopista", name: "Autopista (bate-bate)", cat: "atracao", area: "Vila Germânica", altura: 1.10, osm: ["osm-autopista"] },
  { id: "of-xicaras", name: "Xícaras Malucas", cat: "infantil", area: "Triplikland", osm: ["osm-xicaras-malucas"] },
  { id: "of-baby-elefante", name: "Baby Elefante", cat: "infantil", area: "Triplikland", osm: ["osm-baby-elefante"] },
  { id: "of-carrossel", name: "Carrossel Veneziano", cat: "infantil", area: "Vila Germânica", osm: ["osm-carrossel-veneziano"] },
  { id: "of-roda-gigante", name: "Roda-Gigante", cat: "atracao", area: "Triplikland", osm: ["osm-roda-gigante"] },
  { id: "of-ferrovia", name: "Ferrovia DinoMagic", cat: "atracao", area: "Terra da Fantasia", osm: ["osm-ferrovia-dinomagic"], nota: "Embarque na Estação João Alves de Queiroz." },
  { id: "of-nerf-arcade", name: "NERF Arcade", cat: "atracao", area: "Nerf Mania", pago: true },
  { id: "of-hw-extreme-kids", name: "Hot Wheels Extreme Kids (jipes elétricos)", cat: "infantil", area: "Hot Wheels", pago: true, secundaria: true, nota: "Crianças de 4 a 10 anos, ~10 min. Não consta na lista oficial de atrações (fonte: guia Melhores Destinos e outra reportagem): confirme no parque." },

  // ---- shows (horários oficiais)
  { id: "of-papo-galinheiro", name: "Papo de Galinheiro", cat: "show", area: "Galinha Pintadinha", horarios: ["11:00"] },
  { id: "of-excalibur", name: "Excalibur", cat: "show", area: "Vila Germânica", horarios: ["12:00"], pago: true, osm: ["osm-excalibur"], grande: true },
  { id: "of-dodoi", name: "O Dodói da Galinha Pintadinha", cat: "show", area: "Galinha Pintadinha", horarios: ["12:30"] },
  { id: "of-hw-epic-show", name: "Hot Wheels Epic Show", cat: "show", area: "Hot Wheels", horarios: ["13:30"], grande: true, nota: "Arena para 3 mil pessoas: o show mais disputado do parque." },
  { id: "of-circus", name: "Madagascar Circus Show", cat: "show", area: "Madagascar", horarios: ["15:00"], osm: ["osm-madagascar-circus-show"], grande: true },
  { id: "of-sonho-cowboy", name: "O Sonho do Cowboy", cat: "show", area: "Cowboyland", horarios: ["18:00"], osm: ["osm-o-sonho-do-cowboy"] },
  { id: "of-trolls", name: "No Ritmo de Trolls", cat: "show", area: "Praça de Eventos", horarios: ["19:00"], osm: ["osm-praca-de-eventos"] },

  // ---- para ver e fotografar
  // ver: true = lugar para visitar/fotografar, sem fila; fica fora do plano do dia e do progresso.
  { id: "of-castelo", name: "Castelo das Nações", cat: "atracao", ver: true, osm: ["osm-castelo-das-nacoes"] },
  { id: "of-memorial", name: "Memorial Beto Carrero", cat: "atracao", ver: true, osm: ["osm-beto-carrero-memory"] },
  { id: "of-estacao", name: "Estação João Alves de Queiroz", cat: "atracao", ver: true, osm: ["osm-estacao-joao-alves-de-queiroz"], nota: "Embarque da Ferrovia DinoMagic." },
  { id: "of-ponte-pensil", name: "Ponte Pênsil", cat: "atracao", ver: true, area: "Ilha dos Piratas" },
  { id: "of-chapeu-bota", name: "Chapéu e Bota Gigante", cat: "foto", area: "Cowboyland" },
  { id: "of-romero-britto", name: "Esculturas Romero Britto", cat: "foto" },
  { id: "of-foto-galinha", name: "Fotos com a Turma da Galinha Pintadinha", cat: "foto", area: "Galinha Pintadinha" },
  { id: "of-foto-trolls", name: "Fotos com Trolls", cat: "foto" },
  { id: "of-foto-betinho", name: "Fotos com Betinho e Lully", cat: "foto", area: "Cowboyland", perto: { ref: "osm-raskapuska", dx: 14, dy: 10, texto: "ao lado do Raskapuska" } },
  { id: "of-foto-shrek", name: "Fotos com Shrek e sua turma", cat: "foto" },
  { id: "of-foto-madagascar", name: "Fotos com a Turma do Madagascar", cat: "foto", area: "Madagascar" },
  { id: "of-foto-po", name: "Fotos com Po do Kung Fu Panda", cat: "foto" },
  { id: "of-foto-megamente", name: "Fotos com Megamente e Metro Man", cat: "foto" },
  { id: "of-foto-bob", name: "Fotos com Bob Esponja e sua turma", cat: "foto", perto: { ref: "osm-vila-germanica", dx: 18, dy: 14, texto: "próximo à Vila Germânica" } }
];

// Lugares do OpenStreetMap que NÃO estão na lista oficial atual.
// Ficam no mapa (o prédio existe), mas avisam que podem estar fechados.
const OSM_FORA_DA_LISTA = {
  "osm-star-mountain": "Desativada em setembro de 2026.",
  "osm-velozes-e-furiosos": "Não está na lista oficial atual: provavelmente fechado ou com outro nome.",
  "osm-cine-a-era-do-gelo": "Não está na lista oficial atual: pode estar fechado ou com outro nome.",
  "osm-cine-renato-aragao": "Não está na lista oficial atual: pode estar fechado ou com outro nome.",
  "osm-shrek-o-fantasma-de-lord-farquaad": "Não está na lista oficial atual: pode estar fechado ou com outro nome.",
  "osm-palacio-das-serpentes": "Não está na lista oficial atual: pode estar fechado ou com outro nome.",
  "osm-zoologico": "Não está na lista oficial atual: pode estar fechado ou com outro nome.",
  "osm-mundo-dos-cavalos": "Não está na lista oficial atual: pode estar fechado ou com outro nome.",
  "osm-cavalaria": "Não está na lista oficial atual: pode estar fechado ou com outro nome.",
  "osm-labirinto-dos-unicornios": "Não está na lista oficial atual: pode estar fechado ou com outro nome.",
  "osm-trenzinho-vila-esperanca": "Não está na lista oficial atual: pode estar fechado ou com outro nome.",
  "osm-acqua-boat": "Não está na lista oficial atual: pode estar fechado ou com outro nome.",
  "osm-pedalinho": "Não está na lista oficial atual: pode estar fechado ou com outro nome.",
  "osm-kid-play": "Não está na lista oficial atual: pode estar fechado ou com outro nome.",
  "osm-ataliba-grill": "Restaurante do mapa que não está na lista oficial de alimentação: pode estar fechado ou com outro nome.",
  "osm-bierhaus": "Bar do mapa que não está na lista oficial de alimentação: pode estar fechado ou com outro nome.",
  "osm-palacio-dos-sorvetes": "Sorveteria do mapa. A lista oficial tem “Sobremesas” (sorvete e picolé): pode ser a mesma."
};

// Áreas temáticas: usadas para dar uma posição APROXIMADA a quem o OpenStreetMap
// não tem. A posição é o centro de atrações da mesma área que têm posição medida.
// Sai com marcador tracejado e aviso; quem marcar "Estou aqui agora" substitui.
//
// Nerf Mania não tem nenhuma atração medida: o guia descreve o circuito saindo da
// entrada (Castelo das Nações) e passando por Nerf Mania antes da Aventura Radical,
// então a estimativa fica entre o Castelo e o Portal da Escuridão.
const AREAS = {
  "Cowboyland":         { ancoras: ["osm-o-sonho-do-cowboy", "osm-montanha-russa-dum-dum", "osm-raskapuska"] },
  "Hot Wheels":         { ancoras: ["osm-big-tower"], nota: "O Big Drop fica na área Hot Wheels." },
  "Nerf Mania":         { ancoras: ["osm-castelo-das-nacoes", "osm-portal-da-escuridao"], nota: "Estimada pela ordem do circuito do parque (entre a entrada e a Aventura Radical)." },
  "Madagascar":         { ancoras: ["osm-madagascar-crazy-river-adventure", "osm-madagascar-circus-show"] },
  "Vila Germânica":     { ancoras: ["osm-vila-germanica", "osm-tigor-mountain", "osm-carrossel-veneziano"] },
  "Triplikland":        { ancoras: ["osm-triplikland", "osm-roda-gigante"] },
  "Ilha dos Piratas":   { ancoras: ["osm-ilha-dos-piratas", "osm-barco-pirata"] },
  "Aventura Radical":   { ancoras: ["osm-firewhip", "osm-tchibum", "osm-portal-da-escuridao"] },
  "Terra da Fantasia":  { ancoras: ["osm-estacao-joao-alves-de-queiroz"] },
  "Praça de Eventos":   { ancoras: ["osm-praca-de-eventos"] },
  "Praça de alimentação": { ancoras: ["osm-praca-de-alimentacao"], nota: "PALPITE: o texto oficial não diz onde fica; usamos a praça de alimentação do mapa. Confirme e marque o ponto certo." }
  // "Galinha Pintadinha": sem nenhuma pista de posição — fica sem posição até alguém marcar.
};

// Alimentação: lista oficial (www.interno.betocarrero.com.br/restaurantes), 16/10/2026.
//   tipo: refeicao | lanche | doce | bebida
//   refeicao: true = serve almoço de verdade (entra no planejamento de almoço)
//   perto: pista de localização dada no texto oficial; area: só quando o texto ou o tema indica
const COMIDA = [
  { id: "of-comida-burguer-mania", name: "Burguer Mania", tipo: "refeicao", refeicao: true, area: "Nerf Mania", desc: "Hambúrgueres, na área Nerf Mania." },
  { id: "of-comida-hot-wheels", name: "Restaurante Hot Wheels", tipo: "refeicao", refeicao: true, area: "Hot Wheels", desc: "Lanches, com vista para as manobras do show." },
  { id: "of-comida-hungry-dogs", name: "Hungry Dogs", tipo: "refeicao", refeicao: true, area: "Praça de alimentação", desc: "Cachorro-quente (Dog Americano)." },
  { id: "of-comida-excalibur", name: "Restaurante Excalibur", tipo: "refeicao", refeicao: true, pago: true, perto: { ref: "osm-excalibur", dx: 0, dy: 16, texto: "na arena do Excalibur" }, desc: "Lanche incluso no ingresso do show Excalibur (12:00), que é pago à parte." },
  { id: "of-comida-casa-de-massas", name: "Casa de Massas Anjos à Gula", tipo: "refeicao", refeicao: true, area: "Praça de alimentação", desc: "Massas e carta de vinhos, ambiente climatizado." },
  { id: "of-comida-pizza-hut", name: "Pizza Hut", tipo: "refeicao", refeicao: true, area: "Praça de alimentação", desc: "Pizza." },
  { id: "of-comida-billy-the-beef", name: "Billy the Beef", tipo: "refeicao", refeicao: true, area: "Praça de alimentação", desc: "Pratos: frango, parmegiana, estrogonofe, carne de panela." },
  { id: "of-comida-natural-mix", name: "Natural Mix", tipo: "refeicao", refeicao: true, perto: { ref: "osm-star-mountain", dx: 22, dy: 20, texto: "próximo à Star Mountain" }, desc: "Sanduíche (carne, vegetariano ou vegano), tapioca, crepe e sucos naturais." },
  { id: "of-comida-mexico", name: "México", tipo: "refeicao", refeicao: true, area: "Praça de alimentação", desc: "Comida mexicana." },
  { id: "of-comida-fritz-e-fritas", name: "Restaurante Fritz e Fritas", tipo: "refeicao", refeicao: true, area: "Vila Germânica", areaTema: true, desc: "Batata recheada, batata frita, bretzel, cachorro-quente e chopp (tema alemão)." },
  { id: "of-comida-pastel-de-feira", name: "Pastel de Feira", tipo: "lanche", area: "Praça de alimentação", desc: "Pastéis de vários sabores e tamanhos." },
  { id: "of-comida-pop-corn-raskapuska", name: "Pop Corn (saída do Raskapuska)", tipo: "lanche", perto: { ref: "osm-raskapuska", dx: -14, dy: 14, texto: "saída do Raskapuska" }, desc: "Pipoca doce e salgada." },
  { id: "of-comida-pop-corn-piratas", name: "Pop Corn (entrada da Ilha dos Piratas)", tipo: "lanche", perto: { ref: "osm-ilha-dos-piratas", dx: -16, dy: 12, texto: "entrada da Ilha dos Piratas" }, desc: "Pipoca doce e salgada." },
  { id: "of-comida-damay", name: "Lanchonete Damay", tipo: "lanche", perto: { ref: "osm-castelo-das-nacoes", dx: 10, dy: 22, texto: "entrada do Castelo das Nações" }, desc: "Cafés, bolos, sanduíches e pão de queijo." },
  { id: "of-comida-trem-zaragoza", name: "Trem Zaragoza", tipo: "lanche", desc: "Algodão doce, crepe, churros, salsicha." },
  { id: "of-comida-sobremesas", name: "Sobremesas", tipo: "doce", perto: { ref: "osm-palacio-dos-sorvetes", dx: 0, dy: 14, texto: "PALPITE: o Palácio dos Sorvetes do mapa (o texto oficial não diz onde fica)" }, desc: "Sorvete e picolé." },
  { id: "of-comida-bibs", name: "Bib´s", tipo: "doce", perto: { ref: "osm-estacao-joao-alves-de-queiroz", dx: 14, dy: 14, texto: "na ferrovia DinoMagic" }, desc: "Chocolate em copos, 15 sabores." },
  { id: "of-comida-fini", name: "Fini", tipo: "doce", desc: "Balas nacionais e importadas (\"coração do parque\")." },
  { id: "of-comida-elixir", name: "Elixir Milagroso", tipo: "bebida", area: "Cowboyland", perto: null, textoLocal: "em frente ao Rebuliço", desc: "Chopp Pilsen, frozen e bebidas geladas." }
];
for (const c of COMIDA) { c.cat = "comida"; c.comida = true; }
