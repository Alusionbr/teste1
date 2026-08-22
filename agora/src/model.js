/*
 * model.js — o que é uma tarefa, como ela nasce e como ela muda.
 *
 * Duas decisões de projeto moram aqui:
 *
 * 1. Captura nunca exige formulário. Você escreve uma frase e pronto. O que
 *    der para adivinhar da própria frase (área, tempo, energia, dia) é lido
 *    por `interpretar()`; o resto fica em branco e pode ficar em branco para
 *    sempre — tarefa sem estimativa continua aparecendo na tela Agora.
 *
 * 2. Nada é apagado por engano nem cobra o usuário. "Soltar" é um estado
 *    próprio: a tarefa sai da frente sem virar dívida e pode voltar depois.
 */
(function () {
  'use strict';

  window.Agora = window.Agora || {};
  const C = () => Agora.core;

  const ENERGIAS = ['baixa', 'media', 'alta'];
  const PESO_ENERGIA = { baixa: 1, media: 2, alta: 3 };
  const ROTULO_ENERGIA = { baixa: 'energia baixa', media: 'energia média', alta: 'energia alta' };
  const TEMPOS = [5, 15, 30, 60, 120];
  const STATUS = ['entrada', 'ativa', 'feita', 'solta'];

  const DIAS_SEMANA = {
    domingo: 0, dom: 0, segunda: 1, seg: 1, terca: 2, terça: 2, ter: 2,
    quarta: 3, qua: 3, quinta: 4, qui: 4, sexta: 5, sex: 5, sabado: 6, sábado: 6, sab: 6
  };

  /* ---------- leitura da frase capturada ---------- */

  // Lê "pagar boleto 20m #casa hoje" e devolve os campos separados do título.
  // Cada pedaço reconhecido sai do texto; o que sobra é o título.
  function interpretar(textoOriginal) {
    let texto = ` ${String(textoOriginal || '').trim()} `;
    const achado = { projeto: '', minutos: 0, energia: '', dia: '', prazo: '' };

    texto = texto.replace(/(^|\s)#([\p{L}\p{N}_-]{1,24})(?=\s)/gu, (todo, antes, nome) => {
      if (!achado.projeto) achado.projeto = nome.toLowerCase();
      return antes;
    });

    texto = texto.replace(/(^|\s)@(baixa|media|média|alta)(?=\s)/giu, (todo, antes, nivel) => {
      const n = nivel.toLowerCase().replace('é', 'e');
      if (!achado.energia) achado.energia = n;
      return antes;
    });

    texto = texto.replace(/(^|\s)(\d{1,3})\s?(?:m|min|mins|minutos?)(?=\s)/gi, (todo, antes, n) => {
      if (!achado.minutos) achado.minutos = C().limitar(Number(n), 1, 600);
      return antes;
    });

    texto = texto.replace(/(^|\s)(\d{1,2}(?:[.,]\d)?)\s?(?:h|hs|horas?)(?=\s)/gi, (todo, antes, n) => {
      if (!achado.minutos) achado.minutos = C().limitar(Math.round(Number(String(n).replace(',', '.')) * 60), 1, 600);
      return antes;
    });

    texto = texto.replace(/(^|\s)(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?=\s)/g, (todo, antes, dia, mes, ano) => {
      if (achado.prazo) return antes;
      const hoje = new Date();
      let anoCheio = ano ? Number(ano.length === 2 ? `20${ano}` : ano) : hoje.getFullYear();
      const data = new Date(anoCheio, Number(mes) - 1, Number(dia), 12, 0, 0);
      if (Number.isNaN(data.getTime())) return todo;
      // Sem ano escrito e data já passada: a pessoa quis dizer o ano que vem.
      if (!ano && C().diasEntre(C().hojeISO(), C().diaISO(data)) < -1) data.setFullYear(anoCheio + 1);
      achado.prazo = C().diaISO(data);
      return antes;
    });

    texto = texto.replace(/(^|\s)(hoje|amanha|amanhã|depois de amanhã|depois de amanha)(?=\s)/gi, (todo, antes, quando) => {
      const q = quando.toLowerCase();
      if (!achado.dia) achado.dia = q === 'hoje' ? C().hojeISO() : C().somaDias(C().hojeISO(), q.startsWith('depois') ? 2 : 1);
      return antes;
    });

    texto = texto.replace(/(^|\s)(?:na |no |)(domingo|segunda|terça|terca|quarta|quinta|sexta|sábado|sabado)(?:-feira)?(?=\s)/gi, (todo, antes, nome) => {
      if (achado.dia) return todo;
      const alvo = DIAS_SEMANA[nome.toLowerCase()];
      if (alvo == null) return todo;
      const hoje = new Date();
      let passos = (alvo - hoje.getDay() + 7) % 7;
      if (passos === 0) passos = 7; // "sexta" dito na sexta é a próxima sexta
      achado.dia = C().somaDias(C().hojeISO(), passos);
      return antes;
    });

    const titulo = texto.replace(/\s+/g, ' ').trim();
    return { titulo, ...achado };
  }

  /* ---------- criação e normalização ---------- */

  function novaTarefa(textoOriginal) {
    const lido = interpretar(textoOriginal);
    const agora = C().agoraIso();
    // Quem já escreveu tempo e energia na frase não precisa passar pela
    // triagem de novo: a tarefa nasce pronta para ser escolhida.
    const completa = !!(lido.minutos && lido.energia);
    return normalizarTarefa({
      id: C().uid('tar'),
      titulo: lido.titulo || String(textoOriginal || '').trim(),
      projeto: lido.projeto,
      minutos: lido.minutos,
      energia: lido.energia,
      dia: lido.dia,
      prazo: lido.prazo,
      status: completa ? 'ativa' : 'entrada',
      criadoEm: agora,
      atualizadoEm: agora
    });
  }

  function normalizarTarefa(bruta) {
    if (!bruta || typeof bruta !== 'object') return null;
    const titulo = String(bruta.titulo || '').trim();
    if (!titulo) return null;
    const agora = C().agoraIso();
    return {
      id: String(bruta.id || C().uid('tar')),
      titulo: titulo.slice(0, 200),
      notas: String(bruta.notas || ''),
      projeto: String(bruta.projeto || '').trim().toLowerCase().slice(0, 24),
      energia: ENERGIAS.includes(bruta.energia) ? bruta.energia : '',
      minutos: Math.max(0, Math.round(Number(bruta.minutos) || 0)),
      dia: /^\d{4}-\d{2}-\d{2}$/.test(bruta.dia || '') ? bruta.dia : '',
      prazo: /^\d{4}-\d{2}-\d{2}$/.test(bruta.prazo || '') ? bruta.prazo : '',
      passos: Array.isArray(bruta.passos) ? bruta.passos.filter(p => p && String(p.texto || '').trim()).map(p => ({
        id: String(p.id || C().uid('pas')),
        texto: String(p.texto).trim().slice(0, 160),
        feito: !!p.feito
      })) : [],
      status: STATUS.includes(bruta.status) ? bruta.status : 'ativa',
      gasto: Math.max(0, Math.round(Number(bruta.gasto) || 0)),
      adiada: Math.max(0, Math.round(Number(bruta.adiada) || 0)),
      ondeParei: String(bruta.ondeParei || '').slice(0, 300),
      criadoEm: bruta.criadoEm || agora,
      atualizadoEm: bruta.atualizadoEm || agora,
      feitoEm: bruta.feitoEm || ''
    };
  }

  function tocar(tarefa) {
    tarefa.atualizadoEm = C().agoraIso();
    return tarefa;
  }

  /* ---------- consultas ---------- */

  function porId(id) {
    return C().estado.tarefas.find(t => t.id === id) || null;
  }

  function abertas() {
    return C().estado.tarefas.filter(t => t.status === 'entrada' || t.status === 'ativa');
  }

  function naEntrada() {
    return C().estado.tarefas.filter(t => t.status === 'entrada');
  }

  function doDia(dia) {
    return abertas().filter(t => t.dia === dia);
  }

  function feitasEm(dia) {
    return C().estado.tarefas.filter(t => t.status === 'feita' && String(t.feitoEm || '').slice(0, 10) === dia);
  }

  function projetos() {
    const nomes = new Set();
    abertas().forEach(t => { if (t.projeto) nomes.add(t.projeto); });
    return [...nomes].sort();
  }

  function primeiroPasso(tarefa) {
    return (tarefa.passos || []).find(p => !p.feito) || null;
  }

  function passosFeitos(tarefa) {
    return (tarefa.passos || []).filter(p => p.feito).length;
  }

  // "Travada" não é bronca: é o sinal de que a tarefa precisa ser quebrada em
  // um passo menor, remarcada ou solta. Quem decide é o usuário.
  function travada(tarefa) {
    if (tarefa.status !== 'ativa' && tarefa.status !== 'entrada') return false;
    if (tarefa.adiada >= 3) return true;
    const idade = -C().diasEntre(C().hojeISO(), C().diaISO(tarefa.criadoEm));
    return idade >= 10 && tarefa.gasto === 0;
  }

  /* ---------- mudanças de estado ---------- */

  function organizar(tarefa) {
    if (tarefa.status === 'entrada') tarefa.status = 'ativa';
    return tocar(tarefa);
  }

  function concluir(tarefa) {
    tarefa.status = 'feita';
    tarefa.feitoEm = C().agoraIso();
    return tocar(tarefa);
  }

  function reabrir(tarefa) {
    tarefa.status = 'ativa';
    tarefa.feitoEm = '';
    return tocar(tarefa);
  }

  function soltar(tarefa) {
    tarefa.status = 'solta';
    tarefa.dia = '';
    return tocar(tarefa);
  }

  // Adiar conta quantas vezes a tarefa foi empurrada. O número não serve para
  // cobrar: serve para o app oferecer ajuda quando ela empaca.
  function adiar(tarefa, dias) {
    tarefa.status = tarefa.status === 'entrada' ? 'entrada' : 'ativa';
    tarefa.dia = dias === null || dias === '' ? '' : C().somaDias(C().hojeISO(), dias);
    tarefa.adiada += 1;
    return tocar(tarefa);
  }

  function marcarHoje(tarefa, sim) {
    tarefa.dia = sim ? C().hojeISO() : '';
    if (tarefa.status === 'entrada') tarefa.status = 'ativa';
    return tocar(tarefa);
  }

  function excluir(id) {
    const lista = C().estado.tarefas;
    const i = lista.findIndex(t => t.id === id);
    if (i >= 0) lista.splice(i, 1);
  }

  function addPasso(tarefa, texto) {
    const limpo = String(texto || '').trim();
    if (!limpo) return null;
    const passo = { id: C().uid('pas'), texto: limpo.slice(0, 160), feito: false };
    tarefa.passos.push(passo);
    tocar(tarefa);
    return passo;
  }

  function alternarPasso(tarefa, passoId) {
    const passo = (tarefa.passos || []).find(p => p.id === passoId);
    if (passo) { passo.feito = !passo.feito; tocar(tarefa); }
    return passo;
  }

  function removerPasso(tarefa, passoId) {
    const i = (tarefa.passos || []).findIndex(p => p.id === passoId);
    if (i >= 0) { tarefa.passos.splice(i, 1); tocar(tarefa); }
  }

  Agora.modelo = {
    ENERGIAS, PESO_ENERGIA, ROTULO_ENERGIA, TEMPOS, STATUS,
    interpretar, novaTarefa, normalizarTarefa, tocar,
    porId, abertas, naEntrada, doDia, feitasEm, projetos,
    primeiroPasso, passosFeitos, travada,
    organizar, concluir, reabrir, soltar, adiar, marcarHoje, excluir,
    addPasso, alternarPasso, removerPasso
  };
})();
