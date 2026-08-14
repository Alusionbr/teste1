"use strict";
(function(){
  const SEARCH_VERSION="3.2";
  if(localStorage.getItem("estante:search-engine")!==SEARCH_VERSION){state.source="smart";localStorage.setItem("estante:search-engine",SEARCH_VERSION);updatePrefs()}
  function syncSourceUI(){document.querySelectorAll(".chip[data-source]").forEach(b=>b.classList.toggle("active",b.dataset.source===state.source));$("searchInput").placeholder=state.source==="excerpt"?"Um trecho da letra":state.source==="smart"?"Música, artista, trecho ou versão":"Artista e música"}
  document.querySelectorAll(".chip[data-source]").forEach(b=>b.onclick=()=>{state.source=b.dataset.source;syncSourceUI();updatePrefs();if($("searchInput").value.trim())$("searchForm").requestSubmit()});
  $("searchForm").onsubmit=async e=>{e.preventDefault();const q=$("searchInput").value.trim();if(!q)return;
    // Sem rede a busca só teria como falhar depois do tempo limite de cada fonte:
    // avisa na hora para não parecer travado no meio do show.
    if(!navigator.onLine){state.results=[];state.tab="results";renderList();return notify("Você está offline. A busca precisa de internet; o repertório salvo continua funcionando.")}
    const button=$("searchForm").querySelector("button");button.disabled=true;button.textContent="Buscando…";notify(state.source==="smart"?"Busca inteligente: consultando várias fontes e variações…":"Procurando…",true);try{state.results=await searchMusic(q);state.tab="results";renderList();if(!state.results.length){notify("Não encontrei essa música. Tente também um trecho da letra ou confira a grafia do artista.");return}if(state.source==="smart"){const src=state.searchMeta?.sources?.join(" + ")||"múltiplas fontes";notify(`${state.results.length} resultado${state.results.length===1?"":"s"} · ${src}. Os melhores aparecem primeiro.`,true)}else notify("")}catch(err){state.results=[];renderList();notify(navigator.onLine?`Falha na busca: ${esc(err.message)}`:"Você está offline. O repertório salvo continua funcionando.")}finally{button.disabled=false;button.textContent="Buscar"}};
  syncSourceUI();renderList();
})();
