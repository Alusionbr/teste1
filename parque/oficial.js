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

  // ---- shows (horários oficiais)
  { id: "of-papo-galinheiro", name: "Papo de Galinheiro", cat: "show", area: "Galinha Pintadinha", horarios: ["11:00"] },
  { id: "of-excalibur", name: "Excalibur", cat: "show", area: "Vila Germânica", horarios: ["12:00"], pago: true, osm: ["osm-excalibur"], grande: true },
  { id: "of-dodoi", name: "O Dodói da Galinha Pintadinha", cat: "show", area: "Galinha Pintadinha", horarios: ["12:30"] },
  { id: "of-hw-epic-show", name: "Hot Wheels Epic Show", cat: "show", area: "Hot Wheels", horarios: ["13:30"], grande: true, nota: "Arena para 3 mil pessoas: o show mais disputado do parque." },
  { id: "of-circus", name: "Madagascar Circus Show", cat: "show", area: "Madagascar", horarios: ["15:00"], osm: ["osm-madagascar-circus-show"], grande: true },
  { id: "of-sonho-cowboy", name: "O Sonho do Cowboy", cat: "show", area: "Cowboyland", horarios: ["18:00"], osm: ["osm-o-sonho-do-cowboy"] },
  { id: "of-trolls", name: "No Ritmo de Trolls", cat: "show", area: "Praça de Eventos", horarios: ["19:00"], osm: ["osm-praca-de-eventos"] },

  // ---- para ver e fotografar
  { id: "of-castelo", name: "Castelo das Nações", cat: "atracao", osm: ["osm-castelo-das-nacoes"] },
  { id: "of-memorial", name: "Memorial Beto Carrero", cat: "atracao", osm: ["osm-beto-carrero-memory"] },
  { id: "of-estacao", name: "Estação João Alves de Queiroz", cat: "atracao", osm: ["osm-estacao-joao-alves-de-queiroz"] },
  { id: "of-ponte-pensil", name: "Ponte Pênsil", cat: "atracao", area: "Ilha dos Piratas" },
  { id: "of-chapeu-bota", name: "Chapéu e Bota Gigante", cat: "foto", area: "Cowboyland" },
  { id: "of-romero-britto", name: "Esculturas Romero Britto", cat: "foto" },
  { id: "of-foto-galinha", name: "Fotos com a Turma da Galinha Pintadinha", cat: "foto", area: "Galinha Pintadinha" },
  { id: "of-foto-trolls", name: "Fotos com Trolls", cat: "foto" },
  { id: "of-foto-betinho", name: "Fotos com Betinho e Lully", cat: "foto", area: "Cowboyland" },
  { id: "of-foto-shrek", name: "Fotos com Shrek e sua turma", cat: "foto" },
  { id: "of-foto-madagascar", name: "Fotos com a Turma do Madagascar", cat: "foto", area: "Madagascar" },
  { id: "of-foto-po", name: "Fotos com Po do Kung Fu Panda", cat: "foto" },
  { id: "of-foto-megamente", name: "Fotos com Megamente e Metro Man", cat: "foto" },
  { id: "of-foto-bob", name: "Fotos com Bob Esponja e sua turma", cat: "foto" }
];

// Lugares do OpenStreetMap que NÃO estão na lista oficial atual.
// Ficam no mapa (o prédio existe), mas avisam que podem estar fechados.
const OSM_FORA_DA_LISTA = {
  "osm-star-mountain": "Desativada em setembro de 2026.",
  "osm-velozes-e-furiosos": "Não está na lista oficial atual: provavelmente fechado.",
  "osm-cine-a-era-do-gelo": "Não está na lista oficial atual: pode estar fechado.",
  "osm-cine-renato-aragao": "Não está na lista oficial atual: pode estar fechado.",
  "osm-shrek-o-fantasma-de-lord-farquaad": "Não está na lista oficial atual: pode estar fechado.",
  "osm-palacio-das-serpentes": "Não está na lista oficial atual: pode estar fechado.",
  "osm-zoologico": "Não está na lista oficial atual: pode estar fechado.",
  "osm-mundo-dos-cavalos": "Não está na lista oficial atual: pode estar fechado.",
  "osm-cavalaria": "Não está na lista oficial atual: pode estar fechado.",
  "osm-labirinto-dos-unicornios": "Não está na lista oficial atual: pode estar fechado.",
  "osm-trenzinho-vila-esperanca": "Não está na lista oficial atual: pode estar fechado.",
  "osm-acqua-boat": "Não está na lista oficial atual: pode estar fechado.",
  "osm-pedalinho": "Não está na lista oficial atual: pode estar fechado.",
  "osm-kid-play": "Não está na lista oficial atual: pode estar fechado."
};
