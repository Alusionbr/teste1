/*
 * store.js — estado do app e o que fica salvo no aparelho.
 *
 * Tudo que o usuário marca (favoritos, "já fui", fila anotada, lugares
 * criados, carro, ponto de encontro, nome e grupo) vai para localStorage
 * na chave KEY. Posição GPS e estado do mapa não são salvos.
 *
 * APP_VERSION precisa andar junto com VERSION em sw.js e o ?v= do index.html.
 */
"use strict";

const APP_VERSION = "1.5.1";

const CATEGORIES = {
  montanha:       { label: "Montanhas-russas", icon: "🎢", color: "#ff4d6d" },
  atracao:        { label: "Atrações",         icon: "🎡", color: "#ff9f1c" },
  aquatico:       { label: "Aquáticos",        icon: "💦", color: "#2ec4ff" },
  infantil:       { label: "Infantil",         icon: "🧸", color: "#c77dff" },
  show:           { label: "Shows e cinemas",  icon: "🎭", color: "#ffd166" },
  animais:        { label: "Animais",          icon: "🦁", color: "#80ed99" },
  comida:         { label: "Comida",           icon: "🍔", color: "#f4845f" },
  banheiro:       { label: "Banheiros",        icon: "🚻", color: "#a0c4ff" },
  mirante:        { label: "Mirantes",         icon: "🔭", color: "#9bf6ff" },
  estacionamento: { label: "Estacionamento",   icon: "🅿️", color: "#bdb2ff" },
  servico:        { label: "Serviços",         icon: "🎟️", color: "#caffbf" },
  foto:           { label: "Fotos e cenários", icon: "📸", color: "#f9c74f" },
  bebedouro:      { label: "Bebedouros",       icon: "🚰", color: "#4cc9f0" },
  lixeira:        { label: "Lixeiras",         icon: "🗑️", color: "#adb5bd" },
  loja:           { label: "Lojas",            icon: "🛍️", color: "#f72585" },
  socorro:        { label: "Primeiros socorros", icon: "⛑️", color: "#ef233c" },
  fraldario:      { label: "Fraldário",        icon: "🚼", color: "#cdb4db" },
  guarda:         { label: "Guarda-volumes",   icon: "🧳", color: "#b08968" },
  carregador:     { label: "Carregar celular", icon: "🔌", color: "#90be6d" },
  descanso:       { label: "Sombra / descanso", icon: "🪑", color: "#84a98c" },
  info:           { label: "Informações",      icon: "ℹ️", color: "#8ecae6" },
  saida:          { label: "Entrada / saída",  icon: "🚪", color: "#e9c46a" },
  meu:            { label: "Meus lugares",     icon: "📍", color: "#ff70a6" },
  grupo:          { label: "Do grupo",         icon: "🚩", color: "#ffbe0b" }
};

const PIN_KINDS = {
  carro:    { label: "Meu carro",          icon: "🚗" },
  encontro: { label: "Ponto de encontro",  icon: "🚩" },
  lugar:    { label: "Lugar marcado",      icon: "📍" }
};

