"use strict";
(function(){
  const SEARCH_VERSION="4.0";
  let searchRequest=0;
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
      b.title=down?(src==="excerpt"
        ?"O Vagalume não respondeu na última tentativa. Busca por trecho depende só dele; enquanto isso, o app procura no seu repertório e no acervo."
        :"O Vagalume não respondeu na última tentativa. A busca pode falhar; tente a Inteligente."):"";
    });
    $("searchInput").placeholder=state.source==="excerpt"?"Um trecho da letra":state.source==="smart"?"Música, artista, trecho ou versão":"Artista e música";
  }
  document.querySelectorAll(".chip[data-source]").forEach(b=>b.onclick=()=>{state.source=b.dataset.source;syncSourceUI();updatePrefs();if($("searchInput").value.trim())$("searchForm").requestSubmit()});
  /*
   * Mostra o erro e, quando a fonte caiu, um atalho para repetir na Inteligente.
   *
   * No modo Trecho o atalho seria promessa falsa: procurar por um pedaço da
   * letra depende só do Vagalume — LRCLIB, Deezer, Apple e MusicBrainz comparam
   * título, artista e álbum, nunca o texto. Então ali a mensagem diz a verdade
   * e aponta o que de fato funciona: o que já está no aparelho.
   */
  function notifySourceError(err,q,achadosLocais){
    if(!err.source){notify(navigator.onLine?`Falha na busca: ${err.message}`:"Você está offline. O repertório salvo continua funcionando.");return}
    if(state.source==="excerpt"){
      notify(`${err.message} Procurar por um pedaço da letra depende só dele — as outras fontes comparam título e artista, nunca o texto. ${achadosLocais?`Enquanto isso, ${plural(achadosLocais,"música do seu repertório ou do acervo bate","músicas do seu repertório ou do acervo batem")} com esse trecho.`:"Nada no seu repertório ou no acervo bate com esse trecho."}`);
      return;
    }
    notify(`${err.message} A busca Inteligente combina as outras fontes.`,false,{label:"Tentar na Inteligente",run:()=>{state.source="smart";syncSourceUI();updatePrefs();$("searchInput").value=q;$("searchForm").requestSubmit()}});
  }
  const plural=(n,s,p)=>`${n} ${n===1?s:p}`;
  $("searchForm").onsubmit=async e=>{e.preventDefault();const q=$("searchInput").value.trim();if(!q)return;const requestId=++searchRequest;
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
      if(!state.results.length){notify("Não encontrei essa música. Tente também um trecho da letra, a busca Inteligente ou confira a grafia do artista.");return}
      const doRepertorio=locais.length?`${locais.length} já no aparelho · `:"";
      if(state.source==="smart"){const src=state.searchMeta?.sources?.join(" + ")||"múltiplas fontes",fallback=state.searchMeta?.fallbackFrom==="vagalume"?"Vagalume indisponível; usei as outras fontes. ":"";notify(`${fallback}${plural(state.results.length,"resultado","resultados")} · ${doRepertorio}${src}. Os melhores aparecem primeiro.`,true)}
      else notify(locais.length?`${doRepertorio}mais ${state.results.length-locais.length} da busca.`:"",true);
    }catch(err){
      // A rede falhou, mas o que está salvo continua valendo: mostra o que dá.
      if(requestId!==searchRequest)return;state.results=locais;renderList();notifySourceError(err,q,locais.length);
    }finally{if(requestId===searchRequest){button.disabled=false;button.textContent="Buscar";syncSourceUI()}}};
  syncSourceUI();renderList();
})();
