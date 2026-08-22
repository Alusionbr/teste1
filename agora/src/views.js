/*
 * views.js — peças comuns e as telas Agora e Hoje.
 *
 * As funções aqui só montam HTML a partir do estado; nenhuma delas altera
 * dado. Quem muda o estado é o app.js, a partir dos atributos `data-acao`.
 * Todo texto vindo do usuário passa por `esc()` antes de entrar no HTML.
 */
(function () {
  'use strict';

  window.Agora = window.Agora || {};
  const C = () => Agora.core;
  const M = () => Agora.modelo;
  const F = () => Agora.foco;
  const E = () => Agora.motor;
  const esc = t => Agora.core.escapar(t);

  const TEMPOS_DISPONIVEIS = [5, 15, 30, 60, 120];
  const ROTULO_TEMPO = { 5: '5 min', 15: '15 min', 30: '30 min', 60: '1 hora', 120: '2 horas ou mais' };

  /* ---------- peças reutilizáveis ---------- */

  function chip(rotulo, acao, dados, ativo, titulo) {
    const attrs = Object.entries(dados || {}).map(([k, v]) => `data-${k}="${esc(v)}"`).join(' ');
    return `<button type="button" class="chip${ativo ? ' ativo' : ''}" data-acao="${acao}" ${attrs}` +
      `${titulo ? ` title="${esc(titulo)}"` : ''}${ativo ? ' aria-pressed="true"' : ' aria-pressed="false"'}>${esc(rotulo)}</button>`;
  }

  function seletorContexto() {
    const p = C().estado.prefs;
    return `
      <div class="contexto">
        <div class="contexto-grupo">
          <span class="rotulo">Tenho</span>
          ${TEMPOS_DISPONIVEIS.map(m => chip(ROTULO_TEMPO[m], 'def-tempo', { min: m }, p.tempoDisponivel === m)).join('')}
        </div>
        <div class="contexto-grupo">
          <span class="rotulo">Energia</span>
          ${chip('baixa', 'def-energia', { nivel: 'baixa' }, p.energia === 'baixa', 'Dia arrastado: só o que é leve')}
          ${chip('média', 'def-energia', { nivel: 'media' }, p.energia === 'media')}
          ${chip('alta', 'def-energia', { nivel: 'alta' }, p.energia === 'alta', 'Dá para encarar o que é pesado')}
        </div>
      </div>`;
  }

  function etiquetasTarefa(t) {
    const partes = [];
    if (t.projeto) partes.push(`<span class="etq projeto">#${esc(t.projeto)}</span>`);
    if (t.minutos) {
      const real = E().estimativaRealista(t);
      partes.push(`<span class="etq">${esc(C().textoMinutos(t.minutos))}${real ? ` <span class="real" title="Pela sua média, costuma levar mais">→ ${esc(C().textoMinutos(real))}</span>` : ''}</span>`);
    }
    if (t.energia) partes.push(`<span class="etq energia-${esc(t.energia)}">${esc(M().ROTULO_ENERGIA[t.energia])}</span>`);
    if (t.prazo) partes.push(`<span class="etq prazo">prazo ${esc(C().textoDoDia(t.prazo))}</span>`);
    else if (t.dia) partes.push(`<span class="etq">${esc(C().textoDoDia(t.dia))}</span>`);
    if (t.gasto) partes.push(`<span class="etq">${esc(C().textoMinutos(t.gasto))} focados</span>`);
    if (t.passos.length) partes.push(`<span class="etq">${M().passosFeitos(t)}/${t.passos.length} passos</span>`);
    return partes.join('');
  }

  function blocoPassos(t, aberto) {
    if (!aberto && !t.passos.length) return '';
    const itens = t.passos.map(p => `
      <li class="${p.feito ? 'feito' : ''}">
        <label>
          <input type="checkbox" data-acao="alternar-passo" data-id="${esc(t.id)}" data-passo="${esc(p.id)}" ${p.feito ? 'checked' : ''}>
          <span>${esc(p.texto)}</span>
        </label>
        <button type="button" class="mini fantasma" data-acao="remover-passo" data-id="${esc(t.id)}" data-passo="${esc(p.id)}" title="Apagar passo">×</button>
      </li>`).join('');
    const form = aberto ? `
      <form class="form-passo" data-acao="add-passo" data-id="${esc(t.id)}">
        <input type="text" name="passo" maxlength="160" placeholder="Qual é o menor primeiro passo? (ex.: abrir o arquivo)" aria-label="Novo passo">
        <button type="submit" class="mini">Somar passo</button>
      </form>
      <p class="ajuda">Um passo bom é pequeno a ponto de parecer bobo. É assim que se começa sem negociar consigo mesmo.</p>` : '';
    return `<div class="passos">${itens ? `<ul>${itens}</ul>` : ''}${form}</div>`;
  }

  function avisoTravada(t) {
    if (!M().travada(t)) return '';
    const motivo = t.adiada >= 3
      ? `Essa já foi adiada ${t.adiada} vezes.`
      : 'Essa está parada há mais de dez dias.';
    return `
      <div class="travada">
        <p><b>${esc(motivo)}</b> Não é preguiça: é sinal de que ela está grande ou mal definida demais para começar.</p>
        <div class="acoes-linha">
          <button type="button" class="mini" data-acao="abrir-passos" data-id="${esc(t.id)}">Quebrar em um passo menor</button>
          <button type="button" class="mini" data-acao="adiar" data-id="${esc(t.id)}" data-dias="7">Ver de novo em uma semana</button>
          <button type="button" class="mini fantasma" data-acao="soltar" data-id="${esc(t.id)}">Soltar sem culpa</button>
        </div>
      </div>`;
  }

  /* ---------- tela Agora ---------- */

  function telaAgora() {
    if (F().ativo()) return cartaoFoco();

    const ui = Agora.app.ui;
    const prefs = C().estado.prefs;
    const escolha = E().sugerir({ tempo: prefs.tempoDisponivel, energia: prefs.energia }, ui.posicaoSugestao);

    if (!escolha) return `${seletorContexto()}${vazioAgora()}`;

    const t = escolha.tarefa;
    const passo = M().primeiroPasso(t);
    const aberto = ui.expandida === t.id;
    const minutos = t.minutos || 0;
    // Sempre 5 minutos primeiro (o arranque barato) e, quando existe
    // estimativa, ela vira o botão em destaque.
    const destaque = minutos ? Math.min(minutos, 90) : 25;
    const botoesTempo = [...new Set([5, 15, 25, destaque])].sort((a, b) => a - b)
      .map(m => `<button type="button" class="${m === destaque ? 'primario' : 'secundario'}" data-acao="focar" data-id="${esc(t.id)}" data-min="${m}">${m} min</button>`)
      .join('');

    const faltaInfo = t.status === 'entrada' || !t.minutos || !t.energia;

    return `
      ${seletorContexto()}
      <article class="cartao">
        <p class="etiqueta">Sua próxima coisa</p>
        <h2 class="titulo-agora">${esc(t.titulo)}</h2>
        <div class="etiquetas">${etiquetasTarefa(t)}</div>
        ${escolha.razoes.length ? `<p class="porque">Sugerida porque: ${esc(escolha.razoes.join(' · '))}</p>` : ''}
        ${t.ondeParei ? `<p class="onde-parei"><b>Você parou aqui:</b> ${esc(t.ondeParei)}</p>` : ''}
        ${passo ? `<p class="passo-agora"><span>Comece por</span> ${esc(passo.texto)}</p>`
                : `<p class="passo-agora vazio"><span>Sem primeiro passo.</span> <button type="button" class="link" data-acao="abrir-passos" data-id="${esc(t.id)}">Escrever um passo pequeno</button></p>`}
        ${avisoTravada(t)}

        <div class="acoes-foco">
          ${botoesTempo}
          <span class="ajuda-inline">Combinar só 5 minutos é o jeito mais honesto de começar. Depois dá para esticar.</span>
        </div>

        <div class="acoes-linha secundarias">
          <button type="button" class="fantasma" data-acao="trocar-sugestao">Trocar sugestão (${escolha.posicao + 1} de ${escolha.total})</button>
          <button type="button" class="fantasma" data-acao="abrir-passos" data-id="${esc(t.id)}">${aberto ? 'Fechar passos' : 'Quebrar em passos'}</button>
          <button type="button" class="fantasma" data-acao="adiar" data-id="${esc(t.id)}" data-dias="1">Hoje não</button>
          <button type="button" class="ok" data-acao="concluir" data-id="${esc(t.id)}">Já está feita</button>
        </div>

        ${faltaInfo ? `
          <div class="triagem-rapida">
            <span class="rotulo">Quanto tempo leva?</span>
            ${M().TEMPOS.map(m => chip(C().textoMinutos(m), 'def-min-tarefa', { id: t.id, min: m }, t.minutos === m)).join('')}
            <span class="rotulo">Exige</span>
            ${M().ENERGIAS.map(n => chip(M().ROTULO_ENERGIA[n].replace('energia ', ''), 'def-energia-tarefa', { id: t.id, nivel: n }, t.energia === n)).join('')}
          </div>` : ''}

        ${blocoPassos(t, aberto)}
      </article>
      ${resumoRodape()}`;
  }

  function vazioAgora() {
    const temTarefa = M().abertas().length > 0;
    const resumo = E().resumoDeHoje();
    if (!C().estado.tarefas.length) {
      return `<article class="cartao vazio">
        <h2>Comece esvaziando a cabeça</h2>
        <p>Escreva lá em cima tudo o que está ocupando espaço — uma coisa por linha, sem organizar. Organizar vem depois; guardar é o que alivia agora.</p>
      </article>`;
    }
    if (!temTarefa) {
      return `<article class="cartao vazio">
        <h2>Sua lista está limpa</h2>
        <p>Nada em aberto. Hoje você concluiu ${resumo.feitas} ${resumo.feitas === 1 ? 'tarefa' : 'tarefas'} e focou ${esc(C().textoMinutos(resumo.minutos))}.</p>
      </article>`;
    }
    return `<article class="cartao vazio">
      <h2>Nada cabe nesse filtro</h2>
      <p>Com ${esc(C().textoMinutos(C().estado.prefs.tempoDisponivel))} e energia ${esc(C().estado.prefs.energia)} não sobrou nada. Aumente o tempo, mude a energia ou dê uma olhada na Lista.</p>
    </article>`;
  }

  /* ---------- tela Agora com o timer rodando ---------- */

  function cartaoFoco() {
    const f = F().atual();
    const t = F().tarefaDoFoco();
    const pausa = f.tipo === 'pausa';
    const restante = F().restanteMs();
    const acabou = restante <= 0;
    const passo = t ? M().primeiroPasso(t) : null;
    // Na pausa, a volta precisa ser um botão só: procurar a tarefa de novo no
    // meio da lista é onde a pausa de cinco minutos vira uma hora.
    const voltar = pausa ? M().porId(Agora.app.ui.ultimaTarefa) : null;

    return `
      <article class="cartao foco${pausa ? ' pausa' : ''}${acabou ? ' cumprido' : ''}">
        <p class="etiqueta">${pausa ? 'Pausa' : 'Foco em andamento'}</p>
        <h2 class="titulo-agora">${esc(f.titulo)}</h2>
        ${passo ? `<p class="passo-agora"><span>Comece por</span> ${esc(passo.texto)}</p>` : ''}

        <div class="relogio" id="relogioFoco" aria-live="off">${esc(C().relogio(Math.abs(restante)))}</div>
        <p class="relogio-legenda" id="legendaFoco">${acabou ? 'tempo cumprido — o extra está sendo contado' : `de ${f.planejado} min${F().emPausa() ? ' · pausado' : ''}`}</p>
        <div class="barra"><div class="barra-cheia" id="barraFoco" style="width:${Math.round(F().progresso() * 100)}%"></div></div>

        <div class="acoes-foco">
          ${F().emPausa()
            ? `<button type="button" class="primario" data-acao="retomar-foco">Voltar</button>`
            : `<button type="button" class="secundario" data-acao="pausar-foco">Pausar</button>`}
          <button type="button" class="secundario" data-acao="esticar-foco" data-min="5">+5 min</button>
          ${t ? `<button type="button" class="ok" data-acao="concluir-foco" data-id="${esc(t.id)}">Terminei a tarefa</button>` : ''}
          <button type="button" class="fantasma" data-acao="parar-foco">Parar</button>
          ${!pausa ? `<button type="button" class="fantasma" data-acao="pausa-curta">Fazer uma pausa de 5 min</button>` : ''}
          ${voltar ? `<button type="button" class="primario" data-acao="focar" data-id="${esc(voltar.id)}" data-min="15">Voltar para ${esc(voltar.titulo)}</button>` : ''}
        </div>

        ${t ? `
        <label class="campo onde">
          <span>Onde eu parei (para não recomeçar do zero depois)</span>
          <textarea rows="2" maxlength="300" data-campo="ondeParei" data-id="${esc(t.id)}"
            placeholder="ex.: falta revisar o último parágrafo">${esc(t.ondeParei)}</textarea>
        </label>` : ''}
      </article>`;
  }

  /* ---------- tela Hoje ---------- */

  function telaHoje() {
    const hoje = C().hojeISO();
    const prefs = C().estado.prefs;
    const escolhidas = M().doDia(hoje);
    const resumo = E().resumoDeHoje();
    const feitas = M().feitasEm(hoje);
    const rotinas = Agora.rotinas.deHoje();
    const candidatas = M().abertas().filter(t => t.dia !== hoje).slice(0, 40);

    const listaEscolhidas = escolhidas.length ? escolhidas.map(t => `
      <li class="linha">
        <button type="button" class="caixa" data-acao="concluir" data-id="${esc(t.id)}" aria-label="Concluir ${esc(t.titulo)}"></button>
        <div class="linha-corpo">
          <p class="linha-titulo">${esc(t.titulo)}</p>
          <div class="etiquetas">${etiquetasTarefa(t)}</div>
        </div>
        <div class="linha-acoes">
          <button type="button" class="mini" data-acao="focar" data-id="${esc(t.id)}" data-min="${t.minutos && t.minutos <= 45 ? t.minutos : 25}">Focar</button>
          <button type="button" class="mini fantasma" data-acao="tirar-de-hoje" data-id="${esc(t.id)}">Tirar de hoje</button>
        </div>
      </li>`).join('') : `<li class="vazio-linha">Nenhuma escolhida ainda. Pegue no máximo ${prefs.limiteHoje} lá embaixo.</li>`;

    const excedeu = escolhidas.length > prefs.limiteHoje;

    return `
      <section class="bloco">
        <h2>As ${prefs.limiteHoje} coisas de hoje</h2>
        <p class="ajuda">Um dia comporta poucas coisas de verdade. Escolher menos é o que faz a lista deixar de mentir.</p>
        ${excedeu ? `<p class="alerta-suave">Você tem ${escolhidas.length} escolhidas para hoje. Dá para fazer, mas costuma render mais tirar ${escolhidas.length - prefs.limiteHoje} de cena.</p>` : ''}
        <ul class="linhas">${listaEscolhidas}</ul>
      </section>

      ${rotinas.length ? `
      <section class="bloco">
        <h2>Rotinas de hoje</h2>
        <ul class="linhas compactas">
          ${rotinas.map(r => `
            <li class="linha">
              <button type="button" class="caixa${Agora.rotinas.feitaNoDia(r, hoje) ? ' marcada' : ''}" data-acao="alternar-rotina" data-id="${esc(r.id)}" aria-label="Marcar ${esc(r.nome)}"></button>
              <div class="linha-corpo"><p class="linha-titulo${Agora.rotinas.feitaNoDia(r, hoje) ? ' riscado' : ''}">${esc(r.nome)}</p></div>
              <div class="linha-acoes"><span class="etq">${Agora.rotinas.sequencia(r)} dias seguidos</span></div>
            </li>`).join('')}
        </ul>
      </section>` : ''}

      <section class="bloco vitorias">
        <h2>Vitórias de hoje</h2>
        <div class="numeros">
          <div><b>${resumo.feitas}</b><span>${resumo.feitas === 1 ? 'tarefa concluída' : 'tarefas concluídas'}</span></div>
          <div><b>${esc(C().textoMinutos(resumo.minutos))}</b><span>de foco cronometrado</span></div>
          <div><b>${resumo.sessoes}</b><span>${resumo.sessoes === 1 ? 'sessão' : 'sessões'}</span></div>
          <div><b>${resumo.rotinas}</b><span>rotinas cumpridas</span></div>
        </div>
        ${feitas.length ? `<ul class="linhas compactas">${feitas.map(t => `
          <li class="linha feita">
            <span class="caixa marcada" aria-hidden="true"></span>
            <div class="linha-corpo"><p class="linha-titulo riscado">${esc(t.titulo)}</p></div>
            <div class="linha-acoes"><button type="button" class="mini fantasma" data-acao="reabrir" data-id="${esc(t.id)}">Reabrir</button></div>
          </li>`).join('')}</ul>`
        : `<p class="ajuda">Nada concluído ainda hoje — e tudo bem. Cinco minutos de foco já entram aqui.</p>`}
      </section>

      <section class="bloco">
        <h2>Puxar para hoje</h2>
        ${candidatas.length ? `<ul class="linhas compactas">${candidatas.map(t => `
          <li class="linha">
            <button type="button" class="mini" data-acao="por-em-hoje" data-id="${esc(t.id)}">+ hoje</button>
            <div class="linha-corpo">
              <p class="linha-titulo">${esc(t.titulo)}</p>
              <div class="etiquetas">${etiquetasTarefa(t)}</div>
            </div>
          </li>`).join('')}</ul>` : `<p class="ajuda">Não há mais nada em aberto.</p>`}
      </section>`;
  }

  function resumoRodape() {
    const r = E().resumoDeHoje();
    return `<p class="resumo-rodape">Hoje: ${r.feitas} ${r.feitas === 1 ? 'concluída' : 'concluídas'} · ${esc(C().textoMinutos(r.minutos))} de foco · ${M().naEntrada().length} na caixa de entrada</p>`;
  }

  Agora.telas = { chip, seletorContexto, etiquetasTarefa, blocoPassos, avisoTravada, telaAgora, telaHoje, cartaoFoco };
})();
