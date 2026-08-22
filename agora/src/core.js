/*
 * core.js — versão do app, estado, armazenamento e helpers de data.
 *
 * Regras que valem para o arquivo inteiro:
 *  - o estado mora no localStorage e em lugar nenhum mais;
 *  - gravar é caro (serializa tudo), então ajuste que se repete usa
 *    `salvarLogo()`; o que não pode se perder usa `salvar()`;
 *  - carregar nunca pode explodir: dado estranho é normalizado, não descartado.
 */
(function () {
  'use strict';

  window.Agora = window.Agora || {};

  // Versão única: precisa bater com VERSION em sw.js e com o ?v= do index.html.
  const APP_VERSION = '1.0.0';
  const CHAVE = 'agora:v1:dados';

  const PREFS_PADRAO = {
    tema: 'escuro',          // escuro | claro | sepia
    calmo: false,            // esconde tudo menos a tarefa do momento
    texto: 'normal',         // normal | grande
    animacoes: true,
    som: true,               // aviso sonoro no fim do foco
    avisos: false,           // notificação do sistema (precisa de permissão)
    limiteHoje: 3,           // quantas tarefas cabem no dia
    tempoDisponivel: 30,     // último filtro usado na tela Agora
    energia: 'media'         // energia declarada agora
  };

  function estadoPadrao() {
    return {
      versao: 1,
      tarefas: [],
      rotinas: [],
      sessoes: [],   // {id, tarefaId, titulo, inicio, fim, minutos, planejado}
      foco: null,    // sessão de foco em andamento (ver focus.js)
      prefs: Object.assign({}, PREFS_PADRAO),
      meta: { criadoEm: '', versaoApp: APP_VERSION }
    };
  }

  /* ---------- helpers gerais ---------- */

  function uid(prefixo) {
    return `${prefixo}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  }

  function agoraIso() {
    return new Date().toISOString();
  }

  function diaISO(data) {
    const d = data ? new Date(data) : new Date();
    if (Number.isNaN(d.getTime())) return '';
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mes}-${dia}`;
  }

  function hojeISO() {
    return diaISO(new Date());
  }

  // Soma dias sobre uma data no formato YYYY-MM-DD sem cair em fuso horário:
  // monta a data ao meio-dia local, que sobrevive a horário de verão.
  function somaDias(iso, dias) {
    const base = paraData(iso) || new Date();
    base.setDate(base.getDate() + Number(dias || 0));
    return diaISO(base);
  }

  function paraData(iso) {
    if (!iso) return null;
    const partes = String(iso).slice(0, 10).split('-');
    if (partes.length !== 3) return null;
    const d = new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]), 12, 0, 0);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function diasEntre(isoA, isoB) {
    const a = paraData(isoA), b = paraData(isoB);
    if (!a || !b) return 0;
    return Math.round((b - a) / 86400000);
  }

  // Texto de dia sem tom de cobrança: nada de "ATRASADO" em vermelho.
  function textoDoDia(iso) {
    if (!iso) return '';
    const d = diasEntre(hojeISO(), iso);
    if (d === 0) return 'hoje';
    if (d === 1) return 'amanhã';
    if (d === -1) return 'era ontem';
    if (d > 1 && d <= 7) return `em ${d} dias`;
    if (d < -1) return `ficou para trás há ${Math.abs(d)} dias`;
    const data = paraData(iso);
    return data ? data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : iso;
  }

  function textoMinutos(min) {
    const m = Math.max(0, Math.round(Number(min) || 0));
    if (!m) return '—';
    if (m < 60) return `${m} min`;
    const horas = Math.floor(m / 60), resto = m % 60;
    return resto ? `${horas}h${String(resto).padStart(2, '0')}` : `${horas}h`;
  }

  function relogio(ms) {
    const total = Math.max(0, Math.round(ms / 1000));
    const min = Math.floor(total / 60), seg = total % 60;
    return `${String(min).padStart(2, '0')}:${String(seg).padStart(2, '0')}`;
  }

  function escapar(texto) {
    return String(texto == null ? '' : texto)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function limitar(valor, min, max) {
    const n = Number(valor);
    if (!Number.isFinite(n)) return min;
    return Math.min(max, Math.max(min, n));
  }

  /* ---------- armazenamento ---------- */

  const estado = estadoPadrao();
  let pendente = null;
  let avisouCheio = false;

  function normalizar(bruto) {
    const novo = estadoPadrao();
    if (!bruto || typeof bruto !== 'object') return novo;

    novo.tarefas = Array.isArray(bruto.tarefas) ? bruto.tarefas.map(Agora.modelo.normalizarTarefa).filter(Boolean) : [];
    novo.rotinas = Array.isArray(bruto.rotinas) ? bruto.rotinas.map(Agora.rotinas.normalizar).filter(Boolean) : [];
    novo.sessoes = Array.isArray(bruto.sessoes) ? bruto.sessoes.filter(s => s && s.inicio).map(s => ({
      id: s.id || uid('ses'),
      tarefaId: String(s.tarefaId || ''),
      titulo: String(s.titulo || ''),
      inicio: Number(s.inicio) || 0,
      fim: Number(s.fim) || 0,
      minutos: Math.max(0, Math.round(Number(s.minutos) || 0)),
      planejado: Math.max(0, Math.round(Number(s.planejado) || 0))
    })) : [];
    novo.foco = bruto.foco && bruto.foco.inicio ? bruto.foco : null;
    novo.prefs = Object.assign({}, PREFS_PADRAO, bruto.prefs || {});
    novo.prefs.limiteHoje = limitar(novo.prefs.limiteHoje, 1, 9);
    novo.prefs.tempoDisponivel = limitar(novo.prefs.tempoDisponivel, 5, 240);
    if (!['baixa', 'media', 'alta'].includes(novo.prefs.energia)) novo.prefs.energia = 'media';
    if (!['escuro', 'claro', 'sepia'].includes(novo.prefs.tema)) novo.prefs.tema = 'escuro';
    novo.meta = Object.assign({ criadoEm: agoraIso(), versaoApp: APP_VERSION }, bruto.meta || {});
    return novo;
  }

  function aplicar(novo) {
    estado.versao = novo.versao;
    estado.tarefas = novo.tarefas;
    estado.rotinas = novo.rotinas;
    estado.sessoes = novo.sessoes;
    estado.foco = novo.foco;
    estado.prefs = novo.prefs;
    estado.meta = novo.meta;
  }

  function carregar() {
    let bruto = null;
    try {
      const cru = localStorage.getItem(CHAVE);
      if (cru) bruto = JSON.parse(cru);
    } catch (e) {
      // Dado corrompido não pode impedir o app de abrir: começa vazio, mas o
      // texto cru continua no localStorage para recuperação manual.
      bruto = null;
    }
    const novo = normalizar(bruto);
    if (!novo.meta.criadoEm) novo.meta.criadoEm = agoraIso();
    aplicar(novo);
    return estado;
  }

  function salvar() {
    if (pendente) { clearTimeout(pendente); pendente = null; }
    estado.meta.versaoApp = APP_VERSION;
    try {
      localStorage.setItem(CHAVE, JSON.stringify(estado));
      avisouCheio = false;
      return true;
    } catch (e) {
      // Armazenamento cheio ou bloqueado: avisar na tela, nunca engolir.
      if (!avisouCheio && Agora.app && Agora.app.toast) {
        Agora.app.toast('Não consegui salvar: o armazenamento do navegador está cheio ou bloqueado. Exporte um backup em Ajustes.', 'erro');
        avisouCheio = true;
      }
      return false;
    }
  }

  // Para ajuste que se repete (arrastar um controle, digitar em um campo):
  // adia a gravação para não serializar o estado inteiro a cada toque.
  function salvarLogo() {
    if (pendente) clearTimeout(pendente);
    pendente = setTimeout(() => { pendente = null; salvar(); }, 600);
  }

  function fecharConta() {
    if (pendente) salvar();
  }

  function trocarEstado(novoBruto) {
    aplicar(normalizar(novoBruto));
    salvar();
  }

  Agora.core = {
    APP_VERSION, CHAVE, PREFS_PADRAO,
    estado, estadoPadrao, carregar, salvar, salvarLogo, fecharConta, trocarEstado, normalizar,
    uid, agoraIso, hojeISO, diaISO, somaDias, paraData, diasEntre,
    textoDoDia, textoMinutos, relogio, escapar, limitar
  };
})();
