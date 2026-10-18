/*
 * route.js — rota a pé dentro do parque.
 *
 * Por que grade e não só a rede de ruas: o OpenStreetMap tem poucos caminhos
 * dentro do parque (veja park-data.js). Uma rota que só andasse pelas ruas
 * desenhadas ficava sem saída ou virava linha reta atravessando prédios.
 *
 * Como funciona: o parque vira uma grade de CELL metros. Cada célula tem um
 * custo de andar nela:
 *
 *   0          bloqueada (prédio ou água) — o roteador contorna
 *   0.50       caminho aprendido por visitantes (trilhas.js)
 *   0.55       caminho de pedestre do OpenStreetMap
 *   0.70       via de serviço
 *   0.90       rua local, corredor de estacionamento
 *   1.00       chão aberto dentro do parque (praças, gramados)
 *   1.50       fora do parque
 *   2.50       rodovia / via principal (evitar)
 *
 * A* acha o caminho de menor custo; assim a rota gruda nos caminhos conhecidos
 * quando compensa e atravessa praça aberta quando é o jeito. Origem e destino
 * ficam livres num raio de LIVRE_M (o destino costuma ser um prédio de
 * atração; a origem pode estar dentro dele por erro de GPS).
 *
 * Resultado:
 *   kind "caminho"  ≥ 60% do trajeto sobre caminho conhecido
 *   kind "estimada" trajeto calculado pela grade, desviando de prédios e lagos
 *   kind "reta"     sem solução razoável: linha reta, a seta vira bússola
 */
"use strict";

