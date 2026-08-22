/*
 * backup.js — exportar e restaurar.
 *
 * O dado mora no navegador, e navegador esquece: limpar o histórico apaga
 * tudo. Por isso o backup é JSON legível (dá para abrir e conferir a olho) e
 * a restauração sempre pergunta antes de substituir.
 */
(function () {
  'use strict';

  window.Agora = window.Agora || {};
  const C = () => Agora.core;

  function baixar(nome, conteudo, tipo) {
    const blob = new Blob([conteudo], { type: `${tipo};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function carimbo() {
    return C().hojeISO();
  }

  function exportarJson() {
    const pacote = Object.assign({}, C().estado, { exportadoEm: C().agoraIso(), app: 'agora', versaoApp: C().APP_VERSION });
    baixar(`agora-backup-${carimbo()}.json`, JSON.stringify(pacote, null, 2), 'application/json');
  }

  // CSV com ponto e vírgula e BOM: é o que o Excel em português abre sem
  // pedir configuração.
  function csv(linhas) {
    const corpo = linhas.map(cols => cols.map(v => {
      const texto = String(v == null ? '' : v).replace(/"/g, '""');
      return /[;"\n]/.test(texto) ? `"${texto}"` : texto;
    }).join(';')).join('\r\n');
    return '﻿' + corpo;
  }

  function exportarTarefas() {
    const cab = ['titulo', 'area', 'status', 'estimativa_min', 'gasto_min', 'energia', 'dia', 'prazo', 'adiada', 'passos_feitos', 'passos_total', 'criada_em', 'concluida_em', 'notas'];
    const linhas = C().estado.tarefas.map(t => [
      t.titulo, t.projeto, t.status, t.minutos, t.gasto, t.energia, t.dia, t.prazo, t.adiada,
      Agora.modelo.passosFeitos(t), t.passos.length, t.criadoEm, t.feitoEm, t.notas
    ]);
    baixar(`agora-tarefas-${carimbo()}.csv`, csv([cab, ...linhas]), 'text/csv');
  }

  function exportarSessoes() {
    const cab = ['tarefa', 'inicio', 'fim', 'minutos', 'planejado'];
    const linhas = C().estado.sessoes.map(s => [
      s.titulo, new Date(s.inicio).toLocaleString('pt-BR'), s.fim ? new Date(s.fim).toLocaleString('pt-BR') : '', s.minutos, s.planejado
    ]);
    baixar(`agora-foco-${carimbo()}.csv`, csv([cab, ...linhas]), 'text/csv');
  }

  function importarJson(arquivo, aoTerminar) {
    const leitor = new FileReader();
    leitor.onload = () => {
      let dados = null;
      try { dados = JSON.parse(String(leitor.result)); }
      catch (e) { aoTerminar(false, 'Esse arquivo não é um backup válido (não consegui ler o JSON).'); return; }
      if (!dados || (!Array.isArray(dados.tarefas) && !Array.isArray(dados.rotinas))) {
        aoTerminar(false, 'Esse arquivo não parece um backup do Agora.');
        return;
      }
      const resumo = `${(dados.tarefas || []).length} tarefas e ${(dados.rotinas || []).length} rotinas`;
      const atual = `${C().estado.tarefas.length} tarefas e ${C().estado.rotinas.length} rotinas`;
      const ok = window.confirm(`Restaurar o backup vai SUBSTITUIR o que está neste aparelho.\n\nVem do arquivo: ${resumo}\nSerá apagado: ${atual}\n\nContinuar?`);
      if (!ok) { aoTerminar(false, 'Restauração cancelada. Nada foi alterado.'); return; }
      C().trocarEstado(dados);
      aoTerminar(true, `Backup restaurado: ${resumo}.`);
    };
    leitor.onerror = () => aoTerminar(false, 'Não consegui ler o arquivo.');
    leitor.readAsText(arquivo);
  }

  Agora.backup = { exportarJson, exportarTarefas, exportarSessoes, importarJson };
})();
