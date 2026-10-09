"use strict";
(function(){
  const SEARCH_VERSION="4.0";
  let searchRequest=0;
  if(localStorage.getItem("estante:search-engine")!==SEARCH_VERSION){state.source="smart";localStorage.setItem("estante:search-engine",SEARCH_VERSION);updatePrefs()}
  const REQUIRED_SOURCE={vagalume:"vagalume",excerpt:"vagalume",lrclib:"lrclib"};
  let lastProbe=0;
  const sourceAvailable=name=>navigator.onLine&&sourceStatus[name]?.ok===true;
  function syncSourceUI(){
    const required=REQUIRED_SOURCE[state.source];
    if(required&&(!navigator.onLine||sourceStatus[required]?.ok===false)){
      state.source="smart";updatePrefs();
    }
    document.querySelectorAll(".chip[data-source]").forEach(button=>{
      const needed=REQUIRED_SOURCE[button.dataset.source],available=!needed||sourceAvailable(needed);
      button.hidden=!available;button.disabled=!available;
      button.classList.toggle("active",button.dataset.source===state.source);
    });
    $("searchInput").placeholder=state.source==="excerpt"?"Um trecho da letra":state.source==="smart"?"Música, artista, trecho ou versão":"Artista e música";
  }
  async function probeSource(name,url){
    const previous=sourceStatus[name];
    try{
      const options=name==="lrclib"?{headers:LRCLIB_HEADERS}:{};
      const response=await fetchSafe(url,options,8000);
      if(sourceStatus[name]!==previous)return;
      if(!response.ok){markSource(name,false,response.status);return}
      const body=await response.json();
      const valid=name==="lrclib"?Array.isArray(body):Array.isArray(body?.response?.docs);
      if(sourceStatus[name]===previous)markSource(name,valid,valid?undefined:"resposta inválida");
    }catch(error){if(sourceStatus[name]===previous)markSource(name,false,error.message)}
  }
  function probeSources(){
    if(!navigator.onLine||document.hidden)return;
    lastProbe=Date.now();
    probeSource("lrclib","https://lrclib.net/api/search?track_name=Amazing%20Grace&artist_name=John%20Newton");
    probeSource("vagalume","https://api.vagalume.com.br/search.artmus?q=amor&limit=1");
  }
  window.addEventListener("estante:source-status",event=>{if(["lrclib","vagalume"].includes(event.detail.name))syncSourceUI()});
  window.addEventListener("estante:prefs-loaded",syncSourceUI);
  window.addEventListener("online",()=>{syncSourceUI();probeSources()});
  window.addEventListener("offline",syncSourceUI);
  document.addEventListener("visibilitychange",()=>{if(!document.hidden&&Date.now()-lastProbe>=300000)probeSources()});
  setInterval(()=>{if(Date.now()-lastProbe>=300000)probeSources()},60000);
  document.querySelectorAll(".chip[data-source]").forEach(button=>button.onclick=()=>{
    const needed=REQUIRED_SOURCE[button.dataset.source];if(needed&&!sourceAvailable(needed))return;
    state.source=button.dataset.source;syncSourceUI();updatePrefs();if($("searchInput").value.trim())$("searchForm").requestSubmit();
  });
  /*
   * Mostra o erro e, quando a fonte caiu, um atalho para repetir na Inteligente.
   *
   * No modo Trecho o atalho seria promessa falsa: procurar por um pedaço da
   * letra depende só do Vagalume — LRCLIB, Deezer, Apple e MusicBrainz comparam
   * título, artista e álbum, nunca o texto. Então ali a mensagem diz a verdade
   * e aponta o que de fato funciona: o que já está no aparelho.
   */
  function notifySourceError(err,q,achadosLocais,requestedMode){
    if(!err.source){notify(navigator.onLine?`Falha na busca: ${err.message}`:"Você está offline. O repertório salvo continua funcionando.");return}
    if(requestedMode==="excerpt"){
      notify(`${err.message} Procurar por um pedaço da letra depende só dele — as outras fontes comparam título e artista, nunca o texto. ${achadosLocais?`Enquanto isso, ${plural(achadosLocais,"música do seu repertório ou do acervo bate","músicas do seu repertório ou do acervo batem")} com esse trecho.`:"Nada no seu repertório ou no acervo bate com esse trecho."}`);
      return;
    }
    if(state.source==="smart")return notify(`${err.message} As demais fontes não acharam outra versão agora.`);
    notify(`${err.message} A busca Inteligente combina as outras fontes.`,false,{label:"Tentar na Inteligente",run:()=>{state.source="smart";syncSourceUI();updatePrefs();$("searchInput").value=q;$("searchForm").requestSubmit()}});
  }
  // O catálogo identifica a gravação antes de a fonte de letras responder.
  // Para uma busca exata por título + artista, confirme a letra em segundo plano
  // sem atrasar a lista nem aceitar texto de outra versão.
  async function enrichExactLyric(q,remotos,requestId){
    const requested=searchTokens(cleanEdition(q));if(requested.size<3)return;
    const exact=remotos.find(song=>{
      if(song.lyrics||song.synced||!song.artist)return false;
      const candidate=searchTokens(`${song.title} ${song.artist}`);
      return candidate.size===requested.size&&[...requested].every(token=>candidate.has(token));
    });
    if(!exact)return;
    try{
      const lyrics=await fetchLiriqoExact(exact.title,exact.artist);
      if(!lyrics||requestId!==searchRequest||state.current===exact||!state.results.includes(exact))return;
      exact.lyrics=lyrics;exact.source="LiriQo";exact.sources=[...new Set([...(exact.sources||[]),"LiriQo"])];
      if(state.tab==="results")renderList();
    }catch{}
  }
  const plural=(n,s,p)=>`${n} ${n===1?s:p}`;
  $("searchForm").onsubmit=async e=>{e.preventDefault();const q=$("searchInput").value.trim();if(!q)return;
    const required=REQUIRED_SOURCE[state.source];if(required&&!sourceAvailable(required)){state.source="smart";syncSourceUI();updatePrefs()}
    const requestedMode=state.source,requestId=++searchRequest;
    // Repertório salvo + acervo do site são procurados sempre, antes de
    // qualquer rede: respondem na hora, funcionam offline e são a única busca
    // que acha por trecho sem depender do Vagalume.
    let locais=searchLocal(q);
    state.results=locais;state.tab="results";renderList();
    notify(locais.length?`${plural(locais.length,"resultado local","resultados locais")} enquanto consulto as fontes…`:"Procurando no acervo e nas fontes…",true);
    const acervo=await searchAcervo(q);if(requestId!==searchRequest)return;
    locais=withLocalFirst(locais,acervo);state.results=locais;renderList();
    if(!navigator.onLine){
      state.results=locais;state.tab="results";renderList();
      return notify(locais.length
        ?`Sem internet: ${plural(locais.length,"música encontrada","músicas encontradas")} no seu repertório e no acervo do site. Buscar fontes novas precisa de rede.`
        :"Você está offline e nada no seu repertório ou no acervo bate com essa busca. O repertório salvo continua funcionando.");
    }
    const button=$("searchForm").querySelector("button");button.disabled=true;button.textContent="Buscando…";notify(state.source==="smart"?"Busca inteligente: consultando várias fontes e variações…":"Procurando…",true);
    try{
      const remotos=await searchMusic(q);if(requestId!==searchRequest)return;
      state.results=withLocalFirst(locais,remotos);state.tab="results";renderList();
      void enrichExactLyric(q,remotos,requestId);
      if(!state.results.length){notify("Não encontrei essa música. Tente também um trecho da letra, a busca Inteligente ou confira a grafia do artista.");return}
      const doRepertorio=locais.length?`${locais.length} já no aparelho · `:"";
      if(state.source==="smart"){const src=state.searchMeta?.sources?.join(" + ")||"múltiplas fontes",fallback=state.searchMeta?.fallbackFrom=== "vagalume"?"Vagalume indisponível; usei as outras fontes. ":state.searchMeta?.fallbackFrom==="lrclib"?"LRCLIB indisponível; usei as outras fontes. ":"";notify(`${fallback}${plural(state.results.length,"resultado","resultados")} · ${doRepertorio}${src}. Os melhores aparecem primeiro.`,true)}
      else notify(locais.length?`${doRepertorio}mais ${state.results.length-locais.length} da busca.`:"",true);
    }catch(err){
      // A rede falhou, mas o que está salvo continua valendo: mostra o que dá.
      if(requestId!==searchRequest)return;state.results=locais;renderList();notifySourceError(err,q,locais.length,requestedMode);
    }finally{if(requestId===searchRequest){button.disabled=false;button.textContent="Buscar";syncSourceUI()}}};
  syncSourceUI();probeSources();renderList();
})();
