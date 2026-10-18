/*
 * filas.js — fila ao vivo, compartilhada entre todo mundo que usa o app.
 *
 * Cada aparelho manda o tempo de fila que está vendo (um relato por
 * atração por aparelho; mandar de novo substitui). O servidor devolve a
 * mediana dos relatos da última hora — a mediana ignora o engraçadinho
 * que digita 300 min. Não vai posição, nome nem grupo: só lugar e minutos.
 *
 * Só lugares do OpenStreetMap (id "osm-…") entram: são os mesmos em todos
 * os aparelhos. Lugares marcados à mão ficam só com a anotação local.
 */
"use strict";

const FILAS = (() => {
  const POLL_MS = 60000;
  const LOCAL_MAX_AGE = 3 * 3600e3;
  let crowd = {};          // place_id -> {minutes, reports, lastAt}
  let timer = 0;
  const listeners = [];

  const shareable = id => /^(osm|of)-/.test(id);

  async function refresh() {
    if (document.visibilityState === "hidden") return;
    try {
      const list = await GROUP.rpc("parque_filas", {});
      const next = {};
      for (const f of list || []) next[f.place_id] = { minutes: f.minutes, reports: f.reports, lastAt: new Date(f.last_at).getTime() };
      crowd = next;
      for (const fn of listeners) fn();
    } catch (e) {
      // Sem internet: segue com o último resultado e com as anotações locais.
    }
  }

  async function report(id, minutes) {
    STORE.setWait(id, minutes);
    if (minutes == null || !shareable(id)) return false;
    try {
      await GROUP.rpc("parque_fila_set", { p_place: id, p_member: STORE.deviceId(), p_minutes: minutes });
      refresh();
      return true;
    } catch (e) {
      return false;
    }
  }

  // O que mostrar para um lugar: a fila do parque (mediana) quando existe;
  // senão, a anotação do próprio aparelho se for recente.
  function info(id) {
    const c = crowd[id];
    if (c) return { min: c.minutes, reports: c.reports, at: c.lastAt, shared: true };
    const w = STORE.data.waits[id];
    if (w && Date.now() - w.at < LOCAL_MAX_AGE) return { min: w.min, reports: 1, at: w.at, shared: false };
    return null;
  }

  function start() {
    clearInterval(timer);
    refresh();
    timer = setInterval(refresh, POLL_MS);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") refresh();
    });
  }

  return {
    start, refresh, report, info, shareable,
    onChange(fn) { listeners.push(fn); }
  };
})();
