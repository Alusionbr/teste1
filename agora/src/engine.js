/*
 * engine.js — quem escolhe "o que fazer agora", e as contas sobre tempo.
 *
 * A tela Agora mostra UMA tarefa. Escolher qual é a parte mais delicada do
 * app: uma lista de 40 itens paralisa, mas uma sugestão burra faz a pessoa
 * perder a confiança na ferramenta. Por isso a nota é explicável — cada
 * ponto vira uma frase curta no cartão ("cabe no tempo", "combinado para
 * hoje"), e sempre dá para trocar de sugestão sem penalidade.
 */
(function () {
  'use strict';

  window.Agora = window.Agora || {};
  const C = () => Agora.core;
  const M = () => Agora.modelo;

  const MIN_AMOSTRAS_CALIBRAGEM = 3;

  /* ---------- nota de cada tarefa ---------- */

  function avaliar(tarefa, contexto) {
    const hoje = C().hojeISO();
    const razoes = [];
    let nota = 0;

    if (tarefa.dia === hoje) { nota += 40; razoes.push('escolhida para hoje'); }
    else if (tarefa.dia && C().diasEntre(hoje, tarefa.dia) < 0) { nota += 22; razoes.push('ficou de outro dia'); }
    else if (tarefa.dia) { nota -= 12; }

    if (tarefa.prazo) {
      const faltam = C().diasEntre(hoje, tarefa.prazo);
      if (faltam <= 0) { nota += 55; razoes.push(faltam === 0 ? 'o prazo é hoje' : 'o prazo já passou'); }
      else if (faltam === 1) { nota += 30; razoes.push('o prazo é amanhã'); }
      else if (faltam <= 7) { nota += 14; razoes.push(`faltam ${faltam} dias para o prazo`); }
    }

    // Tempo: o que não cabe no tempo disponível não some — cai de posição e
    // é oferecido como "só o primeiro passo".
    const estimativa = tarefa.minutos || 0;
    if (!estimativa) { nota -= 4; }
    else if (estimativa <= contexto.tempo) { nota += 18; razoes.push(`cabe nos ${C().textoMinutos(contexto.tempo)}`); }
    else if (M().primeiroPasso(tarefa)) { nota -= 6; razoes.push('dá para fazer só o primeiro passo'); }
    else { nota -= 26; }

    // Energia: pedir tarefa pesada em dia fraco é receita de travar.
    const pesoTarefa = M().PESO_ENERGIA[tarefa.energia] || 0;
    const pesoAgora = M().PESO_ENERGIA[contexto.energia] || 2;
    if (!pesoTarefa) { nota -= 2; }
    else if (pesoTarefa <= pesoAgora) { nota += 14; if (pesoTarefa < pesoAgora) razoes.push('leve para a energia de agora'); }
    else { nota -= 22 * (pesoTarefa - pesoAgora); }

    if (M().primeiroPasso(tarefa)) { nota += 10; razoes.push('já tem o primeiro passo escrito'); }
    if (tarefa.gasto > 0) { nota += 8; razoes.push('já começou'); }

    nota += Math.min(20, tarefa.adiada * 5);
    const idade = -C().diasEntre(hoje, C().diaISO(tarefa.criadoEm));
    nota += Math.min(10, idade * 0.5);

    if (tarefa.status === 'entrada') { nota -= 10; razoes.push('ainda sem estimativa'); }

    return { tarefa, nota, razoes: razoes.slice(0, 3) };
  }

  // Fila ordenada de sugestões. A tela Agora mostra a primeira e o botão
  // "trocar" caminha pela fila — nada de sorteio, para a mesma pergunta ter
  // sempre a mesma resposta enquanto nada mudar.
  function fila(contexto) {
    const ctx = {
      tempo: C().limitar(contexto && contexto.tempo, 5, 600) || 30,
      energia: (contexto && contexto.energia) || 'media'
    };
    return M().abertas()
      .map(t => avaliar(t, ctx))
      .sort((a, b) => b.nota - a.nota || a.tarefa.criadoEm.localeCompare(b.tarefa.criadoEm));
  }

  function sugerir(contexto, posicao) {
    const lista = fila(contexto);
    if (!lista.length) return null;
    const i = ((Number(posicao) || 0) % lista.length + lista.length) % lista.length;
    return { ...lista[i], posicao: i, total: lista.length };
  }

  /* ---------- cegueira temporal: calibragem da estimativa ---------- */

  // Quanto tempo as coisas realmente levam, comparado com o que foi estimado.
  // Só olha tarefas concluídas que tinham estimativa e tempo cronometrado.
  function calibragem() {
    let estimado = 0, real = 0, amostras = 0;
    C().estado.tarefas.forEach(t => {
      if (t.status !== 'feita' || !t.minutos || !t.gasto) return;
      estimado += t.minutos;
      real += t.gasto;
      amostras += 1;
    });
    if (amostras < MIN_AMOSTRAS_CALIBRAGEM || !estimado) {
      return { amostras, fator: 1, confiavel: false, faltam: MIN_AMOSTRAS_CALIBRAGEM - amostras };
    }
    return { amostras, fator: C().limitar(real / estimado, 0.4, 5), confiavel: true, faltam: 0 };
  }

  function estimativaRealista(tarefa) {
    const cal = calibragem();
    if (!tarefa.minutos || !cal.confiavel) return 0;
    const previsto = Math.round(tarefa.minutos * cal.fator);
    return Math.abs(previsto - tarefa.minutos) < 3 ? 0 : previsto;
  }

  /* ---------- estatísticas ---------- */

  function minutosFocados(dia) {
    return C().estado.sessoes
      .filter(s => C().diaISO(new Date(s.inicio)) === dia)
      .reduce((soma, s) => soma + s.minutos, 0);
  }

  function resumoDeHoje() {
    const hoje = C().hojeISO();
    return {
      feitas: M().feitasEm(hoje).length,
      minutos: minutosFocados(hoje),
      sessoes: C().estado.sessoes.filter(s => C().diaISO(new Date(s.inicio)) === hoje).length,
      rotinas: Agora.rotinas.feitasEm(hoje).length
    };
  }

  function ultimosSeteDias() {
    const dias = [];
    for (let i = 6; i >= 0; i--) {
      const dia = C().somaDias(C().hojeISO(), -i);
      dias.push({ dia, minutos: minutosFocados(dia), feitas: M().feitasEm(dia).length });
    }
    return dias;
  }

  // Em que horário a pessoa realmente rende. Só reporta com amostra suficiente
  // para não virar palpite — informação errada aqui atrapalha o planejamento.
  function melhorHorario() {
    const sessoes = C().estado.sessoes;
    if (sessoes.length < 8) return null;
    const faixas = {};
    sessoes.forEach(s => {
      const hora = new Date(s.inicio).getHours();
      const faixa = Math.floor(hora / 3) * 3;
      faixas[faixa] = (faixas[faixa] || 0) + s.minutos;
    });
    const melhor = Object.entries(faixas).sort((a, b) => b[1] - a[1])[0];
    if (!melhor) return null;
    const inicio = Number(melhor[0]);
    return { inicio, fim: inicio + 3, minutos: melhor[1] };
  }

  Agora.motor = {
    avaliar, fila, sugerir,
    calibragem, estimativaRealista,
    minutosFocados, resumoDeHoje, ultimosSeteDias, melhorHorario
  };
})();