const STORE = (() => {
  const KEY = "parque:v1";
  const empty = () => ({
    favorites: {},        // id -> true
    done: {},             // id -> timestamp da visita
    waits: {},            // id -> {min, at}
    notes: {},            // id -> texto
    pins: [],             // {id, kind, name, x, y, at}
    hidden: {},           // categoria -> true (filtro do mapa)
    profile: { name: "", color: "" },
    group: { code: "", memberId: "" },
    deviceId: "",         // id anônimo do aparelho (fila e marcações da comunidade)
    crowdIds: [],         // ids das marcações de comunidade feitas neste aparelho
    alturaCm: 0,          // altura da pessoa mais baixa do grupo (0 = não filtrar)
    mapearCaminhos: false, // contribuição opcional; GPS local funciona sem envio
    mapearConsentiu: false,
    almocoHm: "11:30",    // horário do almoço (aviso 15 min antes)
    almocouEm: "",        // data (AAAA-MM-DD) em que marcou "já almocei"
    camadas: { caminhos: true, aprendidos: true, servicos: true, ruas: true }, // o que desenhar no mapa
    showLabels: true,
    activePlan: null,
    planHistory: [],
    showChoices: {}
  });

  let data = empty();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) data = Object.assign(empty(), JSON.parse(raw));
    if (!data.mapearConsentiu) data.mapearCaminhos = false;
  } catch (e) {
    console.warn("Não foi possível ler os dados salvos", e);
  }

  // v1.2: atrações oficiais ganharam id próprio ("of-…"). Favoritos, visitas,
  // filas e notas marcados no id antigo do OSM passam para o id novo.
  function migrarIdsOficiais() {
    let mudou = false;
    for (const o of OFICIAL) {
      for (const old of o.osm || []) {
        for (const field of ["favorites", "done", "waits", "notes"]) {
          if (data[field][old] != null) {
            if (data[field][o.id] == null) data[field][o.id] = data[field][old];
            delete data[field][old];
            mudou = true;
          }
        }
      }
    }
    if (mudou) save();
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {
      if (typeof UI !== "undefined") UI.toast("Não consegui salvar no aparelho (armazenamento cheio?)");
    }
  }

  function uid(prefix) {
    return prefix + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  // Lugares do OSM + lugares que o usuário criou, no mesmo formato.
  function places() {
    const mine = data.pins.map(p => ({
      id: p.id, name: p.name, cat: "meu", x: p.x, y: p.y, info: [PIN_KINDS[p.kind]?.label || "Lugar marcado"],
      pin: p
    }));
    const shared = typeof GROUP !== "undefined" ? GROUP.placeList() : [];
    return LUGARES.todos().concat(mine, shared);
  }

  function placeById(id) {
    return places().find(p => p.id === id) || null;
  }

  // Só o que tem posição vai para o mapa e para as rotas.
  function placesNoMapa() {
    return places().filter(p => p.x != null);
  }

  function iconOf(place) {
    if (place.pin) return PIN_KINDS[place.pin.kind]?.icon || "📍";
    return CATEGORIES[place.cat]?.icon || "📍";
  }

  // Carro e ponto de encontro são únicos: marcar de novo move o mesmo pino.
  function setPin(kind, name, x, y) {
    let pin = (kind === "carro" || kind === "encontro") ? data.pins.find(p => p.kind === kind) : null;
    if (!pin) {
      pin = { id: uid("pin"), kind };
      data.pins.push(pin);
    }
    Object.assign(pin, { name: name || PIN_KINDS[kind].label, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, at: Date.now() });
    save();
    return pin;
  }

  function removePin(id) {
    data.pins = data.pins.filter(p => p.id !== id);
    save();
  }

  function toggle(field, id) {
    if (data[field][id]) delete data[field][id];
    else data[field][id] = field === "done" ? Date.now() : true;
    save();
    return !!data[field][id];
  }

  function deviceId() {
    if (!data.deviceId) { data.deviceId = uid("d"); save(); }
    return data.deviceId;
  }

  function setWait(id, min) {
    if (min == null || isNaN(min)) delete data.waits[id];
    else data.waits[id] = { min: Math.max(0, Math.round(min)), at: Date.now() };
    save();
  }

  function setNote(id, text) {
    if (text) data.notes[id] = text.slice(0, 280);
    else delete data.notes[id];
    save();
  }

  function exportJson() {
    const safe = Object.assign({}, data, { group: { code: "", memberId: "" }, deviceId: "" });
    return JSON.stringify({ app: "mapa-do-parque", version: APP_VERSION, exportedAt: new Date().toISOString(), data: safe }, null, 2);
  }

  function importJson(text) {
    if (typeof text !== "string" || text.length > 2e6) throw new Error("Backup grande demais");
    const parsed = JSON.parse(text);
    const incoming = parsed.data || parsed;
    if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) throw new Error("Arquivo não é um backup do Mapa do Parque");
    const allowed = new Set(Object.keys(empty()));
    if (Object.keys(incoming).some(k => !allowed.has(k))) throw new Error("Backup contém campos desconhecidos");
    const maps = ["favorites", "done", "waits", "notes", "hidden"];
    if (!Array.isArray(incoming.pins) || incoming.pins.length > 500 || maps.some(k => incoming[k] != null && (typeof incoming[k] !== "object" || Array.isArray(incoming[k])))) throw new Error("Estrutura do backup inválida");
    for (const pin of incoming.pins) {
      if (!pin || typeof pin !== "object" || !Number.isFinite(pin.x) || !Number.isFinite(pin.y) || typeof pin.id !== "string") throw new Error("Pino inválido no backup");
    }
    const identity = {
      deviceId: data.deviceId,
      group: data.group,
      mapearCaminhos: data.mapearConsentiu === true && data.mapearCaminhos === true,
      mapearConsentiu: data.mapearConsentiu === true
    };
    if (incoming.activePlan != null && (typeof incoming.activePlan !== "object" || Array.isArray(incoming.activePlan))) throw new Error("Roteiro inválido no backup");
    if (incoming.planHistory != null && (!Array.isArray(incoming.planHistory) || incoming.planHistory.length > 100)) throw new Error("Histórico de roteiro inválido");
    if (incoming.showChoices != null && (typeof incoming.showChoices !== "object" || Array.isArray(incoming.showChoices) || Object.keys(incoming.showChoices).length > 100)) throw new Error("Escolhas de shows inválidas");
    const next = Object.assign(empty(), incoming, identity);
    // Roteiro/histórico são estado transitório deste aparelho; escolhas só aceitam chaves de sessão datadas.
    next.activePlan = null;
    next.planHistory = [];
    next.showChoices = Object.fromEntries(Object.entries(incoming.showChoices || {}).filter(([k, v]) => /^\d{4}-\d{2}-\d{2}\|of-[a-z0-9-]+@\d{2}:\d{2}$/.test(k) && v === true));
    next.pins = incoming.pins.map(p => ({ id: p.id.slice(0, 80), kind: String(p.kind || "lugar").slice(0, 20), name: String(p.name || "Lugar marcado").slice(0, 80), x: p.x, y: p.y, at: Number.isFinite(p.at) ? p.at : Date.now() }));
    data = next;
    save();
  }

  function resetDay() {
    data.done = {};
    data.waits = {};
    data.almocouEm = "";
    save();
  }

  function finishActivePlan() {
    const previous = data.activePlan || {};
    data.activePlan = Object.assign({}, previous, { ids: [], steps: [], paused: false, completed: true, day: new Date().toLocaleDateString("sv-SE"), updatedAt: Date.now() });
    save();
  }

  function recordPlanAdvance(id, action, remainingIds) {
    const h = data.planHistory || (data.planHistory = []);
    h.push({ id, action, at: Date.now() });
    data.planHistory = h.slice(-10);
    if (!remainingIds.length) return finishActivePlan();
    const previous = data.activePlan || {};
    data.activePlan = Object.assign({}, previous, { ids: remainingIds.slice(), steps: (previous.steps || []).filter(s => remainingIds.includes(s.id)), completed: false, updatedAt: Date.now() });
    save();
  }

  function undoPlanAdvance() {
    const h = data.planHistory || [];
    const last = h.pop();
    if (!last) return null;
    if (last.action === "concluido") delete data.done[last.id];
    const previous = data.activePlan || {};
    const ids = [last.id].concat(previous.ids || []);
    data.planHistory = h;
    data.activePlan = Object.assign({}, previous, { ids, steps: [{ id: last.id, tipo: "parada", status: "pendente" }].concat(previous.steps || []), completed: false, day: new Date().toLocaleDateString("sv-SE"), updatedAt: Date.now() });
    save();
    return ids;
  }

  function expireActivePlan(today) {
    if (!data.activePlan || data.activePlan.day === today) return false;
    data.activePlan = null;
    data.planHistory = [];
    save();
    return true;
  }

  return {
    get data() { return data; },
    save, uid, deviceId, places, placesNoMapa, migrarIdsOficiais, placeById, iconOf, setPin, removePin, toggle, setWait, setNote,
    exportJson, importJson, resetDay, finishActivePlan, recordPlanAdvance, undoPlanAdvance, expireActivePlan
  };
})();
