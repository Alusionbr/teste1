/*
 * route.js — rota a pé pelos caminhos do parque.
 *
 * O grafo vem do OpenStreetMap (PARK_DATA.graph): cada nó é um ponto de
 * caminho e cada aresta um trecho de via. No OSM nem todo cruzamento está
 * ligado, então pontas soltas a até GAP_M metros de outro caminho ganham
 * uma ligação "de atalho" com custo um pouco maior.
 *
 * Sem caminho bom no grafo, a rota vira linha reta e a navegação vira
 * "siga a seta" (como bússola): melhor uma direção certa do que uma volta
 * absurda por um caminho que o mapa não conhece.
 */
"use strict";

const ROUTE = (() => {
  const GAP_M = 14;
  const GAP_COST = 1.4;
  const nodes = PARK_DATA.graph.nodes.map(([x, y]) => ({ x, y }));
  const adj = nodes.map(() => []);

  function link(a, b, factor) {
    if (a === b) return;
    const d = GEO.dist(nodes[a], nodes[b]) * factor;
    adj[a].push([b, d]);
    adj[b].push([a, d]);
  }

  for (const [a, b] of PARK_DATA.graph.edges) link(a, b, 1);

  // Grade espacial para achar vizinhos próximos sem comparar todos com todos.
  const CELL = 20;
  const grid = new Map();
  const cellKey = (x, y) => Math.floor(x / CELL) + ":" + Math.floor(y / CELL);
  nodes.forEach((n, i) => {
    const k = cellKey(n.x, n.y);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(i);
  });

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

  // Ligações de atalho: nós com poucas conexões (pontas e cruzamentos não
  // marcados) ligam ao vizinho mais perto que não esteja já ligado.
  nodes.forEach((n, i) => {
    if (adj[i].length > 2) return;
    const linked = new Set(adj[i].map(e => e[0]));
    let best = -1, bestD = Infinity;
    for (const j of near(n, GAP_M)) {
      if (j === i || linked.has(j)) continue;
      const d = GEO.dist(n, nodes[j]);
      if (d < bestD) { bestD = d; best = j; }
    }
    if (best >= 0) link(i, best, GAP_COST);
  });

  function nearestNode(p, maxDist) {
    let best = -1, bestD = maxDist || Infinity;
    for (let i = 0; i < nodes.length; i++) {
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
  // segue pelo grafo e sai no ponto mais perto do destino.
  //
  // O OSM tem poucos caminhos desenhados dentro do parque. Por isso o grafo
  // só é usado quando há caminho perto da saída e da chegada e o trajeto
  // não fica muito maior que a linha reta; fora disso, linha reta + seta.
  const SNAP_START_M = 35;
  const SNAP_END_M = 50;
  const MAX_DETOUR = 1.8;

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

  return { plan, nextTarget };
})();