const ROUTE = (() => {
  const CELL = 3;
  const LIVRE_M = 15;
  const JANELA_M = 160;           // A* primeiro numa janela em volta da origem e do destino
  const PESO_H = 0.8;             // heurística um pouco "gulosa": rápida e boa o bastante
  const MAX_DESVIO = 3;           // trajeto > 3× a reta = provável erro do mapa
  const CONHECIDO_MAX = 0.75;     // custo ≤ isso conta como caminho conhecido
  const MIN_CONFIRMADO = 0.6;

  const COST = { fora: 1.5, dentro: 1.0, aprendido: 0.5, pedestre: 0.55, servico: 0.7, rua: 0.9, principal: 2.5 };

  const B = PARK_DATA.box;
  const W = Math.ceil((B.maxX - B.minX) / CELL);
  const H = Math.ceil((B.maxY - B.minY) / CELL);
  const N = W * H;

  let base = null;                // custo estático
  let cost = null;                // base + trilhas aprendidas

  const col = x => Math.floor((x - B.minX) / CELL);
  const row = y => Math.floor((y - B.minY) / CELL);
  const idx = (c, r) => r * W + c;
  const inGrid = (c, r) => c >= 0 && r >= 0 && c < W && r < H;
  const cx = c => B.minX + (c + 0.5) * CELL;
  const cy = r => B.minY + (r + 0.5) * CELL;

  // Preenche o interior de um polígono (varredura por linhas).
  function fillPoly(poly, fn) {
    let minR = Infinity, maxR = -Infinity;
    for (const p of poly) { const r = row(p[1]); if (r < minR) minR = r; if (r > maxR) maxR = r; }
    minR = Math.max(0, minR);
    maxR = Math.min(H - 1, maxR);
    for (let r = minR; r <= maxR; r++) {
      const y = cy(r);
      const xs = [];
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i], [xj, yj] = poly[j];
        if ((yi > y) !== (yj > y)) xs.push(xi + (y - yi) * (xj - xi) / (yj - yi));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const c0 = Math.max(0, Math.ceil((xs[k] - B.minX) / CELL - 0.5));
        const c1 = Math.min(W - 1, Math.floor((xs[k + 1] - B.minX) / CELL - 0.5));
        for (let c = c0; c <= c1; c++) fn(idx(c, r));
      }
    }
  }

  // Percorre uma linha de 1,5 em 1,5 m e chama fn para cada célula tocada.
  function stepLine(pts, fn) {
    for (let i = 1; i < pts.length; i++) {
      const ax = pts[i - 1][0], ay = pts[i - 1][1], bx = pts[i][0], by = pts[i][1];
      const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 1.5));
      for (let s = 0; s <= steps; s++) {
        const c = col(ax + (bx - ax) * s / steps), r = row(ay + (by - ay) * s / steps);
        if (inGrid(c, r)) fn(idx(c, r));
      }
    }
  }

  const asArr = p => (Array.isArray(p) ? p : [p.x, p.y]);

  // modo: "min" (só baixa o custo), "max" (só sobe), override libera célula bloqueada.
  // Devolve quantas células mudaram de custo.
  function paint(arr, lines, c, modo, override) {
    let mudou = 0;
    for (const line of lines) {
      stepLine(line.map(asArr), i => {
        const cur = arr[i];
        if (cur === 0) { if (override) { arr[i] = c; mudou++; } return; }
        const novo = modo === "max" ? Math.max(cur, c) : Math.min(cur, c);
        if (novo !== cur) { arr[i] = novo; mudou++; }
      });
    }
    return mudou;
  }

  function buildBase() {
    const L = PARK_DATA.layers;
    const arr = new Float32Array(N).fill(COST.fora);
    fillPoly(PARK_DATA.outline, i => { arr[i] = COST.dentro; });
    for (const poly of L.blocks) fillPoly(poly, i => { arr[i] = 0; });
    paint(arr, L.roadsMain, COST.principal, "max", false);
    paint(arr, L.roads, COST.rua, "min", false);
    paint(arr, L.aisles, COST.rua, "min", false);
    paint(arr, L.services, COST.servico, "min", false);
    paint(arr, L.paths, COST.pedestre, "min", true);   // passarela/ponte pode cruzar prédio ou água
    base = arr;
    cost = arr.slice();
  }

  // Trilhas aprendidas: lista de listas de {x, y}.
  let aprendidoCelulas = 0;
  function setTrilhas(trilhas) {
    cost = base.slice();
    aprendidoCelulas = paint(cost, trilhas || [], COST.aprendido, "min", true);
  }

  // ---- A* -----------------------------------------------------------------

  const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];

  function astar(s, g, janela) {
    const [c0, r0] = [Math.max(0, janela.c0), Math.max(0, janela.r0)];
    const [c1, r1] = [Math.min(W - 1, janela.c1), Math.min(H - 1, janela.r1)];
    const gs = new Float32Array(N).fill(Infinity);
    const par = new Int32Array(N).fill(-1);
    const gc = g % W, gr = (g / W) | 0;
    const hk = [], hv = [];
    const push = (k, v) => {
      hk.push(k); hv.push(v);
      let i = hk.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (hk[p] <= hk[i]) break;
        [hk[p], hk[i]] = [hk[i], hk[p]]; [hv[p], hv[i]] = [hv[i], hv[p]];
        i = p;
      }
    };
    const pop = () => {
      const v = hv[0];
      const lk = hk.pop(), lv = hv.pop();
      if (hk.length) {
        hk[0] = lk; hv[0] = lv;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1, r = l + 1;
          let m = i;
          if (l < hk.length && hk[l] < hk[m]) m = l;
          if (r < hk.length && hk[r] < hk[m]) m = r;
          if (m === i) break;
          [hk[m], hk[i]] = [hk[i], hk[m]]; [hv[m], hv[i]] = [hv[i], hv[m]];
          i = m;
        }
      }
      return v;
    };
    const h = (c, r) => Math.hypot(c - gc, r - gr) * CELL * PESO_H;
    gs[s] = 0;
    push(h(s % W, (s / W) | 0), s);
    while (hk.length) {
      const u = pop();
      if (u === g) {
        const out = [];
        for (let v = g; v !== -1; v = par[v]) out.push(v);
        return out.reverse();
      }
      const uc = u % W, ur = (u / W) | 0;
      for (const [dc, dr, w] of DIRS) {
        const vc = uc + dc, vr = ur + dr;
        if (vc < c0 || vc > c1 || vr < r0 || vr > r1) continue;
        const v = idx(vc, vr);
        const cv = cost[v];
        if (cv === 0) continue;
        if (dc && dr && (cost[idx(uc + dc, ur)] === 0 || cost[idx(uc, ur + dr)] === 0)) continue;   // não corta quina de prédio
        const ng = gs[u] + w * CELL * (cost[u] + cv) / 2;
        if (ng < gs[v]) { gs[v] = ng; par[v] = u; push(ng + h(vc, vr), v); }
      }
    }
    return null;
  }

  // Libera o ponto de origem/destino para o roteador poder entrar e sair.
  // 1) abre um raio de LIVRE_M em volta (guarda os valores para restaurar);
  // 2) se o ponto está dentro de um prédio maior que isso (teatro, cinema), abre um
  //    corredor reto até o chão livre mais próximo, senão a rota nunca sairia de lá.
  function liberar(p, undo) {
    const c = col(p.x), r = row(p.y), rad = Math.ceil(LIVRE_M / CELL);
    const aberto = new Set();
    const abrir = i => { if (cost[i] === 0) { undo.push([i, 0]); cost[i] = COST.dentro; } aberto.add(i); };
    for (let dc = -rad; dc <= rad; dc++) {
      for (let dr = -rad; dr <= rad; dr++) {
        if (dc * dc + dr * dr <= rad * rad && inGrid(c + dc, r + dr)) abrir(idx(c + dc, r + dr));
      }
    }
    let melhor = null, melhorD = Infinity;
    for (let k = rad + 1; k <= rad + 25 && !melhor; k++) {
      for (let dc = -k; dc <= k; dc++) {
        for (let dr = -k; dr <= k; dr++) {
          if (Math.max(Math.abs(dc), Math.abs(dr)) !== k || !inGrid(c + dc, r + dr)) continue;
          const i = idx(c + dc, r + dr);
          const d = dc * dc + dr * dr;
          if (cost[i] > 0 && !aberto.has(i) && d < melhorD) { melhorD = d; melhor = [c + dc, r + dr]; }
        }
      }
    }
    if (melhor) {
      // Corredor de ~3 células de largura: com 1 célula na diagonal a regra de "não cortar quina" travava a saída.
      stepLine([[p.x, p.y], [cx(melhor[0]), cy(melhor[1])]], i => {
        const ci = i % W, ri = (i / W) | 0;
        for (const [dc, dr] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (inGrid(ci + dc, ri + dr)) abrir(idx(ci + dc, ri + dr));
        }
      });
    }
  }

  // Douglas-Peucker: tira pontos que quase não mudam a direção.
  function simplificar(pts, tol) {
    if (pts.length < 3) return pts;
    const keep = new Uint8Array(pts.length);
    keep[0] = keep[pts.length - 1] = 1;
    const pilha = [[0, pts.length - 1]];
    while (pilha.length) {
      const [a, b] = pilha.pop();
      let max = 0, im = -1;
      for (let i = a + 1; i < b; i++) {
        const d = distSeg(pts[i], pts[a], pts[b]);
        if (d > max) { max = d; im = i; }
      }
      if (im >= 0 && max > tol) { keep[im] = 1; pilha.push([a, im], [im, b]); }
    }
    return pts.filter((_, i) => keep[i]);
  }

  function distSeg(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
  }

  function comprimento(pts) {
    let l = 0;
    for (let i = 1; i < pts.length; i++) l += GEO.dist(pts[i - 1], pts[i]);
    return l;
  }

  function plan(from, to) {
    const reta = GEO.dist(from, to);
    const direto = { points: [from, to], length: reta, straight: true, kind: "reta", confirmed: 0 };
    if (reta < 25) return direto;
    const sc = col(from.x), sr = row(from.y), gc = col(to.x), gr = row(to.y);
    if (!inGrid(sc, sr) || !inGrid(gc, gr)) return direto;

    const undo = [];
    liberar(from, undo);
    liberar(to, undo);
    const s = idx(sc, sr), g = idx(gc, gr);
    const pad = Math.ceil(JANELA_M / CELL);
    const janela = { c0: Math.min(sc, gc) - pad, c1: Math.max(sc, gc) + pad, r0: Math.min(sr, gr) - pad, r1: Math.max(sr, gr) + pad };
    let cells = astar(s, g, janela);
    if (!cells) cells = astar(s, g, { c0: 0, r0: 0, c1: W - 1, r1: H - 1 });

    // Qual fatia do trajeto está em caminho conhecido (medido antes de restaurar os bloqueios).
    let conhecido = 0, total = 0;
    if (cells) {
      for (let i = 1; i < cells.length; i++) {
        const d = Math.hypot((cells[i] % W) - (cells[i - 1] % W), ((cells[i] / W) | 0) - ((cells[i - 1] / W) | 0)) * CELL;
        total += d;
        const c = cost[cells[i]];
        if (c > 0 && c <= CONHECIDO_MAX) conhecido += d;
      }
    }
    for (const [i, v] of undo) cost[i] = v;
    if (!cells) return direto;

    let pts = cells.map(i => ({ x: cx(i % W), y: cy((i / W) | 0) }));
    pts[0] = { x: from.x, y: from.y };
    pts[pts.length - 1] = { x: to.x, y: to.y };
    pts = simplificar(pts, 3.5);
    const length = comprimento(pts);
    if (length > reta * MAX_DESVIO) return direto;
    const confirmed = total ? conhecido / total : 0;
    return { points: pts, length, straight: false, kind: confirmed >= MIN_CONFIRMADO ? "caminho" : "estimada", confirmed };
  }

  // Posição do usuário projetada na rota: índice do trecho e distância até o fim.
  function progresso(route, me) {
    const pts = route.points;
    let best = { seg: 0, d: Infinity, t: 0 };
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
      const t = l2 ? Math.max(0, Math.min(1, ((me.x - a.x) * dx + (me.y - a.y) * dy) / l2)) : 0;
      const d = Math.hypot(me.x - (a.x + t * dx), me.y - (a.y + t * dy));
      if (d < best.d) best = { seg: i, d, t };
    }
    const a = pts[best.seg - 1], b = pts[best.seg];
    let resta = (1 - best.t) * GEO.dist(a, b);
    for (let i = best.seg + 1; i < pts.length; i++) resta += GEO.dist(pts[i - 1], pts[i]);
    return { seg: best.seg, foraDaRota: best.d, resta };
  }

  // Próximo ponto da rota a mais de 12 m: é para onde a seta aponta.
  function nextTarget(route, me) {
    const { seg } = progresso(route, me);
    for (let i = seg; i < route.points.length; i++) {
      if (GEO.dist(me, route.points[i]) > 12) return route.points[i];
    }
    return route.points[route.points.length - 1];
  }

  // Próxima curva: { dist (m até ela), dir "direita"|"esquerda", angulo } ou null.
  function nextTurn(route, me) {
    if (route.straight || route.points.length < 3) return null;
    const pts = route.points;
    const { seg } = progresso(route, me);
    let acc = GEO.dist(me, pts[seg]);
    for (let i = seg; i < pts.length - 1; i++) {
      const a = GEO.bearing(pts[i - 1], pts[i]), b = GEO.bearing(pts[i], pts[i + 1]);
      const ang = ((b - a + 540) % 360) - 180;
      if (Math.abs(ang) >= 30) return { dist: acc, dir: ang > 0 ? "direita" : "esquerda", angulo: Math.abs(ang) };
      acc += GEO.dist(pts[i], pts[i + 1]);
    }
    return null;
  }

  buildBase();

  return {
    plan, nextTarget, nextTurn, progresso, setTrilhas,
    // Para diagnóstico e testes.
    custoEm(x, y) { const c = col(x), r = row(y); return inGrid(c, r) ? cost[idx(c, r)] : null; },
    get celulas() { return N; },
    // Metros de caminho que só existem porque visitantes andaram ali (sem contar o que o OSM já tinha).
    get aprendidoM() { return aprendidoCelulas * CELL; }
  };
})();
