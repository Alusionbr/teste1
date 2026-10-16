/*
 * make-park-data.js — converte um recorte do OpenStreetMap (XML da API 0.6)
 * no arquivo de dados do Mapa do Parque. Só usa a biblioteca padrão do Node.
 *
 * Uso:
 *   curl -o /tmp/parque.osm "https://api.openstreetmap.org/api/0.6/map?bbox=-48.6275,-26.8125,-48.6075,-26.7960"
 *   node tools/make-park-data.js /tmp/parque.osm
 *
 * Saída: parque/park-data.js (variável global PARK_DATA)
 *
 * Coordenadas saem em metros, num plano local: x para leste, y para o sul,
 * origem no centro do parque. O app converte GPS para esse mesmo plano
 * (parque/geo.js), então desenho e posição batem sem biblioteca de mapa.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const PARK_WAY_ID = '25101921';           // contorno do Beto Carrero World no OSM
const OUT = path.join(__dirname, '..', 'parque', 'park-data.js');

// Categoria escolhida pelo nome quando a etiqueta do OSM não diz o que é.
const NAME_CATEGORY = {
  'Pedalinho': 'aquatico',
  'Kid Play': 'infantil',
  'Xícaras Malucas': 'infantil',
  'Triplikland': 'infantil',
  'Cavalaria': 'animais',
  'Velozes e Furiosos': 'show',
  'Castelo das Nações': 'atracao',
  'Vila Germânica': 'atracao',
  'Ilha dos Piratas': 'atracao',
  'Caverna dos Piratas': 'atracao',
  'Mirante do Leão': 'mirante',
  'Praça de Eventos': 'atracao',
  'Estação João Alves de Queiroz': 'atracao'
};

// Nomes no OSM que não interessam dentro do parque.
const SKIP_NAMES = new Set(['MJ Mecânica Geral - Ar Condicionado', 'BCW', 'Beto Carrero World']);

function readOsm(file) {
  const xml = fs.readFileSync(file, 'utf8');
  const nodes = new Map();
  const ways = [];
  const tagRe = /<tag k="([^"]*)" v="([^"]*)"\s*\/>/g;
  const unescape = s => s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const tagsOf = body => {
    const tags = {};
    let m;
    tagRe.lastIndex = 0;
    while ((m = tagRe.exec(body))) tags[unescape(m[1])] = unescape(m[2]);
    return tags;
  };
  const nodeRe = /<node id="(\d+)"[^>]*?lat="([-\d.]+)" lon="([-\d.]+)"[^>]*?(\/>|>([\s\S]*?)<\/node>)/g;
  let m;
  while ((m = nodeRe.exec(xml))) {
    nodes.set(m[1], { id: m[1], lat: +m[2], lon: +m[3], tags: m[5] ? tagsOf(m[5]) : {} });
  }
  const wayRe = /<way id="(\d+)"[^>]*>([\s\S]*?)<\/way>/g;
  while ((m = wayRe.exec(xml))) {
    const refs = [...m[2].matchAll(/<nd ref="(\d+)"\/>/g)].map(r => r[1]);
    ways.push({ id: m[1], refs, tags: tagsOf(m[2]) });
  }
  return { nodes, ways };
}

function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Uso: node tools/make-park-data.js arquivo.osm');
    process.exit(1);
  }
  const { nodes, ways } = readOsm(file);
  const park = ways.find(w => w.id === PARK_WAY_ID);
  if (!park) throw new Error('Contorno do parque não encontrado no recorte.');

  const parkPts = park.refs.map(r => nodes.get(r)).filter(Boolean);
  const lat0 = parkPts.reduce((s, p) => s + p.lat, 0) / parkPts.length;
  const lon0 = parkPts.reduce((s, p) => s + p.lon, 0) / parkPts.length;
  const mLat = 111320;
  const mLon = 111320 * Math.cos(lat0 * Math.PI / 180);
  const toXY = n => [Math.round((n.lon - lon0) * mLon * 10) / 10, Math.round((lat0 - n.lat) * mLat * 10) / 10];

  const parkXY = parkPts.map(toXY);
  const xs = parkXY.map(p => p[0]), ys = parkXY.map(p => p[1]);
  const PAD = 220;
  const box = { minX: Math.min(...xs) - PAD, maxX: Math.max(...xs) + PAD, minY: Math.min(...ys) - PAD, maxY: Math.max(...ys) + PAD };
  const inBox = p => p[0] >= box.minX && p[0] <= box.maxX && p[1] >= box.minY && p[1] <= box.maxY;

  const out = { water: [], green: [], wood: [], buildings: [], paths: [], roads: [], rails: [], coasters: [], rapids: [] };
  // Grafo de caminhada: nós compartilhados entre vias viram cruzamentos.
  const graphNodes = new Map();     // id OSM -> índice
  const graphXY = [];
  const graphEdges = [];
  const nodeIndex = n => {
    if (!graphNodes.has(n.id)) { graphNodes.set(n.id, graphXY.length); graphXY.push(toXY(n)); }
    return graphNodes.get(n.id);
  };

  const WALK = new Set(['footway', 'path', 'pedestrian', 'steps', 'service', 'corridor', 'living_street', 'track']);
  const poiByName = new Map();

  for (const w of ways) {
    const pts = w.refs.map(r => nodes.get(r)).filter(Boolean);
    if (pts.length < 2) continue;
    const xy = pts.map(toXY);
    if (!xy.some(inBox)) continue;
    const t = w.tags;
    const closed = w.refs[0] === w.refs[w.refs.length - 1];

    if (t.attraction === 'roller_coaster') out.coasters.push(xy);
    else if (t.attraction === 'river_rafting' && !closed) out.rapids.push(xy);
    else if (t.railway) out.rails.push(xy);
    else if (t.highway && WALK.has(t.highway)) {
      out.paths.push(xy);
      for (let i = 1; i < pts.length; i++) {
        const a = nodeIndex(pts[i - 1]), b = nodeIndex(pts[i]);
        graphEdges.push([a, b]);
      }
    } else if (t.highway) out.roads.push(xy);
    else if (closed && (t.natural === 'water' || t.leisure === 'swimming_pool' || t.water)) out.water.push(xy);
    else if (closed && (t.natural === 'wood' || t.natural === 'heath' || t.natural === 'wetland')) out.wood.push(xy);
    else if (closed && (t.landuse === 'grass' || t.leisure === 'park' || t.leisure === 'pitch' || t.tourism === 'zoo')) out.green.push(xy);
    else if (closed && (t.building || t.amenity || t.tourism)) out.buildings.push(xy);

    // Caminho de pedestres em área (praça) também entra no grafo pelo contorno.
    if (t.highway === 'pedestrian' && closed) {
      // já tratado acima: os segmentos do contorno ligam as entradas da praça
    }

    if (t.name && !SKIP_NAMES.has(t.name) && !(t.highway && !t.area) && !t.boundary) {
      addPoi(poiByName, t, xy);
    }
    if (!t.name && t.amenity === 'toilets') addPoi(poiByName, Object.assign({ name: 'Banheiro' }, t), xy, true);
    if (!t.name && t.amenity === 'parking') addPoi(poiByName, Object.assign({ name: 'Estacionamento' }, t), xy, true);
  }

  for (const n of nodes.values()) {
    const t = n.tags;
    const xy = [toXY(n)];
    if (!inBox(xy[0])) continue;
    if (t.name && !SKIP_NAMES.has(t.name) && !t.highway) addPoi(poiByName, t, xy);
    else if (!t.name && t.amenity === 'toilets') addPoi(poiByName, Object.assign({ name: 'Banheiro' }, t), xy, true);
    else if (!t.name && t.amenity === 'parking') addPoi(poiByName, Object.assign({ name: 'Estacionamento' }, t), xy, true);
  }

  const pois = [];
  for (const p of poiByName.values()) {
    if (!p.cat) continue;
    const xs2 = p.pts.map(q => q[0]), ys2 = p.pts.map(q => q[1]);
    const x = Math.round((Math.min(...xs2) + Math.max(...xs2)) / 2);
    const y = Math.round((Math.min(...ys2) + Math.max(...ys2)) / 2);
    if (!inBox([x, y])) continue;
    pois.push({ id: p.id, name: p.name, cat: p.cat, x, y, info: p.info });
  }
  pois.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  const data = {
    source: 'OpenStreetMap (ODbL) — © colaboradores do OpenStreetMap',
    generated: new Date().toISOString().slice(0, 10),
    origin: { lat: +lat0.toFixed(7), lon: +lon0.toFixed(7) },
    box,
    outline: parkXY,
    layers: out,
    graph: { nodes: graphXY, edges: graphEdges },
    pois
  };

  const header = '/* Gerado por tools/make-park-data.js a partir do OpenStreetMap (ODbL). Não editar à mão. */\n"use strict";\n';
  fs.writeFileSync(OUT, header + 'const PARK_DATA = ' + JSON.stringify(data) + ';\n');
  console.log(`ok: ${pois.length} lugares, ${out.paths.length} caminhos, ${graphXY.length} nós de rota -> ${path.relative(process.cwd(), OUT)}`);
}

