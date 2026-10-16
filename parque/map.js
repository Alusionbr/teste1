/*
 * map.js — desenho do mapa em SVG e gestos (arrastar, pinça, girar, toque longo).
 *
 * O mapa inteiro mora num <g id="world"> com coordenadas em metros.
 * A câmera é {cx, cy, s, rot}: ponto do mundo no centro da tela, pixels por
 * metro e rotação em graus (0 = norte para cima).
 *
 *   tela = centroDaTela + girar(-rot) · s · (mundo − (cx, cy))
 *
 * Marcadores e rótulos ficam do mesmo tamanho na tela: cada um recebe
 * scale(1/s) e rotate(rot) para desfazer o zoom e o giro do mundo.
 */
"use strict";

const MAP = (() => {
  const NS = "http://www.w3.org/2000/svg";
  const MIN_S = 0.12, MAX_S = 14;
  const LABEL_MIN_S = 0.9;

  let svg, world, layerMarks, layerMembers, layerMe, layerRoute;
  const view = { cx: 0, cy: 0, s: 1, rot: 0 };
  let W = 0, H = 0;
  let me = null;
  let members = [];
  let route = null;
  let selectedId = null;
  let markerEls = [];
  let frame = 0;
  const handlers = { tap: () => {}, longPress: () => {}, userMove: () => {}, tapMember: () => {} };

  function el(name, attrs, parent) {
    const node = document.createElementNS(NS, name);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(node);
    return node;
  }

  function pathD(points, closed) {
    let d = "";
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const x = Array.isArray(p) ? p[0] : p.x, y = Array.isArray(p) ? p[1] : p.y;
      d += (i ? "L" : "M") + x + " " + y;
    }
    return closed ? d + "Z" : d;
  }

  // Uma camada = muitos polígonos ou linhas num único <path>, para desenhar rápido.
  function layer(list, cls, closed) {
    if (!list.length) return;
    el("path", { d: list.map(pts => pathD(pts, closed)).join(""), class: cls }, world);
  }

  function drawStatic() {
    const L = PARK_DATA.layers;
    const b = PARK_DATA.box;
    el("rect", { x: b.minX - 2000, y: b.minY - 2000, width: b.maxX - b.minX + 4000, height: b.maxY - b.minY + 4000, class: "m-land" }, world);
    el("path", { d: pathD(PARK_DATA.outline, true), class: "m-park" }, world);
    layer(L.green, "m-green", true);
    layer(L.wood, "m-wood", true);
    layer(L.water, "m-water", true);
    layer(L.roads, "m-road", false);
    layer(L.paths, "m-path-case", false);
    layer(L.paths, "m-path", false);
    layer(L.buildings, "m-building", true);
    layer(L.rapids, "m-rapids", false);
    layer(L.rails, "m-rail", false);
    layer(L.coasters, "m-coaster", false);
    el("path", { d: pathD(PARK_DATA.outline, true), class: "m-park-edge" }, world);
    layerRoute = el("g", { class: "m-route-layer" }, world);
    layerMarks = el("g", {}, world);
    layerMembers = el("g", {}, world);
    layerMe = el("g", { class: "m-me", style: "display:none" }, world);
    el("circle", { class: "m-acc", r: 10 }, layerMe);
    const meMark = el("g", { class: "m-me-mark" }, layerMe);
    el("path", { class: "m-cone", d: "M0 0 L-16 -46 A48 48 0 0 1 16 -46 Z", style: "display:none" }, meMark);
    el("circle", { class: "m-me-halo", r: 15 }, meMark);
    el("circle", { class: "m-me-dot", r: 8 }, meMark);
  }

  function buildMarkers() {
    layerMarks.textContent = "";
    markerEls = [];
    const d = STORE.data;
    for (const p of STORE.places()) {
      if (d.hidden[p.cat]) continue;
      const cat = CATEGORIES[p.cat] || CATEGORIES.meu;
      const g = el("g", { class: "m-mark", "data-id": p.id }, layerMarks);
      if (d.done[p.id]) g.classList.add("is-done");
      if (d.favorites[p.id]) g.classList.add("is-fav");
      if (p.id === selectedId) g.classList.add("is-sel");
      el("circle", { r: 15, class: "m-mark-bg", style: "fill:" + cat.color }, g);
      const t = el("text", { class: "m-mark-icon", y: 1 }, g);
      t.textContent = STORE.iconOf(p);
      if (d.done[p.id]) {
        const c = el("g", { class: "m-badge", transform: "translate(11 -11)" }, g);
        el("circle", { r: 7, class: "m-badge-done" }, c);
        el("path", { d: "M-3.5 0 L-1 2.5 L3.5 -2.5", class: "m-badge-check" }, c);
      } else if (d.favorites[p.id]) {
        const c = el("g", { class: "m-badge", transform: "translate(11 -11)" }, g);
        el("circle", { r: 7, class: "m-badge-fav" }, c);
        const s = el("text", { class: "m-badge-star", y: 0.5 }, c);
        s.textContent = "★";
      }
      const wait = FILAS.info(p.id);
      const label = el("text", { class: "m-label", y: 29 }, g);
      label.textContent = p.name + (wait ? ` · ⏱${wait.min} min` : "");
      const sel = p.id === selectedId;
      const prio = (sel ? 100 : 0) + (d.favorites[p.id] ? 10 : 0) + (LABEL_PRIORITY[p.cat] || 0);
      markerEls.push({ g, label, x: p.x, y: p.y, fav: !!d.favorites[p.id], cat: p.cat, sel, prio });
    }
    schedule();
  }

  function drawMembers() {
    layerMembers.textContent = "";
    for (const m of members) {
      const g = el("g", { class: "m-member", "data-member": m.member_id }, layerMembers);
      m._g = g;
      el("circle", { r: 14, class: "m-member-bg", style: "fill:" + (m.color || "#ff70a6") }, g);
      const t = el("text", { class: "m-member-txt", y: 1 }, g);
      t.textContent = (m.name || "?").trim().slice(0, 2).toUpperCase();
      const l = el("text", { class: "m-label m-member-label", y: 28 }, g);
      l.textContent = m.name + (m.status ? " · " + m.status : "");
    }
    schedule();
  }

  function drawRoute() {
    layerRoute.textContent = "";
    if (!route) return;
    el("path", { d: pathD(route.points, false), class: "m-route-case" }, layerRoute);
    el("path", { d: pathD(route.points, false), class: "m-route" + (route.straight ? " is-straight" : "") }, layerRoute);
    schedule();
  }

  function render() {
    frame = 0;
    const t = `translate(${W / 2} ${H / 2}) rotate(${-view.rot}) scale(${view.s}) translate(${-view.cx} ${-view.cy})`;
    world.setAttribute("transform", t);
    const inv = `rotate(${view.rot}) scale(${1 / view.s})`;
    // Mapa afastado: ícones menores para não virar um amontoado.
    const k = Math.min(1, 0.5 + view.s * 0.35);
    const invMark = `rotate(${view.rot}) scale(${k / view.s})`;
    for (const m of markerEls) m.g.setAttribute("transform", `translate(${m.x} ${m.y}) ${m.sel ? inv : invMark}`);
    placeLabels();
    for (const m of members) {
      if (m._g && m._xy) m._g.setAttribute("transform", `translate(${m._xy.x} ${m._xy.y}) ${inv}`);
    }
    if (me) {
      layerMe.style.display = "";
      layerMe.querySelector(".m-acc").setAttribute("r", Math.max(3, me.acc || 0));
      layerMe.querySelector(".m-acc").setAttribute("cx", me.x);
      layerMe.querySelector(".m-acc").setAttribute("cy", me.y);
      const mark = layerMe.querySelector(".m-me-mark");
      mark.setAttribute("transform", `translate(${me.x} ${me.y}) rotate(${me.heading != null ? me.heading : 0}) scale(${1 / view.s})`);
      layerMe.querySelector(".m-cone").style.display = me.heading != null ? "" : "none";
    }
    handlers.render && handlers.render(view);
  }

  function worldToScreen(x, y) {
    const a = -view.rot * Math.PI / 180;
    const dx = (x - view.cx) * view.s, dy = (y - view.cy) * view.s;
    return { x: W / 2 + dx * Math.cos(a) - dy * Math.sin(a), y: H / 2 + dx * Math.sin(a) + dy * Math.cos(a) };
  }

  // Rótulos que se encavalam somem; quem tem prioridade (selecionado,
  // favorito, montanha-russa, lugar meu) é desenhado primeiro e fica.
  const LABEL_PRIORITY = { meu: 5, grupo: 5, montanha: 4, atracao: 3, aquatico: 3, show: 2, infantil: 2, animais: 2, comida: 2, banheiro: 1 };
  function placeLabels() {
    const show = STORE.data.showLabels;
    const boxes = [];
    const order = markerEls.slice().sort((a, b) => b.prio - a.prio);
    for (const m of order) {
      let visible = show && (view.s >= LABEL_MIN_S || m.fav || m.cat === "meu" || m.sel);
      if (visible) {
        const p = worldToScreen(m.x, m.y);
        const w = m.label.textContent.length * 6.6 + 6;
        const box = { l: p.x - w / 2, r: p.x + w / 2, t: p.y + 18, b: p.y + 34 };
        if (box.r < -50 || box.l > W + 50 || box.b < -50 || box.t > H + 50) visible = false;
        else if (boxes.some(o => box.l < o.r && box.r > o.l && box.t < o.b && box.b > o.t)) visible = false;
        else boxes.push(box);
      }
      m.label.style.display = visible ? "" : "none";
    }
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(render);
  }

  function resize() {
    const r = svg.getBoundingClientRect();
    W = r.width;
    H = r.height;
    schedule();
  }

  function screenToWorld(sx, sy) {
    const r = svg.getBoundingClientRect();
    const dx = (sx - r.left - W / 2) / view.s, dy = (sy - r.top - H / 2) / view.s;
    const a = view.rot * Math.PI / 180;
    return { x: view.cx + dx * Math.cos(a) - dy * Math.sin(a), y: view.cy + dx * Math.sin(a) + dy * Math.cos(a) };
  }

  function clampScale(s) {
    return Math.min(MAX_S, Math.max(MIN_S, s));
  }

  // Zoom mantendo fixo o ponto do mundo que está sob (sx, sy).
  function zoomAt(sx, sy, factor) {
    const before = screenToWorld(sx, sy);
    view.s = clampScale(view.s * factor);
    const after = screenToWorld(sx, sy);
    view.cx += before.x - after.x;
    view.cy += before.y - after.y;
    schedule();
  }

  // Enquadra as atrações (o contorno do parque inclui estacionamentos e mata).
  function fitPark() {
    const pts = PARK_DATA.pois.filter(p => p.cat !== "estacionamento");
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    view.cx = (minX + maxX) / 2;
    view.cy = (minY + maxY) / 2 - 40;
    view.rot = 0;
    view.s = clampScale(Math.min(W / (maxX - minX + 80), (H - 260) / (maxY - minY + 80)));
    schedule();
  }

  // Animação curta até um ponto, para o usuário não se perder no salto.
  let anim = 0;
  function flyTo(p, s, rot) {
    cancelAnimationFrame(anim);
    const from = { ...view };
    const to = { cx: p.x, cy: p.y, s: s ? clampScale(s) : view.s, rot: rot != null ? rot : view.rot };
    let dRot = ((to.rot - from.rot + 540) % 360) - 180;
    const t0 = performance.now();
    const step = now => {
      const k = Math.min(1, (now - t0) / 380);
      const e = 1 - Math.pow(1 - k, 3);
      view.cx = from.cx + (to.cx - from.cx) * e;
      view.cy = from.cy + (to.cy - from.cy) * e;
      view.s = from.s * Math.pow(to.s / from.s, e);
      view.rot = (from.rot + dRot * e + 360) % 360;
      render();
      if (k < 1) anim = requestAnimationFrame(step);
    };
    anim = requestAnimationFrame(step);
  }

  function jumpTo(p, rot) {
    cancelAnimationFrame(anim);
    view.cx = p.x;
    view.cy = p.y;
    if (rot != null) view.rot = rot;
    schedule();
  }

  // ---- gestos -------------------------------------------------------------

  const pointers = new Map();
  let gesture = null;
  let pressTimer = 0;

  function onDown(e) {
    svg.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    cancelAnimationFrame(anim);
    if (pointers.size === 1) {
      gesture = { startX: e.clientX, startY: e.clientY, t: Date.now(), moved: false, target: e.target };
      clearTimeout(pressTimer);
      pressTimer = setTimeout(() => {
        if (gesture && !gesture.moved && pointers.size === 1) {
          gesture.longPressed = true;
          if (navigator.vibrate) navigator.vibrate(30);
          handlers.longPress(screenToWorld(gesture.startX, gesture.startY));
        }
      }, 600);
    } else if (pointers.size === 2) {
      clearTimeout(pressTimer);
      const [a, b] = [...pointers.values()];
      gesture = Object.assign(gesture || {}, {
        moved: true,
        pinchD: Math.hypot(a.x - b.x, a.y - b.y),
        pinchA: Math.atan2(b.y - a.y, b.x - a.x),
        rotAccum: 0,
        rotating: false
      });
    }
  }

  function onMove(e) {
    const prev = pointers.get(e.pointerId);
    if (!prev || !gesture) return;
    const cur = { x: e.clientX, y: e.clientY };
    if (pointers.size === 1) {
      if (!gesture.moved && Math.hypot(cur.x - gesture.startX, cur.y - gesture.startY) < 8) return;
      if (!gesture.moved) { gesture.moved = true; clearTimeout(pressTimer); handlers.userMove(); }
      const a = screenToWorld(prev.x, prev.y), b = screenToWorld(cur.x, cur.y);
      view.cx -= b.x - a.x;
      view.cy -= b.y - a.y;
      pointers.set(e.pointerId, cur);
      schedule();
    } else if (pointers.size === 2) {
      pointers.set(e.pointerId, cur);
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      const midX = (a.x + b.x) / 2, midY = (a.y + b.y) / 2;
      handlers.userMove();
      zoomAt(midX, midY, d / gesture.pinchD);
      gesture.pinchD = d;
      // Giro com dois dedos só depois de 12°, senão toda pinça gira sem querer.
      let dA = (ang - gesture.pinchA) * 180 / Math.PI;
      dA = ((dA + 540) % 360) - 180;
      gesture.pinchA = ang;
      gesture.rotAccum += dA;
      if (!gesture.rotating && Math.abs(gesture.rotAccum) > 12) { gesture.rotating = true; dA = gesture.rotAccum; }
      if (gesture.rotating) {
        const before = screenToWorld(midX, midY);
        view.rot = (view.rot - dA + 360) % 360;
        const after = screenToWorld(midX, midY);
        view.cx += before.x - after.x;
        view.cy += before.y - after.y;
        handlers.rotate && handlers.rotate(view.rot);
      }
      schedule();
    }
  }

  function onUp(e) {
    pointers.delete(e.pointerId);
    clearTimeout(pressTimer);
    if (!gesture) return;
    if (pointers.size === 0) {
      if (!gesture.moved && !gesture.longPressed && Date.now() - gesture.t < 500) tap(gesture.target);
      gesture = null;
    } else if (pointers.size === 1) {
      gesture.moved = true;
      const [p] = [...pointers.values()];
      gesture.startX = p.x;
      gesture.startY = p.y;
    }
  }

  let lastTap = 0;
  function tap(target) {
    const member = target.closest && target.closest("[data-member]");
    if (member) return handlers.tapMember(member.getAttribute("data-member"));
    const mark = target.closest && target.closest("[data-id]");
    if (mark) return handlers.tap(mark.getAttribute("data-id"));
    const now = Date.now();
    if (now - lastTap < 300 && gesture) {
      handlers.userMove();
      zoomAt(gesture.startX, gesture.startY, 2);
      lastTap = 0;
      return;
    }
    lastTap = now;
    handlers.tap(null);
  }

  function onWheel(e) {
    e.preventDefault();
    handlers.userMove();
    zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0015));
  }

  function init(svgEl) {
    svg = svgEl;
    world = el("g", { id: "world" }, svg);
    drawStatic();
    resize();
    buildMarkers();
    fitPark();
    svg.addEventListener("pointerdown", onDown);
    svg.addEventListener("pointermove", onMove);
    svg.addEventListener("pointerup", onUp);
    svg.addEventListener("pointercancel", onUp);
    svg.addEventListener("wheel", onWheel, { passive: false });
    svg.addEventListener("contextmenu", e => e.preventDefault());
    window.addEventListener("resize", resize);
  }

  return {
    init, render: schedule, fitPark, flyTo, jumpTo, zoomAt, buildMarkers, screenToWorld,
    get view() { return view; },
    on(name, fn) { handlers[name] = fn; },
    setMe(p) { me = p; schedule(); },
    setRoute(r) { route = r; drawRoute(); },
    setMembers(list) {
      members = list.map(m => Object.assign({}, m, { _xy: GEO.toXY(m.lat, m.lon) }));
      drawMembers();
    },
    setRotation(deg) { view.rot = (deg + 360) % 360; schedule(); },
    select(id) { selectedId = id; buildMarkers(); },
    zoomBy(f) { zoomAt(svg.getBoundingClientRect().left + W / 2, svg.getBoundingClientRect().top + H / 2, f); }
  };
})();
