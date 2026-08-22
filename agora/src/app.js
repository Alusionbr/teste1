/*
 * app.js — o que liga tudo: navegação, eventos, timer da tela e atalhos.
 *
 * Aqui não mora regra de negócio: cada ação chama uma função de model.js,
 * focus.js, routines.js ou backup.js e depois redesenha a tela ativa.
 *
 * Duas regras que evitam bugs chatos:
 *  - o tick do foco NÃO redesenha a tela; ele troca só o texto do relógio.
 *    Redesenhar a cada segundo apagaria o que a pessoa está digitando.
 *  - campo de texto grava no `input` e só redesenha no `change` (ao sair),
 *    pelo mesmo motivo.
 */
(function () {
  'use strict';

  window.Agora = window.Agora || {};
  const C = () => Agora.core;
  const M = () => Agora.modelo;
  const F = () => Agora.foco;

  const ui = {
    tela: 'agora',
    posicaoSugestao: 0,
    expandida: '',
    ultimaTarefa: '',
    filtro: { texto: '', projeto: '', status: 'abertas' }
  };

  let desfazerFn = null;
  let tituloOriginal = document.title;

  /* ---------- desenho ---------- */

  function alvo(tela) {
    return document.getElementById(`tela-${tela}`);
  }

  function refresh() {
    const html = {
      agora: () => Agora.telas.telaAgora(),
      hoje: () => Agora.telas.telaHoje(),
      lista: () => Agora.telasGestao.telaLista(),
      rotinas: () => Agora.telasGestao.telaRotinas(),
      ajustes: () => Agora.telasGestao.telaAjustes()
    };
    const secao = alvo(ui.tela);
    if (secao) secao.innerHTML = html[ui.tela]();

    document.querySelectorAll('.tela').forEach(s => s.classList.toggle('oculta', s.id !== `tela-${ui.tela}`));
    document.querySelectorAll('.aba').forEach(b => {
      const ativa = b.dataset.tela === ui.tela;
      b.classList.toggle('ativa', ativa);
      b.setAttribute('aria-current', ativa ? 'page' : 'false');
    });
    atualizarProjetos();
    marcarEntrada();
  }

  function irPara(tela) {
    ui.tela = tela;
    ui.expandida = '';
    refresh();
    window.scrollTo({ top: 0, behavior: C().estado.prefs.animacoes ? 'smooth' : 'auto' });
  }

  function atualizarProjetos() {
    const lista = document.getElementById('listaProjetos');
    if (!lista) return;
    lista.innerHTML = M().projetos().map(p => `<option value="${C().escapar(p)}">`).join('');
  }

  // A aba Lista mostra quantos itens esperam triagem: é o único contador do
  // app, e ele conta o que ainda não foi olhado — não o que está atrasado.
  function marcarEntrada() {
    const aba = document.querySelector('.aba[data-tela="lista"]');
    if (!aba) return;
    const n = M().naEntrada().length;
    aba.textContent = n ? `Lista · ${n}` : 'Lista';
  }

  function toast(mensagem, tipo, desfazer) {
    const el = document.getElementById('toast');
    if (!el) return;
    desfazerFn = typeof desfazer === 'function' ? desfazer : null;
    el.className = `toast visivel${tipo ? ' ' + tipo : ''}`;
    el.innerHTML = `<span>${C().escapar(mensagem)}</span>` +
      (desfazerFn ? ` <button type="button" class="link" data-acao="desfazer">desfazer</button>` : '');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { el.className = 'toast'; desfazerFn = null; }, desfazerFn ? 7000 : 4000);
  }

  function aplicarPrefs() {
    const p = C().estado.prefs;
    const raiz = document.documentElement;
    raiz.dataset.tema = p.tema;
    raiz.dataset.texto = p.texto;
    raiz.dataset.animacoes = p.animacoes ? 'sim' : 'nao';
    raiz.dataset.calmo = p.calmo ? 'sim' : 'nao';
    const btn = document.getElementById('btnCalmo');
    if (btn) {
      btn.setAttribute('aria-pressed', p.calmo ? 'true' : 'false');
      btn.textContent = p.calmo ? 'Sair do modo calmo' : 'Modo calmo';
    }
    const cor = { escuro: '#0d1117', claro: '#f6f7f9', sepia: '#efe8dc' }[p.tema] || '#0d1117';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', cor);
  }

  /* ---------- ações ---------- */

  function tarefaDo(el) {
    return M().porId(el.dataset.id);
  }

  const ACOES = {
    'def-tempo': el => {
      C().estado.prefs.tempoDisponivel = Number(el.dataset.min) || 30;
      ui.posicaoSugestao = 0;
      C().salvarLogo(); refresh();
    },
    'def-energia': el => {
      C().estado.prefs.energia = el.dataset.nivel;
      ui.posicaoSugestao = 0;
      C().salvarLogo(); refresh();
    },
    'trocar-sugestao': () => { ui.posicaoSugestao += 1; refresh(); },

    'def-min-tarefa': el => {
      const t = tarefaDo(el); if (!t) return;
      const min = Number(el.dataset.min) || 0;
      t.minutos = t.minutos === min ? 0 : min;
      promoverSeCompleta(t);
      C().salvar(); refresh();
    },
    'def-energia-tarefa': el => {
      const t = tarefaDo(el); if (!t) return;
      t.energia = t.energia === el.dataset.nivel ? '' : el.dataset.nivel;
      promoverSeCompleta(t);
      C().salvar(); refresh();
    },
    'organizar': el => {
      const t = tarefaDo(el); if (!t) return;
      M().organizar(t); C().salvar(); refresh();
    },

    'focar': el => {
      const t = tarefaDo(el); if (!t) return;
      if (F().ativo()) F().encerrar();
      F().iniciar(t.id, Number(el.dataset.min) || 25, 'foco');
      ui.ultimaTarefa = t.id;
      ui.tela = 'agora';
      refresh();
      toast(`Foco ligado: ${t.titulo}`);
    },
    'pausar-foco': () => { F().pausar(); refresh(); },
    'retomar-foco': () => { F().retomar(); refresh(); },
    'esticar-foco': el => { F().esticar(Number(el.dataset.min) || 5); refresh(); },
    'parar-foco': () => {
      const min = F().encerrar();
      refresh();
      toast(min ? `Foco encerrado: ${C().textoMinutos(min)} contados.` : 'Foco encerrado.');
    },
    'concluir-foco': el => {
      const t = tarefaDo(el);
      const min = F().encerrar();
      if (t) M().concluir(t);
      C().salvar(); refresh();
      toast(`Feito${min ? ` em ${C().textoMinutos(min)}` : ''}. Uma a menos.`, 'ok', t ? () => { M().reabrir(t); C().salvar(); refresh(); } : null);
    },
    'pausa-curta': () => {
      const anterior = F().atual();
      if (anterior && anterior.tarefaId) ui.ultimaTarefa = anterior.tarefaId;
      F().encerrar();
      F().iniciar('', 5, 'pausa');
      refresh();
      toast('Cinco minutos de pausa. Levante, beba água.');
    },

    'concluir': el => {
      const t = tarefaDo(el); if (!t) return;
      M().concluir(t); C().salvar(); refresh();
      toast(`Feito: ${t.titulo}`, 'ok', () => { M().reabrir(t); C().salvar(); refresh(); });
    },
    'reabrir': el => {
      const t = tarefaDo(el); if (!t) return;
      M().reabrir(t); C().salvar(); refresh();
    },
    'soltar': el => {
      const t = tarefaDo(el); if (!t) return;
      const antes = t.status;
      M().soltar(t); C().salvar(); refresh();
      toast('Soltou. Ela sai da frente e fica guardada em "soltas".', '', () => {
        t.status = antes === 'feita' ? 'ativa' : antes; M().tocar(t); C().salvar(); refresh();
      });
    },
    'adiar': el => {
      const t = tarefaDo(el); if (!t) return;
      const dias = Number(el.dataset.dias) || 1;
      M().adiar(t, dias); C().salvar();
      ui.posicaoSugestao = 0;
      refresh();
      toast(dias === 1 ? 'Combinado, fica para amanhã.' : `Volta a aparecer em ${dias} dias.`);
    },
    'por-em-hoje': el => {
      const t = tarefaDo(el); if (!t) return;
      M().marcarHoje(t, true); C().salvar(); refresh();
    },
    'tirar-de-hoje': el => {
      const t = tarefaDo(el); if (!t) return;
      M().marcarHoje(t, false); C().salvar(); refresh();
    },
    'excluir': el => {
      const t = tarefaDo(el); if (!t) return;
      if (!window.confirm(`Apagar "${t.titulo}" de vez? Isso não volta.`)) return;
      M().excluir(t.id); C().salvar(); refresh();
    },
    'abrir-tarefa': el => {
      ui.expandida = ui.expandida === el.dataset.id ? '' : el.dataset.id;
      refresh();
    },
    'abrir-passos': el => {
      ui.expandida = ui.expandida === el.dataset.id ? '' : el.dataset.id;
      refresh();
      const campo = document.querySelector(`.form-passo[data-id="${CSS.escape(el.dataset.id)}"] input`);
      if (campo) campo.focus();
    },
    'alternar-passo': el => {
      const t = tarefaDo(el); if (!t) return;
      M().alternarPasso(t, el.dataset.passo); C().salvar(); refresh();
    },
    'remover-passo': el => {
      const t = tarefaDo(el); if (!t) return;
      M().removerPasso(t, el.dataset.passo); C().salvar(); refresh();
    },
    'limpar-onde-parei': el => {
      const t = tarefaDo(el); if (!t) return;
      t.ondeParei = ''; M().tocar(t); C().salvar(); refresh();
    },

    'alternar-rotina': el => {
      const r = Agora.rotinas.porId(el.dataset.id); if (!r) return;
      const marcou = Agora.rotinas.alternar(r, C().hojeISO());
      C().salvar(); refresh();
      if (marcou) toast(`${r.nome}: ${Agora.rotinas.sequencia(r)} dias seguidos.`, 'ok');
    },
    'remover-rotina': el => {
      const r = Agora.rotinas.porId(el.dataset.id); if (!r) return;
      if (!window.confirm(`Apagar a rotina "${r.nome}" e o histórico dela?`)) return;
      Agora.rotinas.remover(r.id); C().salvar(); refresh();
    },

    'exportar-json': () => Agora.backup.exportarJson(),
    'exportar-csv-tarefas': () => Agora.backup.exportarTarefas(),
    'exportar-csv-sessoes': () => Agora.backup.exportarSessoes(),
    'importar-json': () => {
      const campo = document.getElementById('arquivoImportar');
      if (campo) campo.click();
    },
    'limpar-feitas': () => {
      const limite = C().somaDias(C().hojeISO(), -30);
      const antes = C().estado.tarefas.length;
      C().estado.tarefas = C().estado.tarefas.filter(t => !(t.status === 'feita' && String(t.feitoEm).slice(0, 10) < limite));
      const removidas = antes - C().estado.tarefas.length;
      C().salvar(); refresh();
      toast(removidas ? `${removidas} concluídas antigas apagadas.` : 'Nada antigo para apagar.');
    },
    'zerar': () => {
      if (!window.confirm('Isso apaga tarefas, rotinas e histórico deste aparelho. Exportou o backup antes?')) return;
      if (!window.confirm('Tem certeza? Não dá para desfazer.')) return;
      C().trocarEstado(C().estadoPadrao());
      aplicarPrefs(); refresh();
      toast('Tudo limpo.');
    },
    'desfazer': () => {
      const fn = desfazerFn;
      desfazerFn = null;
      const el = document.getElementById('toast');
      if (el) el.className = 'toast';
      if (fn) fn();
    }
  };

  function promoverSeCompleta(t) {
    if (t.status === 'entrada' && t.minutos && t.energia) M().organizar(t);
    else M().tocar(t);
  }

  /* ---------- eventos ---------- */

  function ligarEventos() {
    document.addEventListener('click', ev => {
      const abaBtn = ev.target.closest('.aba');
      if (abaBtn) { irPara(abaBtn.dataset.tela); return; }

      const botaoCalmo = ev.target.closest('#btnCalmo');
      if (botaoCalmo) { alternarCalmo(); return; }

      const el = ev.target.closest('[data-acao]');
      if (!el || el.tagName === 'FORM') return;
      const acao = ACOES[el.dataset.acao];
      if (!acao) return;
      acao(el, ev);
    });

    document.addEventListener('submit', ev => {
      const form = ev.target.closest('form');
      if (!form) return;

      if (form.id === 'formCaptura') {
        ev.preventDefault();
        capturar();
        return;
      }
      if (form.dataset.acao === 'add-passo') {
        ev.preventDefault();
        const t = M().porId(form.dataset.id);
        const campo = form.querySelector('input[name="passo"]');
        if (t && campo && campo.value.trim()) {
          M().addPasso(t, campo.value);
          C().salvar();
          campo.value = '';
          refresh();
          const novo = document.querySelector(`.form-passo[data-id="${CSS.escape(t.id)}"] input`);
          if (novo) novo.focus();
        }
        return;
      }
      if (form.dataset.acao === 'add-rotina') {
        ev.preventDefault();
        const nome = form.querySelector('input[name="nome"]').value;
        const quando = form.querySelector('select[name="quando"]').value;
        const dias = [...form.querySelectorAll('input[name="dia"]:checked')].map(c => Number(c.value));
        if (quando === 'dias' && !dias.length) { toast('Marque pelo menos um dia da semana.', 'erro'); return; }
        if (!Agora.rotinas.criar(nome, quando, dias, 0)) { toast('Escreva o nome da rotina.', 'erro'); return; }
        C().salvar(); refresh();
        toast('Rotina criada.');
      }
    });

    // Texto: grava enquanto digita (sem redesenhar) e redesenha ao sair.
    document.addEventListener('input', ev => {
      const el = ev.target;
      if (el.id === 'filtroTexto') {
        ui.filtro.texto = el.value;
        clearTimeout(ligarEventos.filtroTimer);
        ligarEventos.filtroTimer = setTimeout(() => {
          refresh();
          const campo = document.getElementById('filtroTexto');
          if (campo) { campo.focus(); campo.setSelectionRange(campo.value.length, campo.value.length); }
        }, 250);
        return;
      }
      if (!el.dataset || !el.dataset.campo) return;
      const t = M().porId(el.dataset.id);
      if (!t) return;
      if (['titulo', 'notas', 'projeto', 'ondeParei'].includes(el.dataset.campo)) {
        t[el.dataset.campo] = el.value;
        M().tocar(t);
        C().salvarLogo();
      }
    });

    document.addEventListener('change', ev => {
      const el = ev.target;

      if (el.dataset && el.dataset.pref) {
        const p = C().estado.prefs;
        const nome = el.dataset.pref;
        if (el.type === 'checkbox') p[nome] = el.checked;
        else if (nome === 'limiteHoje') p[nome] = C().limitar(el.value, 1, 9);
        else p[nome] = el.value;
        if (nome === 'avisos' && el.checked) {
          F().pedirPermissao().then(ok => {
            if (!ok) { p.avisos = false; C().salvar(); refresh(); toast('O navegador não liberou os avisos. O som continua funcionando.', 'erro'); }
          });
        }
        C().salvar(); aplicarPrefs(); refresh();
        return;
      }

      if (!el.dataset || !el.dataset.campo) return;
      const t = M().porId(el.dataset.id);
      if (!t) return;
      const campo = el.dataset.campo;
      if (campo === 'minutos') t.minutos = Math.max(0, Number(el.value) || 0);
      else if (campo === 'energia') t.energia = M().ENERGIAS.includes(el.value) ? el.value : '';
      else if (campo === 'dia' || campo === 'prazo') t[campo] = el.value || '';
      else t[campo] = el.value;
      if (campo === 'titulo' && !String(t.titulo).trim()) { t.titulo = 'Sem título'; el.value = t.titulo; }
      if (campo === 'projeto') { t.projeto = String(t.projeto || '').trim().toLowerCase().slice(0, 24); el.value = t.projeto; }
      promoverSeCompleta(t);
      C().salvar();

      // Campo de texto NÃO redesenha ao sair. O `change` de um campo de texto
      // dispara no blur — ou seja, no meio do clique que a pessoa acabou de
      // dar em um botão. Redesenhar aqui troca o botão por outro elemento
      // entre o apertar e o soltar, e o clique se perde no caminho.
      if (['titulo', 'notas', 'projeto', 'ondeParei'].includes(campo)) return;
      refresh();
    });

    const arquivo = document.getElementById('arquivoImportar');
    if (arquivo) {
      arquivo.addEventListener('change', () => {
        const f = arquivo.files && arquivo.files[0];
        if (!f) return;
        Agora.backup.importarJson(f, (ok, msg) => {
          arquivo.value = '';
          if (ok) { aplicarPrefs(); refresh(); }
          toast(msg, ok ? 'ok' : 'erro');
        });
      });
    }

    document.addEventListener('keydown', atalhos);

    // Fechar a conta das gravações adiadas antes de a página sumir.
    window.addEventListener('pagehide', () => C().fecharConta());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) C().fecharConta();
      else if (F().ativo()) refresh();
    });
  }

  function capturar() {
    const campo = document.getElementById('campoCaptura');
    if (!campo) return;
    const texto = campo.value.trim();
    if (!texto) return;
    const tarefa = M().novaTarefa(texto);
    if (!tarefa) return;
    C().estado.tarefas.push(tarefa);
    C().salvar();
    campo.value = '';
    campo.focus();
    refresh();

    const lidos = [];
    if (tarefa.projeto) lidos.push('#' + tarefa.projeto);
    if (tarefa.minutos) lidos.push(C().textoMinutos(tarefa.minutos));
    if (tarefa.energia) lidos.push(M().ROTULO_ENERGIA[tarefa.energia]);
    if (tarefa.dia) lidos.push(C().textoDoDia(tarefa.dia));
    if (tarefa.prazo) lidos.push('prazo ' + C().textoDoDia(tarefa.prazo));
    toast(`Guardado${lidos.length ? ': ' + lidos.join(' · ') : '. Está fora da sua cabeça.'}`, 'ok',
      () => { M().excluir(tarefa.id); C().salvar(); refresh(); });
  }

  function alternarCalmo() {
    const p = C().estado.prefs;
    p.calmo = !p.calmo;
    if (p.calmo) ui.tela = 'agora';
    C().salvar();
    aplicarPrefs();
    refresh();
  }

  function atalhos(ev) {
    const alvoEl = ev.target;
    const digitando = alvoEl && (alvoEl.tagName === 'INPUT' || alvoEl.tagName === 'TEXTAREA' || alvoEl.tagName === 'SELECT' || alvoEl.isContentEditable);

    if (ev.key === 'Escape') {
      if (digitando) { alvoEl.blur(); return; }
      if (C().estado.prefs.calmo) { alternarCalmo(); return; }
      if (ui.expandida) { ui.expandida = ''; refresh(); }
      return;
    }
    if (digitando || ev.ctrlKey || ev.metaKey || ev.altKey) return;

    const telas = ['agora', 'hoje', 'lista', 'rotinas', 'ajustes'];
    if (/^[1-5]$/.test(ev.key)) { irPara(telas[Number(ev.key) - 1]); return; }

    const tecla = ev.key.toLowerCase();
    if (tecla === 'n') {
      ev.preventDefault();
      const campo = document.getElementById('campoCaptura');
      if (campo) campo.focus();
      return;
    }
    if (tecla === 'c') { alternarCalmo(); return; }
    if (ev.key === ' ' && F().ativo()) {
      ev.preventDefault();
      if (F().emPausa()) F().retomar(); else F().pausar();
      refresh();
    }
  }

  /* ---------- tick do foco ---------- */

  function tick() {
    if (!F().ativo()) {
      if (document.title !== tituloOriginal) document.title = tituloOriginal;
      return;
    }
    const restante = F().restanteMs();
    const acabou = restante <= 0;

    if (F().verificarFim()) {
      refresh();
      toast(F().atual() && F().atual().tipo === 'pausa' ? 'Pausa terminada.' : 'Tempo cumprido. Terminou ou quer esticar?', 'ok');
      return;
    }

    const relogio = document.getElementById('relogioFoco');
    if (relogio) {
      relogio.textContent = C().relogio(Math.abs(restante));
      const barra = document.getElementById('barraFoco');
      if (barra) barra.style.width = `${Math.round(F().progresso() * 100)}%`;
      const legenda = document.getElementById('legendaFoco');
      if (legenda && acabou) legenda.textContent = 'tempo cumprido — o extra está sendo contado';
    }
    // Título da aba vira relógio: dá para acompanhar sem voltar para o app.
    document.title = `${acabou ? '+' : ''}${C().relogio(Math.abs(restante))} · ${F().atual().titulo}`;
  }

  /* ---------- service worker ---------- */

  function registrarOffline() {
    if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
    navigator.serviceWorker.register('./sw.js').catch(() => { /* sem offline, o app segue */ });
  }

  /* ---------- início ---------- */

  function iniciar() {
    C().carregar();
    aplicarPrefs();

    const recuperado = F().recuperarAoAbrir();
    refresh();
    if (recuperado) {
      toast(recuperado.minutos
        ? `Um foco tinha ficado aberto em "${recuperado.titulo}". Registrei ${C().textoMinutos(recuperado.minutos)}.`
        : 'Um foco antigo ficou aberto e foi encerrado.');
    }

    ligarEventos();
    setInterval(tick, 500);

    const rodape = document.getElementById('rodapeVersao');
    if (rodape) rodape.textContent = `Agora ${C().APP_VERSION} · funciona offline · atalhos: N anota, 1–5 troca de tela, C modo calmo, espaço pausa o foco`;

    registrarOffline();
  }

  Agora.app = { ui, refresh, irPara, toast, aplicarPrefs, iniciar };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
