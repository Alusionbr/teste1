/*
 * lugares.js — junta as três fontes de lugares num catálogo só:
 *
 *   1. Lista oficial do parque (oficial.js): nome certo, altura, horário.
 *   2. OpenStreetMap (park-data.js): posição de boa parte das atrações.
 *   3. Comunidade (Supabase, parque.lugares): posições marcadas por quem está
 *      no parque — atrações que o OSM não tem, bebedouros, lixeiras,
 *      banheiros, lanchonetes, lojas…
 *
 * Regra de posição de uma atração oficial, da mais confiável para a menos:
 *   1. OSM (medido no mapa)                         fonte "mapa"
 *   2. mediana das marcações da comunidade          fonte "comunidade"
 *   3. pista do texto oficial ("ao lado do X")      fonte "aprox"
 *   4. centro da área temática (AREAS, oficial.js)  fonte "aprox"
 *   5. nada: fica na lista com "Estou aqui agora"   fonte "sem-posicao"
 * Posição aproximada (3 e 4) sai com marcador tracejado e aviso; é um ponto
 * de partida honesto, nunca apresentado como medido.
 *
 * Marcações de comunidade a menos de JUNTAR_M metros e do mesmo tipo viram
 * um ponto só (vários visitantes marcando o mesmo bebedouro).
 */
"use strict";

