"use strict";
(function(){
  const SEARCH_VERSION="3.3";
  if(localStorage.getItem("estante:search-engine")!==SEARCH_VERSION){state.source="smart";localStorage.setItem("estante:search-engine",SEARCH_VERSION);updatePrefs()}
  // Fontes que dependem só do Vagalume (Brasil e Trecho): quando ele está fora
  // do ar, os dois chips ganham um sinal visual em vez de deixar o usuário
  // descobrir tentando e recebendo erro toda vez.
  const VAGALUME_ONLY=["vagalume","excerpt"];
  function syncSourceUI(){
    document.querySelectorAll(".chip[data-source]").forEach(b=>{
      const src=b.dataset.source,down=VAGALUME_ONLY.includes(src)&&sourceDown("vagalume");
      b.classList.toggle("active",src===state.source);
      b.classList.toggle("down",down);
      b.title=down?"O Vagalume não respondeu na última tentativa. A busca pode falhar; tente a Inteligente.":"";
    });
    $("searchInput").placeholder=state.source==="excerpt"?"Um trecho da letra":state.source==="smart"?"Música, artista, trecho ou versão":"Artista e música";
  }
  document.querySelectorAll(".chip[data-source]").forEach(b=>b.onclick=()=>{state.source=b.dataset.source;syncSourceUI();updatePrefs();if($("searchInput").value.trim())$("searchForm").requestSubmit()});
  // Mostra o erro e, quando a fonte específica caiu (não é "sem resultado" nem
  // "sem internet"), um atalho de um toque para repetir na busca Inteligente —
  // ela combina LRCLIB, Deezer e Apple, então segue funcionando mesmo com o
  // Vagalume fora do ar.
  function notifySourceError(err,q){
    if(!err.source){notify(navigator.onLine?`Falha na busca: ${esc(err.message)}`:"Você está offline. O repertório salvo continua funcionando.");return}
    notify(`${esc(err.message)} <button type="button" id="trySmartBtn">Tentar na Inteligente</button>`);
    const btn=$("trySmartBtn");if(btn)btn.onclick=()=>{state.source="smart";syncSourceUI();updatePrefs();$("searchInput").value=q;$("searchForm").requestSubmit()};
  }
  $("searchForm").onsubmit=async e=>{e.preventDefault();const q=$("searchInput").value.trim();if(!q)return;
    // Sem rede a busca só teria como falhar depois do tempo limite de cada fonte:
    // avisa na hora para não parecer travado no meio do show.
    if(!navigator.onLine){state.results=[];state.tab="results";renderList();return notify("Você está offline. A busca precisa de internet; o repertório salvo continua funcionando.")}
    const button=$("searchForm").querySelector("button");button.disabled=true;button.textContent="Buscando…";notify(state.source==="smart"?"Busca inteligente: consultando várias fontes e variações…":"Procurando…",true);try{state.results=await searchMusic(q);state.tab="results";renderList();if(!state.results.length){notify("Não encontrei essa música. Tente também um trecho da letra, a busca Inteligente ou confira a grafia do artista.");return}if(state.source==="smart"){const src=state.searchMeta?.sources?.join(" + ")||"múltiplas fontes";notify(`${state.results.length} resultado${state.results.length===1?"":"s"} · ${src}. Os melhores aparecem primeiro.`,true)}else notify("")}catch(err){state.results=[];renderList();notifySourceError(err,q)}finally{button.disabled=false;button.textContent="Buscar";syncSourceUI()}};
  syncSourceUI();renderList();
})();
