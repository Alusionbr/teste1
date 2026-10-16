/*
 * trilhas.js — "caminhos aprendidos": o mapa aprende por onde dá para andar.
 *
 * O OpenStreetMap quase não tem os caminhos de dentro do parque, então a rota
 * caía em linha reta. Aqui cada aparelho grava, anonimamente, o trajeto que
 * percorre a pé e manda para o servidor; todo mundo baixa os trechos e o
 * route.js passa a seguir por eles.
 *
 * Só grava ponto bom: precisão ≤ PRECISAO_M, dentro do parque, velocidade
 * de gente andando (nada de carro no estacionamento), e no mínimo PASSO_M do
 * ponto anterior. Parado, salto grande ou pausa longa fecham o trecho.
 * Sem internet, os trechos ficam numa fila no aparelho e sobem depois.
 *
 * Desliga em Ajustes → "Ajudar a mapear caminhos". O id enviado é o mesmo
 * id anônimo da fila (STORE.deviceId), sem nome nem grupo.
 */
"use strict";

const TRILHAS = (() => {
  const PRECISAO_M = 20;
  const PASSO_M = 8;
  const SALTO_M = 40;
  const PAUSA_MS = 60000;
  const VEL_MAX = 3.2;              // m/s — correndo ainda passa; carro não
  const ENVIAR_A_CADA = 25;         // pontos
  const ENVIAR_MS = 90000;
  const BAIXAR_MS = 5 * 60000;
  const FILA_KEY = "parque:trilhas-fila";
  const CACHE_KEY = "parque:trilhas-cache-v1";

  let atual = [];                   // trecho em gravação: [{x, y, lat, lon, t}]
  let ultimoEnvio = Date.now();
  let baixadas = (() => { try { const c = JSON.parse(localStorage.getItem(CACHE_KEY) || "null"); return c && Array.isArray(c.items) ? c.items.map(pts => pts.map(([lat, lon]) => GEO.toXY(lat, lon))) : []; } catch (e) { return []; } })();
  let timer = 0;
  let enviando = false;
  let envioCtl = null;
  const listeners = [];

  const ligado = () => STORE.data.mapearConsentiu === true && STORE.data.mapearCaminhos === true;

  function lerFila() {
    try { return JSON.parse(localStorage.getItem(FILA_KEY) || "[]"); } catch (e) { return []; }
  }

  function gravarFila(fila) {
    try { localStorage.setItem(FILA_KEY, JSON.stringify(fila.slice(-200))); } catch (e) { /* cheio: perde o mais antigo */ }
  }

  // Fecha o trecho atual e põe na fila de envio.
  function fechar() {
    if (!ligado()) { atual = []; return; }
    if (atual.length >= 2) {
      const fila = lerFila();
      fila.push({ id: STORE.uid("tr"), pts: atual.map(p => [+p.lat.toFixed(6), +p.lon.toFixed(6)]) });
      gravarFila(fila);
    }
    // O último ponto continua como começo do próximo trecho (sem buraco).
    atual = atual.length ? [atual[atual.length - 1]] : [];
  }

  function onGps(me) {
    if (!ligado() || !me || me.manual) return;
    if (me.acc > PRECISAO_M || !GEO.insidePark(me)) return;
    const agora = Date.now();
    const ult = atual[atual.length - 1];
    if (ult) {
      const d = GEO.dist(ult, me);
      const dt = (agora - ult.t) / 1000;
      if (d < PASSO_M) return;
      if (agora - ult.t > PAUSA_MS || d > SALTO_M || d / Math.max(dt, 1) > VEL_MAX) {
        fechar();
        atual = [];
      }
    }
    atual.push({ x: me.x, y: me.y, lat: me.lat, lon: me.lon, t: agora });
    if (atual.length >= ENVIAR_A_CADA || (atual.length >= 3 && agora - ultimoEnvio > ENVIAR_MS)) {
      fechar();
      enviar();
    }
  }

  async function enviar() {
    if (!ligado() || enviando) return;
    enviando = true;
    envioCtl = new AbortController();
    ultimoEnvio = Date.now();
    try {
    for (;;) {
      const fila = lerFila();
      if (!fila.length || !ligado()) break;
      const item = Array.isArray(fila[0]) ? { id: STORE.uid("tr"), pts: fila[0] } : fila[0];
      try {
        await GROUP.rpc("parque_trilha_add", { p_device: STORE.deviceId(), p_pts: item.pts, p_client_id: item.id }, { signal: envioCtl.signal });
        if (!ligado()) break;
        const atualFila = lerFila();
        const idx = Array.isArray(fila[0]) ? 0 : atualFila.findIndex(x => !Array.isArray(x) && x.id === item.id);
        if (idx >= 0) { atualFila.splice(idx, 1); gravarFila(atualFila); }
      } catch (e) {
        if (/invalid|inval|fora|limite/i.test(e.message)) { const f = lerFila(); f.shift(); gravarFila(f); continue; }
        break;
      }
    }
    await baixar();
    } finally { enviando = false; envioCtl = null; }
  }

  async function baixar() {
    try {
      const lista = (await GROUP.rpc("parque_trilhas", {})) || [];
      baixadas = lista.map(pts => pts.map(([lat, lon]) => GEO.toXY(lat, lon)));
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), items: lista.slice(-5000) })); } catch (e) { /* cache opcional */ }
      atualizar();
    } catch (e) {
      // Sem internet: segue com o que já tinha.
    }
  }

  // Trechos para rota e desenho: servidor + o que ainda não subiu daqui.
  function todas() {
    const locais = lerFila().map(item => (Array.isArray(item) ? item : item.pts).map(([lat, lon]) => GEO.toXY(lat, lon)));
    const emCurso = atual.length >= 2 ? [atual.map(p => ({ x: p.x, y: p.y }))] : [];
    return baixadas.concat(locais, emCurso);
  }

  function atualizar() {
    const t = todas();
    ROUTE.setTrilhas(t);
    for (const fn of listeners) fn(t);
  }

  function start() {
    clearInterval(timer);
    baixar();
    timer = setInterval(() => { if (document.visibilityState === "visible") baixar(); }, BAIXAR_MS);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden" && ligado()) { fechar(); enviar(); }
    });
  }

  function setEnabled(on, discard) {
    STORE.data.mapearCaminhos = !!on;
    if (on) STORE.data.mapearConsentiu = true;
    if (!on) { atual = []; if (envioCtl) envioCtl.abort(); if (discard) gravarFila([]); }
    STORE.save();
    if (on) enviar();
    atualizar();
  }

  return {
    start, onGps, enviar, atualizar, todas, setEnabled,
    onChange(fn) { listeners.push(fn); },
    get pendentes() { return lerFila().length; },
    get trechos() { return baixadas.length; }
  };
})();
