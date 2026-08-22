/*
 * routines.js — rotinas (as coisas que se repetem).
 *
 * Rotina não é tarefa: ela não entra na fila do "Agora" nem enche a lista.
 * Fica em um lugar só dela, com os últimos sete dias à vista.
 *
 * A sequência é de propósito tolerante: falhar um dia não zera nada. Contador
 * frágil transforma um tropeço em motivo para abandonar a rotina inteira —
 * o oposto do que a ferramenta deveria fazer. Só dois dias seguidos sem
 * cumprir encerram a contagem.
 */
(function () {
  'use strict';

  window.Agora = window.Agora || {};
  const C = () => Agora.core;

  const NOMES_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

  function normalizar(bruta) {
    if (!bruta || typeof bruta !== 'object') return null;
    const nome = String(bruta.nome || '').trim();
    if (!nome) return null;
    const dias = Array.isArray(bruta.dias)
      ? [...new Set(bruta.dias.map(Number).filter(d => d >= 0 && d <= 6))].sort()
      : [];
    return {
      id: String(bruta.id || C().uid('rot')),
      nome: nome.slice(0, 80),
      quando: bruta.quando === 'dias' && dias.length ? 'dias' : 'diaria',
      dias,
      minutos: Math.max(0, Math.round(Number(bruta.minutos) || 0)),
      feitos: Array.isArray(bruta.feitos) ? [...new Set(bruta.feitos.filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)))].sort() : [],
      criadoEm: bruta.criadoEm || C().agoraIso()
    };
  }

  function criar(nome, quando, dias, minutos) {
    const rotina = normalizar({ nome, quando, dias, minutos });
    if (!rotina) return null;
    C().estado.rotinas.push(rotina);
    return rotina;
  }

  function porId(id) {
    return C().estado.rotinas.find(r => r.id === id) || null;
  }

  function remover(id) {
    const i = C().estado.rotinas.findIndex(r => r.id === id);
    if (i >= 0) C().estado.rotinas.splice(i, 1);
  }

  function ehDoDia(rotina, dia) {
    if (rotina.quando === 'diaria') return true;
    const data = C().paraData(dia);
    return !!data && rotina.dias.includes(data.getDay());
  }

  function feitaNoDia(rotina, dia) {
    return rotina.feitos.includes(dia);
  }

  function alternar(rotina, dia) {
    const i = rotina.feitos.indexOf(dia);
    if (i >= 0) rotina.feitos.splice(i, 1);
    else rotina.feitos.push(dia);
    rotina.feitos.sort();
    // Guardar 400 dias basta para mostrar histórico e não deixa o dado crescer
    // para sempre no armazenamento do navegador.
    if (rotina.feitos.length > 400) rotina.feitos = rotina.feitos.slice(-400);
    return i < 0;
  }

  function deHoje() {
    const hoje = C().hojeISO();
    return C().estado.rotinas.filter(r => ehDoDia(r, hoje));
  }

  function feitasEm(dia) {
    return C().estado.rotinas.filter(r => feitaNoDia(r, dia));
  }

  function ultimosSete(rotina) {
    const dias = [];
    for (let i = 6; i >= 0; i--) {
      const dia = C().somaDias(C().hojeISO(), -i);
      dias.push({
        dia,
        curto: NOMES_CURTOS[(C().paraData(dia) || new Date()).getDay()],
        previsto: ehDoDia(rotina, dia),
        feito: feitaNoDia(rotina, dia)
      });
    }
    return dias;
  }

  // Conta os dias previstos cumpridos caminhando para trás. Hoje ainda em
  // aberto não conta contra; um dia perdido é perdoado; dois seguidos param.
  function sequencia(rotina) {
    const hoje = C().hojeISO();
    let conta = 0, falhasSeguidas = 0;
    for (let i = 0; i < 120; i++) {
      const dia = C().somaDias(hoje, -i);
      if (!ehDoDia(rotina, dia)) continue;
      if (feitaNoDia(rotina, dia)) { conta += 1; falhasSeguidas = 0; continue; }
      if (i === 0) continue;          // o dia de hoje ainda pode acontecer
      falhasSeguidas += 1;
      if (falhasSeguidas >= 2) break;
    }
    return conta;
  }

  Agora.rotinas = {
    NOMES_CURTOS, normalizar, criar, porId, remover,
    ehDoDia, feitaNoDia, alternar, deHoje, feitasEm, ultimosSete, sequencia
  };
})();
