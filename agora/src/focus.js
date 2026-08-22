/*
 * focus.js — o timer de foco.
 *
 * Três cuidados que o timer precisa ter para servir a quem dispersa:
 *
 * 1. O relógio é sempre calculado por diferença de horário (Date.now), nunca
 *    por soma de ticks. Aba escondida, celular bloqueado ou navegador
 *    engasgado não podem "roubar" minutos do contador.
 * 2. A sessão é gravada assim que começa. Fechar a aba no meio (acontece o
 *    tempo todo) não pode apagar o que já foi focado: ao reabrir, o app
 *    retoma o timer que ainda faz sentido e fecha o que ficou velho.
 * 3. O fim do foco não é um julgamento. As saídas são "terminei", "mais 5",
 *    "pausa" e "parar e anotar onde parei" — nenhuma delas cobra nada.
 */
(function () {
  'use strict';

  window.Agora = window.Agora || {};
  const C = () => Agora.core;
  const M = () => Agora.modelo;

  const MIN_SESSAO_MS = 30000;     // menos que isso não vira registro
  const LIMITE_ABANDONO_MS = 4 * 3600000; // 4h aberto = a pessoa foi embora

  function atual() {
    return C().estado.foco;
  }

  function ativo() {
    return !!atual();
  }

  function tarefaDoFoco() {
    const f = atual();
    return f ? M().porId(f.tarefaId) : null;
  }

  function iniciar(tarefaId, minutos, tipo) {
    const tarefa = tarefaId ? M().porId(tarefaId) : null;
    if (tarefaId && !tarefa) return null;
    if (tarefa && tarefa.status === 'entrada') M().organizar(tarefa);
    C().estado.foco = {
      tarefaId: tarefa ? tarefa.id : '',
      titulo: tarefa ? tarefa.titulo : 'Pausa',
      tipo: tipo === 'pausa' ? 'pausa' : 'foco',
      inicio: Date.now(),
      planejado: C().limitar(minutos, 1, 180),
      pausadoEm: 0,
      pausadoMs: 0,
      alarmado: false
    };
    C().salvar();
    return C().estado.foco;
  }

  function decorridoMs() {
    const f = atual();
    if (!f) return 0;
    const fim = f.pausadoEm || Date.now();
    return Math.max(0, fim - f.inicio - f.pausadoMs);
  }

  function restanteMs() {
    const f = atual();
    if (!f) return 0;
    return f.planejado * 60000 - decorridoMs();
  }

  function progresso() {
    const f = atual();
    if (!f) return 0;
    return C().limitar(decorridoMs() / (f.planejado * 60000), 0, 1);
  }

  function emPausa() {
    const f = atual();
    return !!(f && f.pausadoEm);
  }

  function pausar() {
    const f = atual();
    if (!f || f.pausadoEm) return;
    f.pausadoEm = Date.now();
    C().salvar();
  }

  function retomar() {
    const f = atual();
    if (!f || !f.pausadoEm) return;
    f.pausadoMs += Date.now() - f.pausadoEm;
    f.pausadoEm = 0;
    C().salvar();
  }

  function esticar(minutos) {
    const f = atual();
    if (!f) return;
    f.planejado = C().limitar(f.planejado + (Number(minutos) || 5), 1, 240);
    f.alarmado = false;
    C().salvar();
  }

  // Encerra e devolve quantos minutos foram registrados (0 se foi curto
  // demais ou se era pausa).
  function encerrar() {
    const f = atual();
    if (!f) return 0;
    const gastoMs = decorridoMs();
    let minutos = 0;

    if (f.tipo === 'foco' && gastoMs >= MIN_SESSAO_MS) {
      minutos = Math.max(1, Math.round(gastoMs / 60000));
      C().estado.sessoes.push({
        id: C().uid('ses'),
        tarefaId: f.tarefaId,
        titulo: f.titulo,
        inicio: f.inicio,
        fim: Date.now(),
        minutos,
        planejado: f.planejado
      });
      const tarefa = f.tarefaId ? M().porId(f.tarefaId) : null;
      if (tarefa) { tarefa.gasto += minutos; M().tocar(tarefa); }
    }

    C().estado.foco = null;
    C().salvar();
    return minutos;
  }

  // Chamado a cada tick pela tela. Devolve true uma única vez, quando o tempo
  // planejado acaba — é o gatilho do som e do aviso.
  function verificarFim() {
    const f = atual();
    if (!f || f.alarmado || f.pausadoEm) return false;
    if (restanteMs() > 0) return false;
    f.alarmado = true;
    C().salvarLogo();
    avisar(f);
    return true;
  }

  /* ---------- avisos ---------- */

  let audio = null;

  // Som curto gerado na hora: sem arquivo de áudio, o app continua offline e
  // leve. Criado só depois de um gesto do usuário (começar o foco é um).
  function bipe() {
    if (!C().estado.prefs.som) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!audio) audio = new Ctx();
      if (audio.state === 'suspended') audio.resume();
      [0, 0.28, 0.56].forEach((atraso, i) => {
        const osc = audio.createOscillator();
        const vol = audio.createGain();
        osc.type = 'sine';
        osc.frequency.value = i === 2 ? 660 : 528;
        vol.gain.setValueAtTime(0.0001, audio.currentTime + atraso);
        vol.gain.exponentialRampToValueAtTime(0.16, audio.currentTime + atraso + 0.02);
        vol.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + atraso + 0.22);
        osc.connect(vol).connect(audio.destination);
        osc.start(audio.currentTime + atraso);
        osc.stop(audio.currentTime + atraso + 0.24);
      });
    } catch (e) { /* som é enfeite: falhar aqui não pode derrubar o timer */ }
  }

  function avisar(f) {
    bipe();
    if (navigator.vibrate && C().estado.prefs.som) {
      try { navigator.vibrate([120, 80, 120]); } catch (e) { /* ignora */ }
    }
    if (C().estado.prefs.avisos && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(f.tipo === 'pausa' ? 'Pausa terminada' : 'Tempo cumprido', {
          body: f.tipo === 'pausa' ? 'Dá para voltar.' : `${f.titulo} — ${f.planejado} min de foco.`,
          icon: './icon-192.png',
          tag: 'agora-foco'
        });
      } catch (e) { /* ignora */ }
    }
  }

  async function pedirPermissao() {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    try { return (await Notification.requestPermission()) === 'granted'; } catch (e) { return false; }
  }

  /* ---------- recuperação ao abrir o app ---------- */

  // Uma sessão pode ter ficado aberta por dias (aba fechada, celular
  // desligado). O que passou do limite é encerrado com o tempo planejado,
  // não com o tempo de parede: ninguém focou 14 horas seguidas.
  function recuperarAoAbrir() {
    const f = atual();
    if (!f) return null;
    const parado = Date.now() - f.inicio;
    if (parado <= LIMITE_ABANDONO_MS) return null;
    const minutos = f.tipo === 'foco' ? Math.min(f.planejado, Math.round(parado / 60000)) : 0;
    if (minutos > 0) {
      C().estado.sessoes.push({
        id: C().uid('ses'),
        tarefaId: f.tarefaId,
        titulo: f.titulo,
        inicio: f.inicio,
        fim: f.inicio + minutos * 60000,
        minutos,
        planejado: f.planejado
      });
      const tarefa = f.tarefaId ? M().porId(f.tarefaId) : null;
      if (tarefa) { tarefa.gasto += minutos; M().tocar(tarefa); }
    }
    C().estado.foco = null;
    C().salvar();
    return { titulo: f.titulo, minutos };
  }

  Agora.foco = {
    atual, ativo, tarefaDoFoco, iniciar, decorridoMs, restanteMs, progresso,
    emPausa, pausar, retomar, esticar, encerrar, verificarFim,
    bipe, pedirPermissao, recuperarAoAbrir
  };
})();
