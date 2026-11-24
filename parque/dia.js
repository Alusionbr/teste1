/*
 * dia.js — almoço e plano do dia.
 *
 * Almoço: o horário é escolhido em Ajustes (padrão 11:30). O app avisa 15 min
 * antes e mostra os restaurantes oficiais, os mais perto primeiro, com a fila
 * ao vivo quando alguém informou.
 *
 * Sobre o pico: a dica comum de quem frequenta o parque é que 12:00–13:30 é o
 * horário de restaurante mais cheio. NÃO é dado do parque: é heurística, e a
 * tela diz isso. O que vale é a fila informada pelos visitantes.
 *
 * Plano do dia: monta uma linha do tempo simulada a partir de agora:
 *   antes do almoço   brinquedos disputados, do mais perto para o mais longe
 *   almoço            restaurante com refeição mais perto de onde você parou
 *   durante o Hot Wheels Epic Show (janela dos disputados) → disputados de novo
 *   tarde             brinquedos que sobraram, favoritos primeiro
 *   noite             shows de fim de tarde (O Sonho do Cowboy, No Ritmo de Trolls)
 * Respeita altura, tira pagos à parte e o que já foi marcado como "já fui".
 * Os tempos de fila são estimativas (25 min disputado, 10 min os outros) e
 * viram a fila ao vivo quando existe.
 */
"use strict";