const LUGARES = (() => {
  const POLL_MS = 5 * 60000;
  const JUNTAR_M = 12;

  // Tipos que o visitante pode marcar (o "kind" no servidor).
  const TIPOS = {
    bebedouro:  { label: "Bebedouro",          icon: "🚰" },
    banheiro:   { label: "Banheiro",           icon: "🚻" },
    lixeira:    { label: "Lixeira",            icon: "🗑️" },
    comida:     { label: "Lanchonete / comida", icon: "🍔" },
    loja:       { label: "Loja",               icon: "🛍️" },
    socorro:    { label: "Primeiros socorros", icon: "⛑️" },
    fraldario:  { label: "Fraldário",          icon: "🚼" },
    guarda:     { label: "Guarda-volumes",     icon: "🧳" },
    carregador: { label: "Carregar celular",   icon: "🔌" },
    descanso:   { label: "Sombra / descanso",  icon: "🪑" },
    info:       { label: "Informações",        icon: "ℹ️" },
    saida:      { label: "Entrada / saída",    icon: "🚪" },
    foto:       { label: "Ponto de foto",      icon: "📸" }
  };

  let crowd = [];             // linhas do servidor: {id, kind, ref_id, name, lat, lon, at}
  let timer = 0;
  const listeners = [];

  const TODOS_OFICIAIS = OFICIAL.concat(COMIDA);
  const TIPO_COMIDA = { refeicao: "Refeição", lanche: "Lanche", doce: "Doce", bebida: "Bebida" };

  const oficialPorOsm = new Map();
  for (const o of TODOS_OFICIAIS) for (const id of o.osm || []) oficialPorOsm.set(id, o);
  const osmPorId = new Map(PARK_DATA.pois.map(p => [p.id, p]));

  function mediana(nums) {
    const s = nums.slice().sort((a, b) => a - b);
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  function infoOficial(o) {
    const info = [];
    if (o.comida) {
      info.push(`${TIPO_COMIDA[o.tipo] || "Comida"}${o.desc ? ": " + o.desc : ""}`);
      if (o.textoLocal) info.push(`Fica ${o.textoLocal} (texto oficial).`);
    }
    if (o.area) info.push(`Área: ${o.area}`);
    if (o.altura) info.push(`Altura mínima: ${o.altura.toFixed(2).replace(".", ",")} m`);
    if (o.horarios) info.push(`Sessões: ${o.horarios.join(", ")}`);
    if (o.pago) info.push("💲 Pago à parte");
    if (o.nota) info.push(o.nota);
    return info;
  }

  function centroDeAncoras(refs) {
    const pts = refs.map(id => osmPorId.get(id)).filter(Boolean);
    if (!pts.length) return null;
    return { x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length };
  }

  // Atrações e alimentação oficiais, cada uma com a melhor posição disponível.
  function oficiais() {
    const out = [];
    const porArea = {};
    for (const o of TODOS_OFICIAIS) {
      const base = { id: o.id, name: o.name, cat: o.cat, info: infoOficial(o), oficial: o, x: null, y: null, fonte: "sem-posicao" };
      out.push(base);
      const osm = (o.osm || []).map(id => osmPorId.get(id)).find(Boolean);
      const marcas = crowd.filter(c => c.kind === "atracao" && c.ref_id === o.id);
      if (osm) { Object.assign(base, { x: osm.x, y: osm.y, fonte: "mapa" }); continue; }
      if (marcas.length) {
        const xy = marcas.map(c => GEO.toXY(c.lat, c.lon));
        Object.assign(base, { x: mediana(xy.map(p => p.x)), y: mediana(xy.map(p => p.y)), fonte: "comunidade", marcas: marcas.length });
        continue;
      }
      const ref = o.perto && osmPorId.get(o.perto.ref);
      if (ref) {
        Object.assign(base, { x: ref.x + o.perto.dx, y: ref.y + o.perto.dy, fonte: "aprox", aproxTexto: `${o.perto.texto} (texto oficial)` });
        continue;
      }
      if (o.area && AREAS[o.area]) (porArea[o.area] = porArea[o.area] || []).push(base);
    }
    // Quem só tem a área: espalha em anel em volta do centro, para os marcadores não se empilharem.
    for (const [area, lista] of Object.entries(porArea)) {
      const c = centroDeAncoras(AREAS[area].ancoras);
      if (!c) continue;
      const raio = lista.length === 1 ? 0 : Math.min(45, 14 + lista.length * 5);
      lista.forEach((item, i) => {
        const ang = (i / lista.length) * 2 * Math.PI + 0.6;
        const tema = item.oficial.areaTema ? " pelo tema" : "";
        Object.assign(item, {
          x: c.x + raio * Math.cos(ang), y: c.y + raio * Math.sin(ang), fonte: "aprox",
          aproxTexto: `área ${area}${tema}${AREAS[area].nota ? ". " + AREAS[area].nota : ""}`
        });
      });
    }
    return out;
  }

  // Lugares do OSM que não são atração oficial (banheiros, restaurantes,
  // estacionamentos e os prédios de atrações que saíram da lista).
  function osmExtras() {
    return PARK_DATA.pois.filter(p => !oficialPorOsm.has(p.id)).map(p => {
      const aviso = OSM_FORA_DA_LISTA[p.id];
      return aviso
        ? Object.assign({}, p, { info: [aviso].concat(p.info || []), fechado: !/pode ser a mesma/.test(aviso) })
        : p;
    });
  }

  // Marcações de comunidade (fora atrações) agrupadas por proximidade.
  function comunidade() {
    const grupos = [];
    for (const c of crowd) {
      if (c.kind === "atracao" || !TIPOS[c.kind]) continue;
      const xy = GEO.toXY(c.lat, c.lon);
      const g = grupos.find(g => g.kind === c.kind && GEO.dist(g, xy) < JUNTAR_M);
      if (g) {
        g.pts.push(xy);
        g.ids.push(c.id);
        g.x = g.pts.reduce((s, p) => s + p.x, 0) / g.pts.length;
        g.y = g.pts.reduce((s, p) => s + p.y, 0) / g.pts.length;
        if (!g.name && c.name) g.name = c.name;
      } else grupos.push({ kind: c.kind, x: xy.x, y: xy.y, pts: [xy], ids: [c.id], name: c.name });
    }
    return grupos.map(g => ({
      id: "c-" + g.kind + "-" + g.ids[0],
      name: g.name || TIPOS[g.kind].label,
      cat: g.kind,
      x: g.x, y: g.y,
      info: [`Marcado por ${g.pts.length === 1 ? "1 visitante" : g.pts.length + " visitantes"}`],
      comunidade: g
    }));
  }

  function todos() {
    return oficiais().concat(osmExtras(), comunidade());
  }

  async function refresh() {
    if (document.visibilityState === "hidden") return;
    try {
      crowd = (await GROUP.rpc("parque_lugares", {})) || [];
      for (const fn of listeners) fn();
    } catch (e) {
      // Sem internet: segue com a última lista recebida.
    }
  }

  function minhas() {
    return STORE.data.crowdIds || (STORE.data.crowdIds = []);
  }

  // Marca um lugar no servidor. kind "atracao" exige refId (id oficial).
  async function marcar(kind, xy, refId, name) {
    const ll = GEO.toLatLon(xy.x, xy.y);
    const id = await GROUP.rpc("parque_lugar_add", {
      p_kind: kind, p_ref: refId || null, p_name: name || "", p_lat: ll.lat, p_lon: ll.lon, p_device: STORE.deviceId()
    });
    minhas().push(id);
    STORE.save();
    await refresh();
    return id;
  }

  async function desmarcar(ids) {
    const meus = ids.filter(id => minhas().includes(id));
    for (const id of meus) await GROUP.rpc("parque_lugar_del", { p_id: id, p_device: STORE.deviceId() });
    STORE.data.crowdIds = minhas().filter(id => !meus.includes(id));
    STORE.save();
    await refresh();
    return meus.length;
  }

  function souAutor(place) {
    return !!(place.comunidade && place.comunidade.ids.some(id => minhas().includes(id)));
  }

  function start() {
    clearInterval(timer);
    refresh();
    timer = setInterval(refresh, POLL_MS);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") refresh();
    });
  }

  return {
    TIPOS, todos, oficiais, refresh, marcar, desmarcar, souAutor, start,
    oficialDe: id => TODOS_OFICIAIS.find(o => o.id === id) || null,
    onChange(fn) { listeners.push(fn); }
  };
})();
