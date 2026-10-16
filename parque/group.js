/*
 * group.js — grupo em tempo real: ver onde cada pessoa está e dividir pinos.
 *
 * Fala com o Supabase só por funções (RPC) que exigem o código do grupo;
 * as tabelas não são lidas direto (ver parque/supabase/001_grupo.sql).
 * Sem biblioteca: é fetch puro para /rest/v1/rpc/<função>.
 *
 * Ritmo: uma sincronização a cada SYNC_MS com a aba visível. Mudou de lugar
 * mais de 8 m? Manda antes. Aba escondida para de sincronizar (bateria).
 * Sem internet o app continua: o mapa e o GPS não dependem daqui.
 */
"use strict";

const GROUP = (() => {
  const SUPABASE_URL = "https://iowuejrpzoibyidiuvpt.supabase.co";
  // Chave pública (publishable): só permite chamar as funções liberadas para anon.
  const SUPABASE_KEY = "sb_publishable_RJisxh4p6IAXX_nPVtkMeQ__-QcfB8p";
  const SYNC_MS = 4000;
  const COLORS = ["#ff4d6d", "#2ec4ff", "#80ed99", "#ffd166", "#c77dff", "#ff9f1c", "#f15bb5", "#00f5d4"];
  const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let members = [];       // outras pessoas (sem eu)
  let pins = [];          // pinos compartilhados
  let timer = 0;
  let busy = false;
  let lastSent = null;
  let online = false;
  let lastOkAt = 0;
  let status = "";
  let seenPins = null;
  const listeners = [];

  const d = () => STORE.data;
  const active = () => !!d().group.code;

  async function rpc(fn, body) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      let msg = res.status + "";
      try { msg = (await res.json()).message || msg; } catch (e) { /* resposta sem JSON */ }
      throw new Error(msg);
    }
    return res.status === 204 ? null : res.json();
  }

  function newCode() {
    const bytes = crypto.getRandomValues(new Uint8Array(6));
    return [...bytes].map(b => CODE_CHARS[b % CODE_CHARS.length]).join("");
  }

  function myColor() {
    if (d().profile.color) return d().profile.color;
    const c = COLORS[Math.floor(Math.random() * COLORS.length)];
    d().profile.color = c;
    STORE.save();
    return c;
  }

  function join(code, name) {
    code = (code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (code.length < 6) throw new Error("O código do grupo tem 6 letras/números.");
    d().group.code = code;
    if (!d().group.memberId) d().group.memberId = STORE.uid("m");
    if (name) d().profile.name = name.trim().slice(0, 24);
    myColor();
    STORE.save();
    seenPins = null;
    start();
    return code;
  }

  function create(name) {
    return join(newCode(), name);
  }

  async function leave() {
    const { code, memberId } = d().group;
    stop();
    d().group.code = "";
    STORE.save();
    members = [];
    pins = [];
    emit();
    if (code && memberId) {
      try { await rpc("parque_sair", { p_group: code, p_member: memberId }); } catch (e) { /* sem rede: some sozinho em 3 h */ }
    }
  }

  async function sync() {
    if (!active() || busy) return;
    if (document.visibilityState === "hidden") return;
    busy = true;
    const me = GPS.current();
    try {
      const out = await rpc("parque_sync", {
        p_group: d().group.code,
        p_member: d().group.memberId,
        p_name: d().profile.name || "Sem nome",
        p_color: myColor(),
        p_lat: me ? me.lat : null,
        p_lon: me ? me.lon : null,
        p_acc: me ? Math.round(me.acc) : null,
        p_heading: me && me.heading != null ? Math.round(me.heading) : null,
        p_status: status
      });
      lastSent = me ? { x: me.x, y: me.y } : lastSent;
      const serverNow = new Date(out.now).getTime();
      members = (out.members || [])
        .filter(m => m.member_id !== d().group.memberId && m.lat != null)
        .map(m => Object.assign(m, { ageSec: Math.max(0, Math.round((serverNow - new Date(m.updated_at).getTime()) / 1000)) }));
      announceNewPins(out.pins || []);
      pins = out.pins || [];
      online = true;
      lastOkAt = Date.now();
    } catch (e) {
      online = false;
      if (/invalido/.test(e.message)) UI.toast("Código de grupo inválido");
    } finally {
      busy = false;
      emit();
    }
  }

  // Avisa quando alguém do grupo marca um pino novo (ex.: ponto de encontro).
  function announceNewPins(list) {
    if (seenPins) {
      for (const p of list) {
        const key = p.pin_id + p.updated_at;
        if (!seenPins.has(key) && p.by_name !== (d().profile.name || "Sem nome")) {
          UI.toast(`${p.by_name || "Alguém"} marcou: ${p.name}`);
          if (navigator.vibrate) navigator.vibrate([80, 60, 80]);
        }
      }
    }
    seenPins = new Set(list.map(p => p.pin_id + p.updated_at));
  }

  function start() {
    stop();
    if (!active()) return;
    sync();
    timer = setInterval(sync, SYNC_MS);
  }

  function stop() {
    clearInterval(timer);
    timer = 0;
  }

  // Chamado a cada leitura de GPS: andou bastante, manda logo.
  function onMove(me) {
    if (!active() || !me) return;
    if (!lastSent || GEO.dist(lastSent, me) > 8) sync();
  }

  async function sharePin(kind, name, x, y, id) {
    if (!active()) throw new Error("Entre num grupo primeiro.");
    const ll = GEO.toLatLon(x, y);
    await rpc("parque_pin_set", {
      p_group: d().group.code, p_pin: id || STORE.uid("gp"), p_kind: kind, p_name: name,
      p_lat: ll.lat, p_lon: ll.lon, p_by: d().profile.name || "Sem nome"
    });
    sync();
  }

  async function removePin(pinId) {
    await rpc("parque_pin_del", { p_group: d().group.code, p_pin: pinId });
    pins = pins.filter(p => p.pin_id !== pinId);
    emit();
    sync();
  }

  function setStatus(text) {
    status = (text || "").slice(0, 40);
    sync();
  }

  function placeList() {
    return pins.map(p => {
      const xy = GEO.toXY(p.lat, p.lon);
      return {
        id: "g-" + p.pin_id, name: p.name, cat: "grupo", x: xy.x, y: xy.y,
        info: [`Marcado por ${p.by_name || "alguém"}`], groupPin: p
      };
    });
  }

  function emit() {
    for (const fn of listeners) fn();
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && active()) sync();
  });

  function shareLink() {
    const url = new URL(location.href);
    url.hash = "grupo=" + d().group.code;
    return url.toString();
  }

  return {
    rpc, create, join, leave, start, sync, onMove, sharePin, removePin, setStatus, placeList, shareLink,
    onChange(fn) { listeners.push(fn); },
    get members() { return members; },
    get active() { return active(); },
    get code() { return d().group.code; },
    get online() { return online; },
    get lastOkAt() { return lastOkAt; },
    get status() { return status; },
    COLORS
  };
})();