const DIA = (() => {
  const ALMOCO_MIN = 45;
  const PICO = ["12:00", "13:30"];
  const INICIO_PADRAO = "09:30";
  const FIM_DIA = "19:30";
  const FILA_DISPUTADO = 25;
  const FILA_NORMAL = 10;
  const FILA_JANELA = 10;
  const BRINQUEDO = new Set(["montanha", "atracao", "aquatico", "infantil"]);

  function parse(hm, base) {
    const [h, m] = hm.split(":").map(Number);
    const d = base ? new Date(base) : new Date();
    d.setHours(h, m, 0, 0);
    return d;
  }

  const hm = d => d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const hoje = () => new Date().toLocaleDateString("sv-SE");
  const almocoHm = () => STORE.data.almocoHm || "11:30";
  const almocoIni = () => parse(almocoHm());
  const jaAlmocou = () => STORE.data.almocouEm === hoje();

  function marcarAlmoco(on) {
    STORE.data.almocouEm = on ? hoje() : "";
    STORE.save();
  }

  function minutos(d, agora) {
    return Math.round((d - (agora || new Date())) / 60000);
  }

  // Em que pé está o almoço agora.
  function fase(agora) {
    agora = agora || new Date();
    if (jaAlmocou()) return { tipo: "feito", min: 0 };
    const min = minutos(almocoIni(), agora);
    if (min > 15) return { tipo: "antes", min };
    if (min >= -30) return { tipo: "hora", min };
    return { tipo: parse(PICO[1]) > agora ? "pico" : "depois", min };
  }

  function noPico(agora) {
    agora = agora || new Date();
    return agora >= parse(PICO[0]) && agora <= parse(PICO[1]);
  }

  // Restaurantes: refeição de verdade primeiro; com posição, do mais perto; sem posição por último.
  function restaurantes(me, tipos) {
    const lista = LUGARES.oficiais().filter(p => p.oficial.comida && (!tipos || tipos.includes(p.oficial.tipo)));
    const rank = p => (p.oficial.refeicao ? 0 : 1);
    const dist = p => (p.x == null ? Infinity : me ? GEO.dist(me, p) : 0);
    return lista.sort((a, b) => rank(a) - rank(b) || dist(a) - dist(b) || a.name.localeCompare(b.name, "pt-BR"));
  }

  // Mais perto com posição; nunca escolhe sozinho um lugar pago à parte (Excalibur).
  function maisPerto(me, tipos) {
    return restaurantes(me, tipos).find(p => p.x != null && !p.oficial.pago) || null;
  }

  // ---- plano do dia ---------------------------------------------------------

  function montar(me, agora) {
    agora = agora || new Date();
    let t = new Date(agora);
    const inicio = parse(INICIO_PADRAO);
    if (t < inicio) t = inicio;
    const fim = parse(FIM_DIA);
    const ini = almocoIni();
    const feitos = STORE.data.done;
    const favs = STORE.data.favorites;
    let almocou = jaAlmocou();
    let pos = me ? { x: me.x, y: me.y } : null;
    const passos = [];
    const conflitos = [];

    const todos = LUGARES.oficiais();
    const livres = p => BRINQUEDO.has(p.cat) && !p.oficial.ver && !p.oficial.pago && !feitos[p.id] && SHOW.cabe(p.oficial);
    const brinq = todos.filter(p => p.x != null && livres(p));
    const semPosicao = todos.filter(p => p.x == null && livres(p));

    const janelas = SHOW.sessoes().filter(s => s.show.id === "of-hw-epic-show");
    const emJanela = d => janelas.some(s => d >= new Date(s.inicio.getTime() - 10 * 60000) && d <= s.fim);
    const escolhas = STORE.data.showChoices || {};
    const noturnos = SHOW.sessoes().filter(s => s.inicio >= t && (escolhas[SHOW.sessionKey(s)] || (!s.show.grande && s.inicio.getHours() >= 17)));
    const lugarDoShow = id => todos.find(p => p.id === id);

    const andar = (a, b) => (a && b && b.x != null ? GEO.walkMinutes(GEO.dist(a, b)) : 0);
    const fila = (p, janela) => {
      const live = FILAS.info(p.id);
      if (live) return { min: live.min, tipo: live.shared ? "ao vivo" : "anotada" };
      if (janela) return { min: FILA_JANELA, tipo: "estimada (show em andamento)" };
      return { min: p.oficial.disputado ? FILA_DISPUTADO : FILA_NORMAL, tipo: "estimada" };
    };

    // Vai ao show: chega uns 10 min antes e fica até o fim estimado.
    const agendarShow = sh => {
      const alvo = lugarDoShow(sh.show.id);
      const a = alvo ? andar(pos, alvo) : 0;
      const chega = new Date(Math.max(t.getTime() + a * 60000, sh.inicio.getTime() - 10 * 60000));
      if (sh.fim > fim || chega >= sh.fim || chega > fim) {
        if (escolhas[SHOW.sessionKey(sh)]) conflitos.push(`${sh.show.name} às ${sh.hm}: não dá para chegar dentro do horário planejado.`);
        sh.feito = true; return false;
      }
      passos.push({ tipo: "show", quando: chega, place: alvo || { name: sh.show.name, id: sh.show.id, x: null }, andar: a, sessao: sh, fixo: !!escolhas[SHOW.sessionKey(sh)] });
      sh.feito = true;
      t = new Date(sh.fim);
      if (alvo && alvo.x != null) pos = { x: alvo.x, y: alvo.y };
      return true;
    };

    let guarda = 0;
    while (t < fim && guarda++ < 60) {
      // Almoço
      if (!almocou && t >= ini) {
        const r = maisPerto(pos, ["refeicao"]) || maisPerto(pos);
        const duracao = ALMOCO_MIN + andar(pos, r);
        if (new Date(t.getTime() + duracao * 60000) > fim) break;
        passos.push({ tipo: "almoco", quando: new Date(t), place: r, andar: andar(pos, r), dur: ALMOCO_MIN });
        t = new Date(t.getTime() + duracao * 60000);
        if (r) pos = { x: r.x, y: r.y };
        almocou = true;
        continue;
      }
      const show = noturnos.find(s => !s.feito);
      if (!brinq.length) {
        if (show) { agendarShow(show); continue; }
        break;
      }

      // Escolha: antes do almoço e na janela do Hot Wheels Epic Show → disputados; fora disso → os outros.
      const janela = emJanela(t);
      const disputados = brinq.filter(p => p.oficial.disputado);
      const outros = brinq.filter(p => !p.oficial.disputado);
      const quer = janela || t < ini ? disputados : outros;
      const pool = quer.length ? quer : brinq;
      const nota = p => (pos ? GEO.dist(pos, p) : 0) - (favs[p.id] ? 120 : 0);
      const escolha = pool.reduce((m, p) => (nota(p) < nota(m) ? p : m), pool[0]);

      const a = andar(pos, escolha);
      const f = fila(escolha, janela);
      const chega = new Date(t.getTime() + a * 60000);
      const termina = new Date(chega.getTime() + (f.min + 6) * 60000);
      if (termina > fim) break;

      // Se este brinquedo faria perder o próximo show, vai ao show antes.
      if (show) {
        const alvo = lugarDoShow(show.show.id);
        const volta = alvo && alvo.x != null ? GEO.walkMinutes(GEO.dist(escolha, alvo)) : 0;
        if (termina.getTime() + volta * 60000 > show.inicio.getTime() - 10 * 60000) { agendarShow(show); continue; }
      }

      brinq.splice(brinq.indexOf(escolha), 1);
      passos.push({ tipo: "brinquedo", quando: chega, place: escolha, andar: a, fila: f, janela: janela && escolha.oficial.disputado });
      t = termina;
      pos = { x: escolha.x, y: escolha.y };
    }
    return { passos, semPosicao, conflitos, termina: t, comeca: passos.length ? passos[0].quando : t };
  }

  return {
    PICO, ALMOCO_MIN, almocoHm, almocoIni, jaAlmocou, marcarAlmoco, fase, noPico, minutos,
    restaurantes, maisPerto, montar, hm
  };
})();
