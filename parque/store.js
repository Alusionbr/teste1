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

const APP_VERSION = "1.1.0";

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
    deviceId: "",         // id anônimo do aparelho para a fila compartilhada
    showLabels: true
  });

  let data = empty();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) data = Object.assign(empty(), JSON.parse(raw));
  } catch (e) {
    console.warn("Não foi possível ler os dados salvos", e);
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {
      if (window.UI) UI.toast("Não consegui salvar no aparelho (armazenamento cheio?)");
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
    const shared = window.GROUP ? GROUP.placeList() : [];
    return PARK_DATA.pois.concat(mine, shared);
  }

  function placeById(id) {
    return places().find(p => p.id === id) || null;
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
    return JSON.stringify({ app: "mapa-do-parque", version: APP_VERSION, exportedAt: new Date().toISOString(), data }, null, 2);
  }

  function importJson(text) {
    const parsed = JSON.parse(text);
    const incoming = parsed.data || parsed;
    if (!incoming || typeof incoming !== "object" || !("pins" in incoming)) throw new Error("Arquivo não é um backup do Mapa do Parque");
    data = Object.assign(empty(), incoming);
    save();
  }

  function resetDay() {
    data.done = {};
    data.waits = {};
    save();
  }

  return {
    get data() { return data; },
    save, uid, deviceId, places, placeById, iconOf, setPin, removePin, toggle, setWait, setNote,
    exportJson, importJson, resetDay
  };
})();
