"use strict";
function renderMissingLyrics(song,message){
  const catalogOnly=(song.sources||[]).includes("Apple")||song.source==="Apple";
  const title=catalogOnly?"Encontrei a música, mas não a letra.":"Não consegui abrir esta letra.";
  const detail=catalogOnly?"A faixa foi identificada no catálogo, porém nenhuma das fontes de letras devolveu conteúdo para esta versão. Tente outra versão, a busca por trecho ou cole a letra.":message;
  $("paper").innerHTML=`<div class="emptyPaper"><b>${esc(title)}</b><small>${esc(detail||"")}</small></div>`;
  const links=[];if(song.vagUrl)links.push(`<a href="${esc(song.vagUrl)}" target="_blank" rel="noopener">Ver no Vagalume</a>`);if(song.catalogUrl)links.push(`<a href="${esc(song.catalogUrl)}" target="_blank" rel="noopener">Ver referência da faixa</a>`);$("credits").innerHTML=links.join(" · ")
}
async function openSong(song){
  stopAll();state.current=song;state.lines=[];state.lrc=[];lastActive=-1;$("songTitle").textContent=song.title||"Sem título";$("songArtist").textContent=(song.artist||"SEM ARTISTA").toUpperCase();$("paperViewport").scrollTop=0;$("credits").textContent="";$("syncBtn").disabled=true;$("keyControl").hidden=true;$("capoControl").hidden=true;applySongPrefs(song);updateControls();updateSaveButton();
  if(!song.lyrics&&!song.synced){
    $("paper").innerHTML='<div class="emptyPaper"><b>Buscando a melhor versão…</b><small>Consultando as fontes disponíveis.</small></div>';
    try{if(song.vagId&&state.keyVag)await fetchVagalume(song);else await fetchLrclibSong(song)}catch(first){
      if(song.vagId&&state.keyVag){try{await fetchLrclibSong(song);notify("O Vagalume não respondeu; carreguei uma versão alternativa do LRCLIB.",true)}catch{renderMissingLyrics(song,first.message);return}}else{renderMissingLyrics(song,first.message);return}
    }
    persistCurrent();
  }
  state.lrc=song.synced?parseLRC(song.synced):[];state.lines=state.lrc.length?state.lrc.map(x=>({text:x.text,type:x.text?"lyric":"blank"})):(song.lyrics||"").split(/\r?\n/).map(classify);renderPaper();
  $("syncBtn").disabled=!state.lrc.length;const temCifra=state.lines.some(x=>x.type==="chord");$("keyControl").hidden=!temCifra;$("capoControl").hidden=!temCifra;updateSaveButton();
  if(song.instrumental)$("credits").textContent="Faixa instrumental.";else if(song.vagUrl&&song.source!=="LRCLIB")$("credits").innerHTML=`Letra publicada por <a href="${esc(song.vagUrl)}" target="_blank" rel="noopener">Vagalume</a>. Direitos reservados aos autores e editoras.`;else $("credits").textContent=`Letra obtida em ${song.source||"conteúdo colado"}. Direitos reservados aos autores e editoras.`;
}
function renderPaper(){const p=$("paper");p.className="paper"+(state.lrc.length?" synced":"");p.innerHTML="";if(!state.lines.length){p.innerHTML='<div class="emptyPaper">Sem letra disponível para esta versão.</div>';return}state.lines.forEach((l,i)=>{const d=document.createElement("div");d.className="lineLyric "+(l.type==="chord"?"chord":l.type==="section"?"section":l.type==="blank"?"blank":"");d.dataset.i=i;d.textContent=l.type==="chord"?transposeLine(l.text,chordShift()):l.text;if(state.lrc.length)d.onclick=()=>seekSync(i);p.appendChild(d)})}

