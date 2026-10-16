/*
 * show.js — "Hora do Show": aproveitar os shows grandes para pegar os
 * brinquedos mais disputados com fila menor.
 *
 * A ideia (dica comum de quem frequenta o parque): durante o Hot Wheels Epic
 * Show (arena de 3 mil lugares) e os outros shows grandes, muita gente sai
 * das filas. É estratégia, não garantia — por isso a tela mostra a fila ao
 * vivo informada pelos visitantes quando existe.
 *
 * Horários vêm de oficial.js. A duração de cada show é estimativa
 * (DURACAO_SHOW_MIN): o parque não publica.
 *
 * Plano: atrações "disputado" ainda não visitadas, com posição conhecida,
 * que a altura cadastrada permite e que não são pagas à parte. Ordem pelo
 * vizinho mais próximo a partir de onde você está (rápido e bom o bastante
 * para até ~10 pontos).
 */
"use strict";

const SHOW = (() => {
  const AVISO_ANTES_MIN = 15;

  function hoje(hhmm) {
    const [h, m] = hhmm.split(":").map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  }

  // Todas as sessões do dia, em ordem.
  function sessoes() {
    const out = [];
    for (const o of OFICIAL) {
      for (const hm of o.horarios || []) {
        const inicio = hoje(hm);
        out.push({ show: o, hm, inicio, fim: new Date(inicio.getTime() + DURACAO_SHOW_MIN * 60000) });
      }
    }
    return out.sort((a, b) => a.inicio - b.inicio);
  }

  // Show grande acontecendo agora (ou começando em até 10 min).
  function janelaAgora(now) {
    now = now || new Date();
    return sessoes().find(s => s.show.grande && now >= s.inicio - 10 * 60000 && now <= s.fim) || null;
  }

  function proximoGrande(now) {
    now = now || new Date();
    return sessoes().find(s => s.show.grande && s.inicio > now) || null;
  }

  function cabe(o) {
    const h = STORE.data.alturaCm;
    return !h || !o.altura || h >= Math.round(o.altura * 100);
  }

  // Lugares candidatos: disputados, com posição, não visitados, permitidos.
  function candidatos() {
    const d = STORE.data;
    return LUGARES.oficiais().filter(p => p.oficial.disputado && p.x != null && !d.done[p.id] && !p.oficial.pago && cabe(p.oficial));
  }

  function plano(me, limite) {
    const restantes = candidatos();
    const ordem = [];
    let atual = me;
    let minutos = 0;
    while (restantes.length && ordem.length < (limite || 8)) {
      let best = 0;
      if (atual) {
        let bestD = Infinity;
        restantes.forEach((p, i) => {
          const dd = GEO.dist(atual, p);
          if (dd < bestD) { bestD = dd; best = i; }
        });
      }
      const p = restantes.splice(best, 1)[0];
      const andar = atual ? GEO.walkMinutes(GEO.dist(atual, p)) : 0;
      minutos += andar;
      ordem.push({ place: p, andar, chegadaMin: minutos });
      atual = p;
    }
    return ordem;
  }

  function minutosAte(d) {
    return Math.round((d - Date.now()) / 60000);
  }

  return { sessoes, janelaAgora, proximoGrande, plano, candidatos, cabe, minutosAte, AVISO_ANTES_MIN };
})();
