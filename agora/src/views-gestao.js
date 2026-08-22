/*
 * views-gestao.js — as telas Lista, Rotinas e Ajustes.
 *
 * A Lista é o único lugar do app onde tudo aparece de uma vez. Ela existe
 * para revisar e organizar, não para trabalhar: quem está executando fica na
 * tela Agora. Por isso ela começa pela caixa de entrada — a triagem é o que
 * transforma um monte de anotações em coisas escolhíveis.
 */
(function () {
  'use strict';

  window.Agora = window.Agora || {};
  const C = () => Agora.core;
  const M = () => Agora.modelo;
  const E = () => Agora.motor;
  const V = () => Agora.telas;
  const esc = t => Agora.core.escapar(t);

  /* ---------- Lista ---------- */

  function telaLista() {
    const ui = Agora.app.ui;
    const entrada = M().naEntrada();
    const projetos = M().projetos();

    return `
      ${entrada.length ? `
      <section class="bloco entrada">
        <h2>Caixa de entrada · ${entrada.length}</h2>
        <p class="ajuda">Duas perguntas por item: <b>quanto tempo leva</b> e <b>quanta energia exige</b>. Responder isso agora é o que deixa a tela Agora certeira depois. O que não valer a pena, solte.</p>
        ${entrada.map(cartaoTriagem).join('')}
      </section>` : ''}

      <section class="bloco">
        <h2>Tudo o que existe</h2>
        <div class="filtros">
          <input type="search" id="filtroTexto" placeholder="Buscar por palavra" value="${esc(ui.filtro.texto)}" aria-label="Buscar tarefa">
          <div class="filtro-chips">
            ${V().chip('abertas', 'filtro-status', { valor: 'abertas' }, ui.filtro.status === 'abertas')}
            ${V().chip('de hoje', 'filtro-status', { valor: 'hoje' }, ui.filtro.status === 'hoje')}
            ${V().chip('travadas', 'filtro-status', { valor: 'travadas' }, ui.filtro.status === 'travadas')}
            ${V().chip('concluídas', 'filtro-status', { valor: 'feitas' }, ui.filtro.status === 'feitas')}
            ${V().chip('soltas', 'filtro-status', { valor: 'soltas' }, ui.filtro.status === 'soltas')}
          </div>
          ${projetos.length ? `<div class="filtro-chips">
            ${V().chip('todas as áreas', 'filtro-projeto', { valor: '' }, !ui.filtro.projeto)}
            ${projetos.map(p => V().chip('#' + p, 'filtro-projeto', { valor: p }, ui.filtro.projeto === p)).join('')}
          </div>` : ''}
        </div>
        ${listaFiltrada()}
      </section>`;
  }

  function cartaoTriagem(t) {
    return `
      <div class="triagem">
        <p class="linha-titulo">${esc(t.titulo)}</p>
        <div class="triagem-rapida">
          <span class="rotulo">Leva</span>
          ${M().TEMPOS.map(m => V().chip(C().textoMinutos(m), 'def-min-tarefa', { id: t.id, min: m }, t.minutos === m)).join('')}
          <span class="rotulo">Exige</span>
          ${M().ENERGIAS.map(n => V().chip(M().ROTULO_ENERGIA[n].replace('energia ', ''), 'def-energia-tarefa', { id: t.id, nivel: n }, t.energia === n)).join('')}
        </div>
        <div class="acoes-linha">
          <button type="button" class="mini primario" data-acao="organizar" data-id="${esc(t.id)}">Está organizada</button>
          <button type="button" class="mini" data-acao="por-em-hoje" data-id="${esc(t.id)}">Fazer hoje</button>
          <button type="button" class="mini" data-acao="focar" data-id="${esc(t.id)}" data-min="5">Fazer agora em 5 min</button>
          <button type="button" class="mini fantasma" data-acao="soltar" data-id="${esc(t.id)}">Soltar</button>
        </div>
      </div>`;
  }

  function filtrar() {
    const f = Agora.app.ui.filtro;
    const texto = f.texto.trim().toLowerCase();
    let lista = C().estado.tarefas.slice();

    if (f.status === 'feitas') lista = lista.filter(t => t.status === 'feita');
    else if (f.status === 'soltas') lista = lista.filter(t => t.status === 'solta');
    else if (f.status === 'hoje') lista = lista.filter(t => t.dia === C().hojeISO() && t.status !== 'feita' && t.status !== 'solta');
    else if (f.status === 'travadas') lista = lista.filter(t => M().travada(t));
    else lista = lista.filter(t => t.status === 'ativa' || t.status === 'entrada');

    if (f.projeto) lista = lista.filter(t => t.projeto === f.projeto);
    if (texto) lista = lista.filter(t => (t.titulo + ' ' + t.notas + ' ' + t.projeto).toLowerCase().includes(texto));

    if (f.status === 'feitas') return lista.sort((a, b) => String(b.feitoEm).localeCompare(String(a.feitoEm))).slice(0, 100);
    return lista.sort((a, b) => {
      const diaA = a.dia || '9999-99-99', diaB = b.dia || '9999-99-99';
      return diaA.localeCompare(diaB) || String(a.criadoEm).localeCompare(String(b.criadoEm));
    });
  }

  function listaFiltrada() {
    const lista = filtrar();
    if (!lista.length) return `<p class="ajuda">Nada aqui com esses filtros.</p>`;
    return `<ul class="linhas">${lista.map(linhaTarefa).join('')}</ul>`;
  }

  function linhaTarefa(t) {
    const aberta = Agora.app.ui.expandida === t.id;
    const feita = t.status === 'feita';
    return `
      <li class="linha${feita ? ' feita' : ''}${aberta ? ' aberta' : ''}">
        <button type="button" class="caixa${feita ? ' marcada' : ''}" data-acao="${feita ? 'reabrir' : 'concluir'}" data-id="${esc(t.id)}"
                aria-label="${feita ? 'Reabrir' : 'Concluir'} ${esc(t.titulo)}"></button>
        <div class="linha-corpo">
          <button type="button" class="linha-titulo botao-titulo${feita ? ' riscado' : ''}" data-acao="abrir-tarefa" data-id="${esc(t.id)}"
                  aria-expanded="${aberta}">${esc(t.titulo)}</button>
          <div class="etiquetas">${V().etiquetasTarefa(t)}${M().travada(t) ? '<span class="etq travou">parada</span>' : ''}</div>
          ${aberta ? detalhe(t) : ''}
        </div>
        ${!aberta && !feita ? `<div class="linha-acoes">
          <button type="button" class="mini" data-acao="focar" data-id="${esc(t.id)}" data-min="${t.minutos && t.minutos <= 45 ? t.minutos : 25}">Focar</button>
        </div>` : ''}
      </li>`;
  }

  function detalhe(t) {
    const tempos = M().TEMPOS.includes(t.minutos) || !t.minutos ? M().TEMPOS : M().TEMPOS.concat(t.minutos).sort((a, b) => a - b);
    return `
      <div class="detalhe">
        <label class="campo"><span>Título</span>
          <input type="text" maxlength="200" data-campo="titulo" data-id="${esc(t.id)}" value="${esc(t.titulo)}"></label>

        <div class="campos-lado">
          <label class="campo"><span>Área</span>
            <input type="text" maxlength="24" list="listaProjetos" data-campo="projeto" data-id="${esc(t.id)}" value="${esc(t.projeto)}" placeholder="casa, trabalho…"></label>
          <label class="campo"><span>Leva quanto tempo</span>
            <select data-campo="minutos" data-id="${esc(t.id)}">
              <option value="0"${!t.minutos ? ' selected' : ''}>não sei ainda</option>
              ${tempos.map(m => `<option value="${m}"${t.minutos === m ? ' selected' : ''}>${esc(C().textoMinutos(m))}</option>`).join('')}
            </select></label>
          <label class="campo"><span>Energia que exige</span>
            <select data-campo="energia" data-id="${esc(t.id)}">
              <option value=""${!t.energia ? ' selected' : ''}>não sei ainda</option>
              ${M().ENERGIAS.map(n => `<option value="${n}"${t.energia === n ? ' selected' : ''}>${esc(M().ROTULO_ENERGIA[n].replace('energia ', ''))}</option>`).join('')}
            </select></label>
        </div>

        <div class="campos-lado">
          <label class="campo"><span>Dia escolhido</span>
            <input type="date" data-campo="dia" data-id="${esc(t.id)}" value="${esc(t.dia)}"></label>
          <label class="campo"><span>Prazo combinado com alguém</span>
            <input type="date" data-campo="prazo" data-id="${esc(t.id)}" value="${esc(t.prazo)}"></label>
        </div>

        <label class="campo"><span>Anotações</span>
          <textarea rows="3" data-campo="notas" data-id="${esc(t.id)}" placeholder="links, contexto, o que já foi tentado">${esc(t.notas)}</textarea></label>

        ${t.ondeParei ? `<p class="onde-parei"><b>Onde você parou:</b> ${esc(t.ondeParei)}
          <button type="button" class="link" data-acao="limpar-onde-parei" data-id="${esc(t.id)}">limpar</button></p>` : ''}

        <p class="rotulo">Passos</p>
        ${V().blocoPassos(t, true)}

        <div class="acoes-linha">
          <button type="button" class="mini" data-acao="focar" data-id="${esc(t.id)}" data-min="${t.minutos && t.minutos <= 45 ? t.minutos : 25}">Focar agora</button>
          <button type="button" class="mini" data-acao="por-em-hoje" data-id="${esc(t.id)}">Fazer hoje</button>
          <button type="button" class="mini" data-acao="adiar" data-id="${esc(t.id)}" data-dias="1">Empurrar 1 dia</button>
          <button type="button" class="mini" data-acao="adiar" data-id="${esc(t.id)}" data-dias="7">Empurrar 1 semana</button>
          ${t.status === 'solta'
            ? `<button type="button" class="mini" data-acao="organizar" data-id="${esc(t.id)}">Trazer de volta</button>`
            : `<button type="button" class="mini fantasma" data-acao="soltar" data-id="${esc(t.id)}">Soltar sem culpa</button>`}
          <button type="button" class="mini perigo" data-acao="excluir" data-id="${esc(t.id)}">Apagar de vez</button>
        </div>
        <p class="ajuda">Criada em ${esc(new Date(t.criadoEm).toLocaleDateString('pt-BR'))}${t.adiada ? ` · adiada ${t.adiada}x` : ''}${t.gasto ? ` · ${esc(C().textoMinutos(t.gasto))} de foco` : ''}</p>
      </div>`;
  }

  /* ---------- Rotinas ---------- */

  function telaRotinas() {
    const rotinas = C().estado.rotinas;
    return `
      <section class="bloco">
        <h2>Rotinas</h2>
        <p class="ajuda">O que se repete não precisa ocupar espaço na lista de tarefas. Aqui a conta é gentil: falhar um dia não zera a sequência — só dois dias seguidos encerram a contagem.</p>
        <form class="form-rotina" data-acao="add-rotina">
          <input type="text" name="nome" maxlength="80" placeholder="Ex.: tomar o remédio, arrumar a cozinha" aria-label="Nome da rotina" required>
          <select name="quando" aria-label="Frequência">
            <option value="diaria">todo dia</option>
            <option value="dias">dias escolhidos</option>
          </select>
          <div class="dias-semana">
            ${Agora.rotinas.NOMES_CURTOS.map((d, i) => `<label><input type="checkbox" name="dia" value="${i}"><span>${esc(d)}</span></label>`).join('')}
          </div>
          <button type="submit" class="primario">Criar rotina</button>
        </form>
      </section>

      ${rotinas.length ? `<section class="bloco">
        <ul class="linhas">
          ${rotinas.map(r => {
            const dias = Agora.rotinas.ultimosSete(r);
            const hoje = C().hojeISO();
            return `<li class="linha rotina">
              <button type="button" class="caixa${Agora.rotinas.feitaNoDia(r, hoje) ? ' marcada' : ''}" data-acao="alternar-rotina" data-id="${esc(r.id)}"
                      aria-label="Marcar ${esc(r.nome)} hoje"${Agora.rotinas.ehDoDia(r, hoje) ? '' : ' disabled title="Hoje não é dia dessa rotina"'}></button>
              <div class="linha-corpo">
                <p class="linha-titulo">${esc(r.nome)}</p>
                <div class="etiquetas">
                  <span class="etq">${r.quando === 'diaria' ? 'todo dia' : r.dias.map(d => Agora.rotinas.NOMES_CURTOS[d]).join(', ')}</span>
                  <span class="etq">${Agora.rotinas.sequencia(r)} dias seguidos</span>
                </div>
                <div class="pontos">${dias.map(d => `<span class="ponto${d.feito ? ' cheio' : ''}${d.previsto ? '' : ' folga'}" title="${esc(d.dia)}">${esc(d.curto[0])}</span>`).join('')}</div>
              </div>
              <div class="linha-acoes">
                <button type="button" class="mini fantasma" data-acao="remover-rotina" data-id="${esc(r.id)}">Apagar</button>
              </div>
            </li>`;
          }).join('')}
        </ul>
      </section>` : ''}`;
  }

  /* ---------- Ajustes ---------- */

  function telaAjustes() {
    const p = C().estado.prefs;
    const cal = E().calibragem();
    const semana = E().ultimosSeteDias();
    const pico = Math.max(1, ...semana.map(d => d.minutos));
    const horario = E().melhorHorario();

    return `
      <section class="bloco">
        <h2>Como o app se comporta</h2>
        <div class="campos-lado">
          <label class="campo"><span>Cores</span>
            <select data-pref="tema">
              <option value="escuro"${p.tema === 'escuro' ? ' selected' : ''}>escuro</option>
              <option value="claro"${p.tema === 'claro' ? ' selected' : ''}>claro</option>
              <option value="sepia"${p.tema === 'sepia' ? ' selected' : ''}>baixo contraste (menos estímulo)</option>
            </select></label>
          <label class="campo"><span>Tamanho do texto</span>
            <select data-pref="texto">
              <option value="normal"${p.texto === 'normal' ? ' selected' : ''}>normal</option>
              <option value="grande"${p.texto === 'grande' ? ' selected' : ''}>grande</option>
            </select></label>
          <label class="campo"><span>Quantas coisas cabem no dia</span>
            <select data-pref="limiteHoje">
              ${[1, 2, 3, 4, 5, 6].map(n => `<option value="${n}"${p.limiteHoje === n ? ' selected' : ''}>${n}</option>`).join('')}
            </select></label>
        </div>
        <div class="opcoes">
          <label class="opcao"><input type="checkbox" data-pref="animacoes" ${p.animacoes ? 'checked' : ''}><span>Animações (desligue se atrapalharem)</span></label>
          <label class="opcao"><input type="checkbox" data-pref="som" ${p.som ? 'checked' : ''}><span>Som e vibração no fim do foco</span></label>
          <label class="opcao"><input type="checkbox" data-pref="avisos" ${p.avisos ? 'checked' : ''}><span>Aviso do sistema quando o tempo acabar</span></label>
        </div>
      </section>

      <section class="bloco">
        <h2>Sua noção de tempo</h2>
        ${cal.confiavel ? `
          <p class="destaque">Você costuma levar <b>${cal.fator.toFixed(1)}×</b> o tempo que estima.</p>
          <p class="ajuda">Medido em ${cal.amostras} tarefas concluídas que tinham estimativa e foram cronometradas. O app já mostra a previsão corrigida ao lado da estimativa (o “→” nas etiquetas). Não é defeito seu: subestimar tempo é característica conhecida do TDAH, e a saída é medir, não se esforçar mais.</p>
        ` : `
          <p class="ajuda">Conclua ${cal.faltam} ${cal.faltam === 1 ? 'tarefa' : 'tarefas'} com estimativa e timer para o app aprender quanto tempo as coisas realmente levam para você. Depois disso ele passa a mostrar a previsão corrigida.</p>
        `}
      </section>

      <section class="bloco">
        <h2>Últimos sete dias</h2>
        <div class="grafico">
          ${semana.map(d => {
            const altura = Math.round((d.minutos / pico) * 100);
            const data = C().paraData(d.dia);
            return `<div class="coluna" title="${esc(d.dia)}: ${esc(C().textoMinutos(d.minutos))}, ${d.feitas} concluídas">
              <div class="haste"><div class="cheio" style="height:${altura}%"></div></div>
              <span>${esc(Agora.rotinas.NOMES_CURTOS[(data || new Date()).getDay()])}</span>
            </div>`;
          }).join('')}
        </div>
        ${horario ? `<p class="ajuda">Seu melhor horário até agora é entre <b>${horario.inicio}h e ${horario.fim}h</b> — foi quando você acumulou mais foco. Vale reservar as tarefas pesadas para essa faixa.</p>`
                  : `<p class="ajuda">Com mais algumas sessões de foco o app mostra em qual faixa do dia você rende mais.</p>`}
      </section>

      <section class="bloco">
        <h2>Backup</h2>
        <p class="ajuda">Tudo fica só neste navegador. Limpar os dados do site apaga tarefas, rotinas e histórico — exporte de vez em quando.</p>
        <div class="acoes-linha">
          <button type="button" class="primario" data-acao="exportar-json">Baixar backup (.json)</button>
          <button type="button" class="secundario" data-acao="importar-json">Restaurar backup</button>
          <button type="button" class="secundario" data-acao="exportar-csv-tarefas">Tarefas em .csv</button>
          <button type="button" class="secundario" data-acao="exportar-csv-sessoes">Sessões de foco em .csv</button>
        </div>
      </section>

      <section class="bloco">
        <h2>Recomeçar</h2>
        <div class="acoes-linha">
          <button type="button" class="mini fantasma" data-acao="limpar-feitas">Apagar concluídas com mais de 30 dias</button>
          <button type="button" class="mini perigo" data-acao="zerar">Apagar tudo deste aparelho</button>
        </div>
      </section>

      <section class="bloco">
        <h2>Por que o app é assim</h2>
        <ul class="porquês">
          <li><b>Uma tarefa por vez.</b> Lista inteira à vista paralisa; a tela Agora mostra só a próxima e um botão para trocar.</li>
          <li><b>Captura sem formulário.</b> Se guardar uma ideia custar três cliques, a ideia se perde.</li>
          <li><b>Energia e tempo antes de prioridade.</b> Prioridade não ajuda quando o problema é iniciar; o que ajuda é achar algo que caiba no estado atual.</li>
          <li><b>Começar com 5 minutos.</b> O custo de iniciar é a barreira real — o combinado curto contorna a negociação interna.</li>
          <li><b>Onde parei.</b> Retomar é caro; uma linha escrita na saída devolve o contexto na volta.</li>
          <li><b>Nada de vermelho acumulado.</b> Contador de atraso vira vergonha, e vergonha faz fechar o app. Aqui, item empacado vira oferta de ajuda.</li>
        </ul>
      </section>`;
  }

  Agora.telasGestao = { telaLista, telaRotinas, telaAjustes, filtrar };
})();