function categoryOf(t) {
  if (NAME_CATEGORY[t.name]) return NAME_CATEGORY[t.name];
  if (t.attraction === 'roller_coaster') return 'montanha';
  if (t.attraction === 'drop_tower' || t.attraction === 'pirate_ship' || t.attraction === 'big_wheel' || t.attraction === 'dark_ride' || t.attraction === 'bumper_car' || t.attraction === 'maze') return 'atracao';
  if (t.attraction === 'river_rafting' || t.attraction === 'summer_toboggan' || t.leisure === 'swimming_pool') return 'aquatico';
  if (t.attraction === 'kiddie_ride' || t.attraction === 'carousel') return 'infantil';
  if (t.attraction === 'train' || t.railway === 'miniature') return 'atracao';
  if (t.amenity === 'theatre' || t.amenity === 'cinema') return 'show';
  if (t.tourism === 'zoo' || t.attraction === 'animal' || t.building === 'stable') return 'animais';
  if (t.amenity === 'restaurant' || t.amenity === 'pub' || t.amenity === 'ice_cream' || t.amenity === 'food_court' || t.amenity === 'cafe' || t.amenity === 'fast_food') return 'comida';
  if (t.amenity === 'toilets') return 'banheiro';
  if (t.amenity === 'parking') return 'estacionamento';
  if (t.tourism === 'viewpoint') return 'mirante';
  if (t.tourism === 'museum') return 'atracao';
  if (t.shop === 'ticket' || t.amenity === 'pharmacy') return 'servico';
  if (t.tourism === 'attraction') return 'atracao';
  return null;
}

function addPoi(map, t, xy, numbered) {
  const cat = categoryOf(t);
  if (!cat) return;
  let key = t.name;
  if (numbered) key = t.name + '#' + map.size;
  const info = [];
  if (t.height) info.push(`Altura: ${t.height} m`);
  if (t.opening_hours) info.push(`Horário (OSM): ${t.opening_hours}`);
  if (t.cuisine === 'steak_house') info.push('Churrascaria');
  const prev = map.get(key);
  if (prev) {
    prev.pts.push(...xy);
    for (const i of info) if (!prev.info.includes(i)) prev.info.push(i);
    if (cat !== 'atracao' && prev.cat === 'atracao') prev.cat = cat;
    return;
  }
  const id = 'osm-' + key.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  map.set(key, { id, name: t.name, cat, pts: xy.slice(), info });
}

main();
