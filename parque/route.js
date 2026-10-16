/*
 * route.js — rota a pé pelos caminhos do parque.
 *
 * O grafo junta duas fontes:
 *   1. Caminhos do OpenStreetMap (PARK_DATA.graph) — poucos dentro do parque.
 *   2. Caminhos aprendidos (trilhas.js): trechos que visitantes realmente
 *      andaram, com GPS bom. Cada trecho vira uma sequência de nós; pontos a
 *      menos de JUNTAR_M de um nó existente reaproveitam esse nó, e é assim
 *      que trilhas de pessoas diferentes se cruzam e formam uma rede.
 *
 * Pontas soltas a até GAP_M de outro caminho ganham uma ligação "de atalho"
 * com custo um pouco maior (cruzamentos que nem o OSM nem as trilhas
 * registraram).
 *
 * Sem caminho bom no grafo, a rota vira linha reta e a navegação vira
 * "siga a seta" (como bússola): melhor uma direção certa do que uma volta
 * absurda por um caminho que o mapa não conhece.
 */
"use strict";

const ROUTE = (() => {
  const GAP_M = 14;
  const GAP_COST = 1.4;
  const JUNTAR_M = 6;
  const SALTO_MAX_M = 45;      // dois pontos de trilha mais longe que isso não viram aresta
  const SNAP_START_M = 35;
  const SNAP_END_M = 50;
  const MAX_DETOUR = 1.8;
  const CELL = 20;

  let nodes, adj, grid;

  const cellKey = (x, y) => Math.floor(x / CELL) + ":" + Math.floor(y / CELL);

  function addNode(p) {
    const i = nodes.length;
    nodes.push({ x: p.x, y: p.y });
    adj.push([]);
    const k = cellKey(p.x, p.y);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(i);
    return i;
  }

  function link(a, b, factor) {
    if (a === b || adj[a].some(e => e[0] === b)) return;
    const d = GEO.dist(nodes[a], nodes[b]) * factor;
    adj[a].push([b, d]);
    adj[b].push([a, d]);
  }

  function near(p, radius) {
    const out = [];
    const r = Math.ceil(radius / CELL);
    const cx = Math.floor(p.x / CELL), cy = Math.floor(p.y / CELL);
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        const list = grid.get((cx + dx) + ":" + (cy + dy));
        if (list) for (const i of list) if (GEO.dist(p, nodes[i]) <= radius) out.push(i);
      }
    }
    return out;
  }

  function closest(p, radius) {
    let best = -1, bestD = radius;
    for (const i of near(p, radius)) {
      const d = GEO.dist(p, nodes[i]);
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  // Monta o grafo do zero: OSM + trilhas (lista de listas de {x, y}).
  function build(trilhas) {
    nodes = [];
    adj = [];
    grid = new Map();
    for (const [x, y] of PARK_DATA.graph.nodes) addNode({ x, y });
    for (const [a, b] of PARK_DATA.graph.edges) link(a, b, 1);

    for (const pts of trilhas || []) {
      let prev = -1;
      for (const p of pts) {
        let i = closest(p, JUNTAR_M);
        if (i < 0) i = addNode(p);
        if (prev >= 0 && prev !== i && GEO.dist(nodes[prev], nodes[i]) <= SALTO_MAX_M) link(prev, i, 1);
        prev = i;
      }
    }

    // Ligações de atalho para pontas e cruzamentos não registrados.
    const total = nodes.length;
    for (let i = 0; i < total; i++) {
      if (adj[i].length > 2) continue;
      const linked = new Set(adj[i].map(e => e[0]));
      let best = -1, bestD = Infinity;
      for (const j of near(nodes[i], GAP_M)) {
        if (j === i || linked.has(j)) continue;
        const d = GEO.dist(nodes[i], nodes[j]);
        if (d < bestD) { bestD = d; best = j; }
      }
      if (best >= 0) link(i, best, GAP_COST);
    }
  }

  function nearestNode(p, maxDist) {
    let best = -1, bestD = maxDist || Infinity;
    for (const i of near(p, maxDist)) {
      if (!adj[i].length) continue;
      const d = GEO.dist(p, nodes[i]);
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  // Dijkstra com fila de prioridade simples (heap binário).
  function shortest(from, to) {
    const dist = new Float64Array(nodes.length).fill(Infinity);
    const prev = new Int32Array(nodes.length).fill(-1);
    const heap = [[0, from]];
    dist[from] = 0;
    const push = item => {
      heap.push(item);
      let i = heap.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (heap[p][0] <= heap[i][0]) break;
        [heap[p], heap[i]] = [heap[i], heap[p]];
        i = p;
      }
    };
    const pop = () => {
      const top = heap[0];
      const last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1, r = l + 1;
          let m = i;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === i) break;
          [heap[m], heap[i]] = [heap[i], heap[m]];
          i = m;
        }
      }
      return top;
    };
    while (heap.length) {
      const [d, u] = pop();
      if (d > dist[u]) continue;
      if (u === to) break;
      for (const [v, w] of adj[u]) {
        const nd = d + w;
        if (nd < dist[v]) { dist[v] = nd; prev[v] = u; push([nd, v]); }
      }
    }
    if (dist[to] === Infinity) return null;
    const path = [];
    for (let u = to; u !== -1; u = prev[u]) path.push(u);
    return path.reverse();
  }

  // Rota de um ponto qualquer até outro: entra no caminho mais próximo,
  // segue pelo grafo e sai no ponto mais perto do destino. Só usa o grafo
  // quando há caminho perto da saída e da chegada e o trajeto não fica muito
  // maior que a linha reta; fora disso, linha reta + seta.
  function plan(from, to) {
    const straight = GEO.dist(from, to);
    const direct = { points: [from, to], length: straight, straight: true };
    if (straight < 40) return direct;
    const a = nearestNode(from, SNAP_START_M);
    const b = nearestNode(to, SNAP_END_M);
    if (a < 0 || b < 0 || a === b) return direct;
    const path = shortest(a, b);
    if (!path) return direct;
    const points = [from, ...path.map(i => nodes[i]), to];
    let length = 0;
    for (let i = 1; i < points.length; i++) length += GEO.dist(points[i - 1], points[i]);
    if (length > straight * MAX_DETOUR) return direct;
    return { points, length, straight: false };
  }

  // Próximo ponto da rota a mais de 12 m: é para onde a seta aponta.
  function nextTarget(route, me) {
    let bestI = 0, bestD = Infinity;
    route.points.forEach((p, i) => {
      const d = GEO.dist(me, p);
      if (d < bestD) { bestD = d; bestI = i; }
    });
    for (let i = bestI; i < route.points.length; i++) {
      if (GEO.dist(me, route.points[i]) > 12) return route.points[i];
    }
    return route.points[route.points.length - 1];
  }

  build([]);

  return { plan, nextTarget, setTrilhas: build, get tamanho() { return nodes.length; } };
})();
