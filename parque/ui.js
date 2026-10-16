/*
 * ui.js — telas, botões e o fio que liga GPS, mapa, rota e grupo.
 *
 * Regra de ouro: cálculo de rota fica em route.js, desenho em map.js,
 * dados salvos em store.js e servidor em group.js. Aqui só eventos e HTML.
 */
"use strict";

const UI = (() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const state = {
    follow: false,          // câmera acompanha o GPS
    rotateMode: "norte",    // "norte" | "direcao" (mapa gira com a bússola)
    selected: null,         // id do lugar aberto no detalhe
    route: null,            // {targetId, target:{x,y,name}, plan}
    tab: "lugares",
    listCat: "",
    arrivedAt: 0
  };
  let wakeLock = null;

  // ---- avisos -------------------------------------------------------------

  let toastTimer = 0;
  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 3200);
  }

  function gpsStatus(msg, level) {
    const p = $("gpsPill");
    p.textContent = msg;
    p.className = "pill " + (level ? "pill-" + level : "");
  }

  // ---- utilidades ----------------------------------------------------------

  function myPos() {
    return GPS.current();
  }

  function distTo(place) {
    const me = myPos();
    return me ? GEO.dist(me, place) : null;
  }

  function distLabel(place) {
    const d = distTo(place);
    if (d == null) return "";
    return `${GEO.fmtDist(d)} · ${GEO.walkMinutes(d)} min`;
  }

  function sortedPlaces(filterFn) {
    const me = myPos();
    const list = STORE.places().filter(filterFn || (() => true));
    if (me) list.sort((a, b) => GEO.dist(me, a) - GEO.dist(me, b));
    return list;
  }

  function norm(s) {
    return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  }

  function matches(place, q) {
    const cat = CATEGORIES[place.cat];
    return norm(place.name + " " + (cat ? cat.label : "")).includes(norm(q));
  }

  function ago(ts) {
    const min = Math.round((Date.now() - ts) / 60000);
    if (min < 1) return "agora";
    if (min < 60) return `há ${min} min`;
    return `há ${Math.floor(min / 60)} h ${min % 60} min`;
  }

  function clock(ts) {
    return new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  // ---- busca e atalhos ----------------------------------------------------

  const QUICK = ["montanha", "atracao", "aquatico", "infantil", "show", "comida", "banheiro", "animais"];

  function renderChips() {
    $("quickChips").innerHTML = QUICK.map(c => {
      const cat = CATEGORIES[c];
      return `<button class="chip" data-cat="${c}" style="--c:${cat.color}">${cat.icon} ${esc(cat.label)}</button>`;
    }).join("");
  }

  function renderSearch() {
    const q = $("searchInput").value.trim();
    const box = $("searchResults");
    if (!q) { box.hidden = true; return; }
    const list = sortedPlaces(p => matches(p, q)).slice(0, 8);
    box.hidden = false;
    box.innerHTML = list.length
      ? list.map(placeRow).join("")
      : `<p class="empty">Nada com “${esc(q)}”. Segure o dedo no mapa para marcar um lugar novo.</p>`;
  }

  function placeRow(p) {
    const cat = CATEGORIES[p.cat] || CATEGORIES.meu;
    const d = STORE.data;
    const wait = d.waits[p.id];
    const flags = (d.done[p.id] ? '<span class="flag ok">✓ fui</span>' : "") +
      (d.favorites[p.id] ? '<span class="flag fav">★</span>' : "") +
      (wait && Date.now() - wait.at < 3 * 3600e3 ? `<span class="flag wait">⏱ ${wait.min} min</span>` : "");
    return `<button class="row" data-open="${esc(p.id)}">
      <span class="row-icon" style="background:${cat.color}">${STORE.iconOf(p)}</span>
      <span class="row-main"><strong>${esc(p.name)}</strong><small>${esc(cat.label)}${distTo(p) != null ? " · " + distLabel(p) : ""}</small></span>
      <span class="row-flags">${flags}</span>
    </button>`;
  }

  // ---- perto de você -------------------------------------------------------

  function renderNear() {
    const strip = $("nearStrip");
    const me = myPos();
    if (!me || !$("sheet").hidden || !$("panel").hidden || state.route || !GEO.insidePark(me)) {
      strip.hidden = true;
      return;
    }
    const list = sortedPlaces(p => !["estacionamento", "servico"].includes(p.cat)).slice(0, 8);
    strip.hidden = false;
    strip.innerHTML = list.map(p => {
      const cat = CATEGORIES[p.cat] || CATEGORIES.meu;
      return `<button class="near-card" data-open="${esc(p.id)}" style="--c:${cat.color}">
        <span>${STORE.iconOf(p)}</span><strong>${esc(p.name)}</strong><small>${GEO.fmtDist(GEO.dist(me, p))}</small>
      </button>`;
    }).join("");
  }

  // ---- detalhe do lugar ----------------------------------------------------

  function openPlace(id, fly) {
    const p = STORE.placeById(id);
    if (!p) return;
    state.selected = id;
    MAP.select(id);
    closePanel();
    $("searchResults").hidden = true;
    if (fly) {
      state.follow = false;
      MAP.flyTo(p, Math.max(MAP.view.s, 2.2));
    }
    renderPlaceSheet();
  }

  function renderPlaceSheet() {
    const p = STORE.placeById(state.selected);
    if (!p) return closeSheet();
    const d = STORE.data;
    const cat = CATEGORIES[p.cat] || CATEGORIES.meu;
    const me = myPos();
    const wait = d.waits[p.id];
    const dist = me ? GEO.dist(me, p) : null;
    const dir = me ? GEO.compassName(GEO.bearing(me, p)) : "";
    const info = (p.info || []).map(i => `<li>${esc(i)}</li>`).join("");
    const note = d.notes[p.id];
    const isRouting = state.route && state.route.targetId === p.id;
    $("sheetBody").innerHTML = `
      <div class="place-head">
        <span class="place-icon" style="background:${cat.color}">${STORE.iconOf(p)}</span>
        <div>
          <h2>${esc(p.name)}</h2>
          <p class="muted">${esc(cat.label)}${dist != null ? ` · <b>${GEO.fmtDist(dist)}</b> ao ${dir} · ~${GEO.walkMinutes(dist)} min a pé` : ""}</p>
        </div>
      </div>
      ${info ? `<ul class="info">${info}</ul>` : ""}
      ${wait ? `<p class="wait-line">⏱ Fila anotada: <b>${wait.min} min</b> <span class="muted">(${ago(wait.at)})</span></p>` : ""}
      ${d.done[p.id] ? `<p class="done-line">✓ Você foi às ${clock(d.done[p.id])}</p>` : ""}
      ${note ? `<p class="note-line">📝 ${esc(note)}</p>` : ""}
      <div class="actions">
        <button class="btn btn-primary" data-act="${isRouting ? "stop" : "go"}">${isRouting ? "✕ Parar rota" : "🧭 Ir até lá"}</button>
        <button class="btn ${d.favorites[p.id] ? "on" : ""}" data-act="fav">${d.favorites[p.id] ? "★ Favorito" : "☆ Favoritar"}</button>
        <button class="btn ${d.done[p.id] ? "on" : ""}" data-act="done">${d.done[p.id] ? "✓ Já fui" : "○ Já fui?"}</button>
        <button class="btn" data-act="wait">⏱ Fila</button>
        <button class="btn" data-act="note">📝 Nota</button>
        ${GROUP.active && p.cat !== "grupo" ? `<button class="btn" data-act="share">👥 Mandar pro grupo</button>` : ""}
        ${p.pin ? `<button class="btn btn-danger" data-act="remove">🗑 Remover</button>` : ""}
        ${p.groupPin ? `<button class="btn btn-danger" data-act="gremove">🗑 Tirar do grupo</button>` : ""}
      </div>`;
    openSheet();
  }

  async function placeAction(act) {
    const p = STORE.placeById(state.selected);
    if (!p) return;
    if (act === "go") return startRoute(p);
    if (act === "stop") { stopRoute(); return renderPlaceSheet(); }
    if (act === "fav") STORE.toggle("favorites", p.id);
    if (act === "done") {
      const on = STORE.toggle("done", p.id);
      if (on) toast(`Boa! ${countDone()} lugares no dia.`);
    }
    if (act === "wait") {
      const prev = STORE.data.waits[p.id];
      const v = prompt(`Quantos minutos de fila em ${p.name}? (vazio apaga)`, prev ? prev.min : "");
      if (v === null) return;
      STORE.setWait(p.id, v.trim() === "" ? null : parseInt(v, 10));
    }
    if (act === "note") {
      const v = prompt(`Anotação para ${p.name}:`, STORE.data.notes[p.id] || "");
      if (v === null) return;
      STORE.setNote(p.id, v.trim());
    }
    if (act === "share") {
      try {
        await GROUP.sharePin(p.pin ? p.pin.kind : "lugar", p.name, p.x, p.y, p.pin ? p.pin.id : null);
        toast("Mandado para o grupo");
      } catch (e) { toast("Não foi: " + e.message); }
    }
    if (act === "remove") {
      if (!confirm(`Remover “${p.name}”?`)) return;
      if (state.route && state.route.targetId === p.id) stopRoute();
      STORE.removePin(p.id);
      MAP.buildMarkers();
      return closeSheet();
    }
    if (act === "gremove") {
      try { await GROUP.removePin(p.groupPin.pin_id); } catch (e) { toast("Não foi: " + e.message); }
      MAP.buildMarkers();
      return closeSheet();
    }
    MAP.buildMarkers();
    renderPlaceSheet();
  }

  function countDone() {
    return Object.keys(STORE.data.done).length;
  }

  // ---- toque longo: marcar lugares ----------------------------------------

  let pressPoint = null;
  function openLongPress(xy) {
    pressPoint = xy;
    state.selected = null;
    MAP.select(null);
    const me = myPos();
    const d = me ? GEO.fmtDist(GEO.dist(me, xy)) : "";
    $("sheetBody").innerHTML = `
      <h2>Este ponto do mapa</h2>
      <p class="muted">${d ? "A " + d + " de você" : "Segure em qualquer lugar do mapa para abrir este menu."}</p>
      <div class="actions">
        <button class="btn btn-primary" data-lp="route">🧭 Rota até aqui</button>
        <button class="btn" data-lp="carro">🚗 Meu carro está aqui</button>
        <button class="btn" data-lp="encontro">🚩 Ponto de encontro aqui</button>
        <button class="btn" data-lp="lugar">📍 Marcar lugar</button>
        <button class="btn" data-lp="here">🙋 Estou aqui (corrigir GPS)</button>
      </div>`;
    openSheet();
  }

  async function longPressAction(act) {
    const xy = pressPoint;
    if (!xy) return;
    if (act === "route") return startRoute({ id: null, name: "Ponto marcado", x: xy.x, y: xy.y });
    if (act === "here") {
      GPS.setManual(xy);
      toast("Posição fixada aqui até o GPS mandar uma leitura melhor");
      return closeSheet();
    }
    let name = PIN_KINDS[act].label;
    if (act === "lugar") {
      const v = prompt("Nome do lugar:", "");
      if (v === null) return;
      name = v.trim() || "Lugar marcado";
    }
    const pin = STORE.setPin(act, name, xy.x, xy.y);
    MAP.buildMarkers();
    if (act === "encontro" && GROUP.active) {
      try {
        await GROUP.sharePin("encontro", name, xy.x, xy.y, pin.id);
        toast("Ponto de encontro enviado ao grupo");
      } catch (e) { toast("Marcado no seu mapa (grupo sem conexão)"); }
    } else {
      toast(`${PIN_KINDS[act].icon} ${name} marcado`);
    }
    openPlace(pin.id);
  }

  // ---- folha de baixo e painel --------------------------------------------

  function openSheet() {
    $("sheet").hidden = false;
    renderNear();
  }

  function closeSheet() {
    $("sheet").hidden = true;
    state.selected = null;
    pressPoint = null;
    MAP.select(null);
    renderNear();
  }

  function openPanel(tab) {
    if (tab) state.tab = tab;
    $("panel").hidden = false;
    $("sheet").hidden = true;
    $("searchResults").hidden = true;
    document.querySelectorAll(".tabs button").forEach(b => b.classList.toggle("active", b.dataset.tab === state.tab));
    renderPanel();
    renderNear();
  }

  function closePanel() {
    $("panel").hidden = true;
    renderNear();
  }

  function renderPanel() {
    if ($("panel").hidden) return;
    const body = $("panelBody");
    if (state.tab === "lugares") body.innerHTML = tabPlaces();
    if (state.tab === "roteiro") body.innerHTML = tabPlan();
    if (state.tab === "grupo") body.innerHTML = tabGroup();
    if (state.tab === "ajustes") body.innerHTML = tabSettings();
  }

  function tabPlaces() {
    const cats = Object.keys(CATEGORIES).filter(c => STORE.places().some(p => p.cat === c));
    const chips = [`<button class="chip ${state.listCat ? "" : "active"}" data-listcat="">Todos</button>`]
      .concat(cats.map(c => `<button class="chip ${state.listCat === c ? "active" : ""}" data-listcat="${c}" style="--c:${CATEGORIES[c].color}">${CATEGORIES[c].icon} ${esc(CATEGORIES[c].label)}</button>`))
      .join("");
    const list = sortedPlaces(p => !state.listCat || p.cat === state.listCat);
    return `<div class="chips wrap">${chips}</div>
      <p class="muted small">${myPos() ? "Ordenado pela distância de você." : "Ligue o GPS para ordenar pela distância."}</p>
      <div class="list">${list.map(placeRow).join("") || '<p class="empty">Nada nesta categoria.</p>'}</div>`;
  }

  function tabPlan() {
    const d = STORE.data;
    const attractions = STORE.places().filter(p => ["montanha", "atracao", "aquatico", "infantil", "show", "animais"].includes(p.cat));
    const doneCount = attractions.filter(p => d.done[p.id]).length;
    const pct = attractions.length ? Math.round(doneCount / attractions.length * 100) : 0;
    const favs = sortedPlaces(p => d.favorites[p.id] && !d.done[p.id]);
    const done = STORE.places().filter(p => d.done[p.id]).sort((a, b) => d.done[a.id] - d.done[b.id]);
    const next = favs[0];
    return `
      <div class="progress-card">
        <div class="progress-num">${doneCount}<small>/${attractions.length}</small></div>
        <div class="progress-txt"><strong>atrações no dia</strong><div class="bar"><span style="width:${pct}%"></span></div></div>
      </div>
      ${next ? `<button class="btn btn-primary wide" data-open="${esc(next.id)}" data-go="1">🧭 Próximo favorito mais perto: ${esc(next.name)}${distTo(next) != null ? " · " + GEO.fmtDist(distTo(next)) : ""}</button>` : ""}
      <h3>★ Quero ir (${favs.length})</h3>
      <div class="list">${favs.map(placeRow).join("") || '<p class="empty">Toque num lugar e em ☆ Favoritar para montar seu roteiro.</p>'}</div>
      <h3>✓ Já fui (${done.length})</h3>
      <div class="timeline">${done.map(p => `<button class="tl-item" data-open="${esc(p.id)}"><span class="tl-time">${clock(d.done[p.id])}</span><span>${STORE.iconOf(p)} ${esc(p.name)}</span></button>`).join("") || '<p class="empty">Marque “Já fui” em cada atração para ver sua linha do tempo.</p>'}</div>`;
  }

  function tabGroup() {
    const d = STORE.data;
    if (!GROUP.active) {
      const pending = (location.hash.match(/grupo=([A-Za-z0-9]+)/) || [])[1] || "";
      return `
        <p>Veja no mapa onde cada pessoa do grupo está, em tempo real, e divida pontos de encontro.</p>
        <label class="field">Seu nome<input id="gName" maxlength="24" value="${esc(d.profile.name)}" placeholder="Ex.: Ana"></label>
        <button class="btn btn-primary wide" data-group="create">✨ Criar grupo novo</button>
        <div class="or">ou entre num grupo</div>
        <label class="field">Código do grupo<input id="gCode" maxlength="16" value="${esc(pending)}" placeholder="ABC123" autocapitalize="characters"></label>
        <button class="btn wide" data-group="join">Entrar</button>
        <p class="muted small">Sua posição só é enviada enquanto o app está aberto e só quem tem o código vê. Ninguém fica no grupo depois de 3 h sem abrir o app.</p>`;
    }
    const me = myPos();
    const rows = GROUP.members.map(m => {
      const xy = GEO.toXY(m.lat, m.lon);
      const dist = me ? GEO.fmtDist(GEO.dist(me, xy)) + " · " + GEO.compassName(GEO.bearing(me, xy)) : "";
      const stale = m.ageSec > 60 ? ` · visto ${ago(Date.now() - m.ageSec * 1000)}` : "";
      return `<button class="row" data-member="${esc(m.member_id)}">
        <span class="row-icon" style="background:${esc(m.color)}">${esc((m.name || "?").slice(0, 2).toUpperCase())}</span>
        <span class="row-main"><strong>${esc(m.name)}</strong><small>${esc(m.status || "")}${m.status ? " · " : ""}${dist}${stale}</small></span>
        <span class="row-flags">🧭</span>
      </button>`;
    }).join("");
    const statuses = ["", "Na fila", "Comendo", "No banheiro", "Me espera", "Indo pro encontro", "Saindo do parque"];
    return `
      <div class="group-code">
        <div><small class="muted">Código do grupo</small><strong>${esc(GROUP.code)}</strong></div>
        <button class="btn" data-group="share">📤 Convidar</button>
      </div>
      <p class="muted small">${GROUP.online ? "🟢 Sincronizando a cada 4 s" : "🟠 Sem conexão — tentando de novo"}${GROUP.lastOkAt ? " · última " + ago(GROUP.lastOkAt) : ""}</p>
      <h3>Meu status</h3>
      <div class="chips wrap">${statuses.map(s => `<button class="chip ${GROUP.status === s ? "active" : ""}" data-status="${esc(s)}">${s || "Nenhum"}</button>`).join("")}</div>
      <h3>Pessoas (${GROUP.members.length})</h3>
      <div class="list">${rows || '<p class="empty">Ninguém mais por aqui ainda. Mande o convite!</p>'}</div>
      <h3>Pontos do grupo</h3>
      <div class="list">${GROUP.placeList().map(placeRow).join("") || '<p class="empty">Segure o dedo no mapa → “Ponto de encontro aqui” para avisar todo mundo.</p>'}</div>
      <label class="field">Meu nome<input id="gName" maxlength="24" value="${esc(d.profile.name)}"></label>
      <div class="color-row">${GROUP.COLORS.map(c => `<button class="color ${d.profile.color === c ? "active" : ""}" data-color="${c}" style="background:${c}" aria-label="Cor"></button>`).join("")}</div>
      <button class="btn btn-danger wide" data-group="leave">Sair do grupo</button>`;
  }

  function tabSettings() {
    const d = STORE.data;
    const cats = Object.keys(CATEGORIES).map(c => `<label class="toggle"><input type="checkbox" data-hide="${c}" ${d.hidden[c] ? "" : "checked"}> ${CATEGORIES[c].icon} ${esc(CATEGORIES[c].label)}</label>`).join("");
    return `
      <h3>Mapa</h3>
      <label class="toggle"><input type="checkbox" id="optLabels" ${d.showLabels ? "checked" : ""}> Mostrar nomes no mapa</label>
      <h3>Mostrar no mapa</h3>
      <div class="toggles">${cats}</div>
      <h3>Dados</h3>
      <div class="actions">
        <button class="btn" data-set="export">💾 Exportar backup</button>
        <button class="btn" data-set="import">📂 Importar backup</button>
        <button class="btn btn-danger" data-set="reset">🔄 Começar dia novo</button>
      </div>
      <p class="muted small">“Começar dia novo” limpa as atrações visitadas e as filas anotadas. Favoritos, notas e lugares marcados continuam.</p>
      <h3>Sobre</h3>
      <p class="muted small">Mapa do Parque v${APP_VERSION}. Desenho e posições vêm do OpenStreetMap (© colaboradores do OpenStreetMap, licença ODbL), dados de ${esc(PARK_DATA.generated)}. Algumas atrações novas podem não estar no mapa: segure o dedo no lugar e marque você mesmo.</p>
      <p class="muted small">Funciona sem internet depois de aberto uma vez. Só o grupo precisa de conexão.</p>`;
  }

  async function groupAction(act) {
    const nameEl = $("gName");
    const name = nameEl ? nameEl.value.trim() : "";
    try {
      if (act === "create" || act === "join") {
        if (!name) { toast("Digite seu nome primeiro"); return nameEl && nameEl.focus(); }
        const code = act === "create" ? GROUP.create(name) : GROUP.join($("gCode").value, name);
        if (location.hash.includes("grupo=")) history.replaceState(null, "", location.pathname + location.search);
        toast(`No grupo ${code}`);
        if (act === "create") shareInvite();
      }
      if (act === "share") shareInvite();
      if (act === "leave") {
        if (!confirm("Sair do grupo? Os outros param de ver você.")) return;
        await GROUP.leave();
      }
    } catch (e) {
      toast(e.message);
    }
    renderPanel();
    updateGroupPill();
  }

  async function shareInvite() {
    const link = GROUP.shareLink();
    const text = `Entra no meu grupo do Mapa do Parque: código ${GROUP.code}`;
    try {
      if (navigator.share) return await navigator.share({ title: "Mapa do Parque", text, url: link });
    } catch (e) { return; }
    try {
      await navigator.clipboard.writeText(text + "\n" + link);
      toast("Convite copiado. Cole no WhatsApp.");
    } catch (e) {
      prompt("Copie o convite:", link);
    }
  }

  function settingsAction(act) {
    if (act === "export") {
      const blob = new Blob([STORE.exportJson()], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `mapa-parque-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }
    if (act === "import") $("importFile").click();
    if (act === "reset") {
      if (!confirm("Limpar atrações visitadas e filas anotadas?")) return;
      STORE.resetDay();
      MAP.buildMarkers();
      renderPanel();
      toast("Dia novo começando!");
    }
  }

  // ---- rota e navegação ---------------------------------------------------

  function startRoute(target) {
    const me = myPos();
    if (!me) {
      toast("Ligue o GPS (◎) ou segure o dedo no mapa → “Estou aqui”.");
      GPS.start();
      return;
    }
    state.route = { targetId: target.id, target: { x: target.x, y: target.y, name: target.name }, plan: null, lastPlanAt: 0, from: null };
    state.arrivedAt = 0;
    replan(true);
    updateNav();
    state.follow = true;
    MAP.flyTo(me, Math.max(MAP.view.s, 2.5));
    requestWake();
    $("sheet").hidden = true;
    renderNear();
  }

  function stopRoute() {
    state.route = null;
    MAP.setRoute(null);
    $("navBanner").hidden = true;
    releaseWake();
    renderNear();
  }

  // Recalcula a rota quando a pessoa se afasta dela ou a cada 15 s.
  function replan(force) {
    const r = state.route;
    const me = myPos();
    if (!r || !me) return;
    const moved = r.from ? GEO.dist(r.from, me) : Infinity;
    if (!force && moved < 10 && Date.now() - r.lastPlanAt < 15000) return;
    r.plan = ROUTE.plan(me, r.target);
    r.from = { x: me.x, y: me.y };
    r.lastPlanAt = Date.now();
    MAP.setRoute(r.plan);
  }

  function updateNav() {
    const r = state.route;
    const me = myPos();
    if (!r || !me) { $("navBanner").hidden = true; return; }
    replan(false);
    const remaining = r.plan.points.length > 2 ? remainingLength(r.plan, me) : GEO.dist(me, r.target);
    const next = ROUTE.nextTarget(r.plan, me);
    const bearing = GEO.bearing(me, next);
    // Seta relativa: com bússola, "para frente" é para onde o celular aponta.
    const ref = me.heading != null ? me.heading : MAP.view.rot;
    $("navArrow").style.transform = `rotate(${bearing - ref - 90}deg)`;
    $("navTitle").textContent = r.target.name;
    $("navSub").textContent = remaining < 20
      ? "Você chegou! 🎉"
      : `${GEO.fmtDist(remaining)} · ${GEO.walkMinutes(remaining)} min${r.plan.straight ? " · siga a seta" : " · pelo caminho"}`;
    $("navBanner").hidden = false;
    if (remaining < 20 && !state.arrivedAt) {
      state.arrivedAt = Date.now();
      if (navigator.vibrate) navigator.vibrate([120, 80, 120]);
      toast(`Chegou em ${r.target.name}!`);
      setTimeout(() => {
        if (state.route && state.arrivedAt) {
          const id = state.route.targetId;
          stopRoute();
          if (id) openPlace(id);
        }
      }, 4000);
    }
  }

  function remainingLength(plan, me) {
    let bestI = 0, bestD = Infinity;
    plan.points.forEach((p, i) => {
      const d = GEO.dist(me, p);
      if (d < bestD) { bestD = d; bestI = i; }
    });
    let len = bestD;
    for (let i = bestI + 1; i < plan.points.length; i++) len += GEO.dist(plan.points[i - 1], plan.points[i]);
    return len;
  }

  async function requestWake() {
    try {
      if ("wakeLock" in navigator && !wakeLock) wakeLock = await navigator.wakeLock.request("screen");
    } catch (e) { wakeLock = null; }
  }

  function releaseWake() {
    if (wakeLock) wakeLock.release().catch(() => {});
    wakeLock = null;
  }

  // ---- GPS e bússola ------------------------------------------------------

  let firstFix = true;
  function onGps(me) {
    MAP.setMe(me);
    const inside = GEO.insidePark(me);
    if (me.manual) gpsStatus("🙋 Posição fixada à mão", "aviso");
    else if (!inside) {
      const d = GEO.dist(me, { x: 0, y: 0 });
      gpsStatus(`📡 Fora do parque · ${GEO.fmtDist(d)} do centro`, "aviso");
    } else gpsStatus(`📡 GPS ±${Math.round(me.acc)} m`, me.acc <= 15 ? "ok" : me.acc <= 40 ? "aviso" : "erro");

    if (firstFix && !me.manual) {
      firstFix = false;
      if (inside) {
        state.follow = true;
        MAP.flyTo(me, Math.max(MAP.view.s, 2.2));
      } else toast("Você ainda não está no parque. O mapa segue no parque; o ponto azul aparece quando chegar perto.");
    }
    if (state.follow) MAP.jumpTo(me, state.rotateMode === "direcao" && me.heading != null ? me.heading : null);
    else if (state.rotateMode === "direcao" && me.heading != null) MAP.setRotation(me.heading);
    $("btnLocate").classList.toggle("active", state.follow);
    updateNav();
    GROUP.onMove(me);
    throttledUiRefresh();
  }

  // Distâncias nas listas mudam a cada passo; redesenhar a cada leitura cansa.
  let refreshAt = 0;
  function throttledUiRefresh() {
    if (Date.now() - refreshAt < 2500) return;
    refreshAt = Date.now();
    renderNear();
    if (!$("sheet").hidden && state.selected) renderPlaceSheet();
    if (!$("panel").hidden && document.activeElement?.tagName !== "INPUT") renderPanel();
  }

  async function enableSensors() {
    GPS.start();
    const ok = await GPS.enableCompass();
    if (!ok) toast("Bússola não liberada. A direção aparece enquanto você anda.");
    try { localStorage.setItem("parque:sensores", "1"); } catch (e) { /* sem armazenamento */ }
  }

  function updateCompassButton(view) {
    $("compassNeedle").style.transform = `rotate(${-view.rot}deg)`;
    $("btnCompass").classList.toggle("active", state.rotateMode === "direcao");
  }

  // ---- grupo no mapa ------------------------------------------------------

  function updateGroupPill() {
    const pill = $("groupPill");
    const count = $("groupCount");
    if (!GROUP.active) { pill.hidden = true; count.hidden = true; return; }
    pill.hidden = false;
    pill.className = "pill " + (GROUP.online ? "pill-ok" : "pill-aviso");
    pill.textContent = `👥 ${GROUP.code} · ${GROUP.members.length + 1} no mapa`;
    count.hidden = false;
    count.textContent = GROUP.members.length + 1;
  }

  function onGroupChange() {
    MAP.setMembers(GROUP.members);
    MAP.buildMarkers();
    updateGroupPill();
    if (state.route && state.route.memberId) {
      const m = GROUP.members.find(x => x.member_id === state.route.memberId);
      if (m) state.route.target = Object.assign(GEO.toXY(m.lat, m.lon), { name: m.name });
    }
    if (!$("panel").hidden && state.tab === "grupo" && document.activeElement?.tagName !== "INPUT") renderPanel();
  }

  function openMember(memberId) {
    const m = GROUP.members.find(x => x.member_id === memberId);
    if (!m) return;
    const xy = GEO.toXY(m.lat, m.lon);
    const me = myPos();
    closePanel();
    MAP.flyTo(xy, Math.max(MAP.view.s, 2.2));
    state.follow = false;
    $("sheetBody").innerHTML = `
      <div class="place-head">
        <span class="place-icon" style="background:${esc(m.color)}">${esc((m.name || "?").slice(0, 2).toUpperCase())}</span>
        <div><h2>${esc(m.name)}</h2>
        <p class="muted">${esc(m.status || "Sem status")}${me ? ` · <b>${GEO.fmtDist(GEO.dist(me, xy))}</b> ao ${GEO.compassName(GEO.bearing(me, xy))}` : ""} · ±${Math.round(m.acc || 0)} m · ${m.ageSec < 15 ? "ao vivo" : "visto " + ago(Date.now() - m.ageSec * 1000)}</p></div>
      </div>
      <div class="actions"><button class="btn btn-primary" data-member-go="${esc(m.member_id)}">🧭 Ir até ${esc(m.name)}</button></div>`;
    openSheet();
  }

  // ---- eventos ------------------------------------------------------------

  function bind() {
    $("searchInput").addEventListener("input", renderSearch);
    $("searchInput").addEventListener("focus", () => { closeSheet(); renderSearch(); });
    $("btnMenu").addEventListener("click", () => openPanel());
    $("btnGroup").addEventListener("click", () => openPanel("grupo"));
    $("groupPill").addEventListener("click", () => openPanel("grupo"));
    $("gpsPill").addEventListener("click", () => enableSensors());
    $("panelClose").addEventListener("click", closePanel);
    $("navStop").addEventListener("click", stopRoute);
    $("btnZoomIn").addEventListener("click", () => MAP.zoomBy(1.6));
    $("btnZoomOut").addEventListener("click", () => MAP.zoomBy(1 / 1.6));

    $("btnLocate").addEventListener("click", () => {
      const me = myPos();
      if (!me) { enableSensors(); toast("Procurando sua posição…"); return; }
      if (state.follow && GEO.insidePark(me)) {
        // Segundo toque: alterna o mapa girar junto com você.
        toggleRotateMode();
        return;
      }
      state.follow = true;
      $("btnLocate").classList.add("active");
      MAP.flyTo(me, Math.max(MAP.view.s, 2.5));
    });

    $("btnCompass").addEventListener("click", () => {
      if (state.rotateMode === "direcao" || MAP.view.rot !== 0) {
        state.rotateMode = "norte";
        MAP.flyTo({ x: MAP.view.cx, y: MAP.view.cy }, null, 0);
      } else toggleRotateMode();
      updateCompassButton(MAP.view);
    });

    document.querySelectorAll(".tabs button").forEach(b => b.addEventListener("click", () => openPanel(b.dataset.tab)));

    // Cliques delegados: listas, folha e painel usam data-atributos.
    document.addEventListener("click", e => {
      const t = e.target.closest("[data-open],[data-act],[data-lp],[data-cat],[data-listcat],[data-group],[data-status],[data-color],[data-set],[data-member],[data-member-go]");
      if (!t) return;
      const ds = t.dataset;
      if (ds.open) {
        $("searchInput").value = "";
        $("searchInput").blur();
        openPlace(ds.open, true);
        if (ds.go) { const p = STORE.placeById(ds.open); if (p) startRoute(p); }
      } else if (ds.act) placeAction(ds.act);
      else if (ds.lp) longPressAction(ds.lp);
      else if (ds.cat) { state.listCat = ds.cat; openPanel("lugares"); }
      else if (ds.listcat !== undefined) { state.listCat = ds.listcat; renderPanel(); }
      else if (ds.group) groupAction(ds.group);
      else if (ds.status !== undefined) { GROUP.setStatus(ds.status); renderPanel(); }
      else if (ds.color) { STORE.data.profile.color = ds.color; STORE.save(); GROUP.sync(); renderPanel(); }
      else if (ds.set) settingsAction(ds.set);
      else if (ds.memberGo) {
        const m = GROUP.members.find(x => x.member_id === ds.memberGo);
        if (m) { startRoute(Object.assign(GEO.toXY(m.lat, m.lon), { id: null, name: m.name })); state.route.memberId = m.member_id; }
      } else if (ds.member) openMember(ds.member);
    });

    document.addEventListener("change", e => {
      const t = e.target;
      if (t.dataset.hide) {
        if (t.checked) delete STORE.data.hidden[t.dataset.hide];
        else STORE.data.hidden[t.dataset.hide] = true;
        STORE.save();
        MAP.buildMarkers();
      }
      if (t.id === "optLabels") {
        STORE.data.showLabels = t.checked;
        STORE.save();
        MAP.render();
      }
      if (t.id === "gName" && GROUP.active) {
        STORE.data.profile.name = t.value.trim().slice(0, 24);
        STORE.save();
        GROUP.sync();
      }
    });

    $("importFile").addEventListener("change", async e => {
      const f = e.target.files[0];
      e.target.value = "";
      if (!f) return;
      try {
        const text = await f.text();
        if (!confirm("Substituir favoritos, visitas, notas e lugares deste aparelho pelo backup?")) return;
        STORE.importJson(text);
        MAP.buildMarkers();
        renderPanel();
        toast("Backup importado");
      } catch (err) { toast("Não consegui ler: " + err.message); }
    });

    MAP.on("tap", id => {
      if (id) openPlace(id, false);
      else { closeSheet(); $("searchResults").hidden = true; $("searchInput").blur(); }
    });
    MAP.on("tapMember", openMember);
    MAP.on("longPress", openLongPress);
    MAP.on("userMove", () => {
      if (state.follow) { state.follow = false; $("btnLocate").classList.remove("active"); }
      if (state.rotateMode === "direcao") { state.rotateMode = "norte"; }
    });
    MAP.on("render", updateCompassButton);

    GPS.onChange(onGps);
    GROUP.onChange(onGroupChange);

    $("welcomeGo").addEventListener("click", () => { $("welcome").hidden = true; enableSensors(); });
    $("welcomeSkip").addEventListener("click", () => {
      $("welcome").hidden = true;
      try { localStorage.setItem("parque:boasvindas", "1"); } catch (e) { /* ok */ }
    });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && state.route) requestWake();
    });
  }

  function toggleRotateMode() {
    if (state.rotateMode === "direcao") {
      state.rotateMode = "norte";
      MAP.flyTo({ x: MAP.view.cx, y: MAP.view.cy }, null, 0);
      toast("Mapa com o norte para cima");
    } else {
      GPS.enableCompass();
      state.rotateMode = "direcao";
      state.follow = true;
      toast("Mapa gira com você");
    }
    updateCompassButton(MAP.view);
  }

  // ---- início -------------------------------------------------------------

  function init() {
    renderChips();
    MAP.init($("map"));
    bind();
    let sensors = false, seen = false;
    try {
      sensors = localStorage.getItem("parque:sensores") === "1";
      seen = localStorage.getItem("parque:boasvindas") === "1";
    } catch (e) { /* sem armazenamento */ }
    if (sensors) {
      GPS.start();
      GPS.enableCompass(); // no Android liga direto; no iPhone pede no próximo toque
    } else if (!seen) $("welcome").hidden = false;

    if (GROUP.active) GROUP.start();
    updateGroupPill();
    if (/grupo=/.test(location.hash) && !GROUP.active) openPanel("grupo");
    // Convite aberto com o app já na tela: o navegador só troca o #, não recarrega.
    window.addEventListener("hashchange", () => {
      if (/grupo=/.test(location.hash) && !GROUP.active) openPanel("grupo");
    });

    if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    }
  }

  return { init, toast, gpsStatus };
})();

UI.init();