function stopAll(){state.scrolling=false;state.syncing=false;if(raf)cancelAnimationFrame(raf);raf=null;lastActive=-1;syncOffset=0;pixelRest=0;$("paper").querySelectorAll(".active,.past").forEach(x=>x.classList.remove("active","past"));updateControls()}
function toggleScroll(){if(state.syncing)stopAll();state.scrolling=!state.scrolling;if(state.scrolling){keepAwake();lastFrame=performance.now();tick()}else if(raf){cancelAnimationFrame(raf);raf=null}updateControls()}
function toggleSync(){if(!state.lrc.length)return;if(state.scrolling)stopAll();state.syncing=!state.syncing;if(state.syncing){keepAwake();syncStart=performance.now()-syncOffset*1000;lastFrame=performance.now();tick()}else if(raf){cancelAnimationFrame(raf);raf=null}updateControls()}
function seekSync(i){if(!state.lrc[i])return;syncOffset=state.lrc[i].t;syncStart=performance.now()-syncOffset*1000;highlight(i);if(!state.syncing)toggleSync()}
function highlight(i){if(i===lastActive)return;lastActive=i;const nodes=$("paper").children;[...nodes].forEach((n,k)=>{n.classList.toggle("active",k===i);n.classList.toggle("past",k<i)});const n=nodes[i];if(n)$("paperViewport").scrollTo({top:Math.max(0,n.offsetTop-$("paperViewport").clientHeight*.38),behavior:"smooth"})}
function tick(){raf=requestAnimationFrame(tick);const now=performance.now(),dt=(now-lastFrame)/1000;lastFrame=now;if(state.scrolling){pixelRest+=state.speed*dt;const px=Math.floor(pixelRest);if(px){pixelRest-=px;$("paperViewport").scrollTop+=px;if($("paperViewport").scrollTop+$("paperViewport").clientHeight>=$("paperViewport").scrollHeight-2)toggleScroll()}}if(state.syncing){syncOffset=(now-syncStart)/1000;let i=-1;for(let k=0;k<state.lrc.length;k++){if(state.lrc[k].t<=syncOffset)i=k;else break}if(i>=0)highlight(i)}}

// Exporta todos os repertórios (versão 3). A chave "setlist" continua saindo
// com o repertório ativo para que arquivos novos ainda abram em versões antigas.
function exportSetlist(){const data={version:3,activeId:state.activeSetlistId,setlists:state.setlists,setlist:state.setlist};const a=document.createElement("a"),blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});a.href=URL.createObjectURL(blob);a.download="estante-repertorio.json";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),3000)}
// Aceita o formato novo (vários repertórios) e os antigos (um repertório só
// ou um array puro de músicas).
function importSetlist(file){const r=new FileReader();r.onload=()=>{try{
  const d=JSON.parse(r.result);
  if(d&&Array.isArray(d.setlists)&&d.setlists.length){
    state.setlists=d.setlists.map(normalizeSetlist);
    state.activeSetlistId=state.setlists.some(x=>x.id===d.activeId)?d.activeId:state.setlists[0].id;
    state.currentIndex=-1;bindActiveSetlist();saveSetlists();
    state.tab="setlist";renderList();updateSaveButton();
    notify(`Importados ${state.setlists.length} repertório${state.setlists.length===1?"":"s"}.`,true);return;
  }
  const raw=Array.isArray(d)?d:(d.setlist||d.repertorio);if(!Array.isArray(raw))throw 0;
  const list=raw.map(normalizeSong);setActiveSongs(list);
  state.currentIndex=-1;state.tab="setlist";renderList();updateSaveButton();
  notify(`Repertório importado: ${list.length} músicas.`,true);
}catch{notify("Arquivo de repertório inválido.")}};r.readAsText(file)}
async function fullscreen(){
  try{
    if(document.documentElement.requestFullscreen){
      if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen();
      return;
    }
  }catch{}
  const sidebar=$("sidebar"),app=document.querySelector(".app"),on=document.body.dataset.wide==="on";
  if(on){delete document.body.dataset.wide;sidebar.style.display="";app.style.gridTemplateColumns="";$("fullscreenBtn").textContent="Tela cheia"}
  else{document.body.dataset.wide="on";sidebar.style.display="none";app.style.gridTemplateColumns="1fr";$("fullscreenBtn").textContent="Sair tela"}
}
async function keepAwake(){try{if("wakeLock"in navigator&&!wakeLock){wakeLock=await navigator.wakeLock.request("screen");wakeLock.addEventListener("release",()=>wakeLock=null)}}catch{}}
