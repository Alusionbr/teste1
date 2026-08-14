"use strict";
// A busca e os chips de fonte são ligados em search-ui.js, que é carregado
// depois deste arquivo. Aqui ficam apenas os controles de palco e repertório.
document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>{state.tab=b.dataset.tab;renderList()});
$("menuBtn").onclick=()=>$("sidebar").classList.toggle("open");$("saveBtn").onclick=addSong;$("prevBtn").onclick=()=>jumpSong(-1);$("nextBtn").onclick=()=>jumpSong(1);$("topBtn").onclick=()=>$("paperViewport").scrollTo({top:0,behavior:"smooth"});$("scrollBtn").onclick=toggleScroll;$("syncBtn").onclick=toggleSync;
document.querySelectorAll("[data-speed]").forEach(b=>b.onclick=()=>{state.speed=Math.max(4,Math.min(140,state.speed+Number(b.dataset.speed)));updateControls();updatePrefs()});document.querySelectorAll("[data-font]").forEach(b=>b.onclick=()=>{state.font=Math.max(16,Math.min(72,state.font+Number(b.dataset.font)));updateControls();updatePrefs()});document.querySelectorAll("[data-key]").forEach(b=>b.onclick=()=>{state.key=Math.max(-11,Math.min(11,state.key+Number(b.dataset.key)));$("keyOut").textContent=(state.key>0?"+":"")+state.key;$("paper").querySelectorAll(".chord").forEach(n=>n.textContent=transposeLine(state.lines[+n.dataset.i].text,state.key))});
$("stageBtn").onclick=()=>{state.stage=!state.stage;if(state.stage)keepAwake();updateControls();updatePrefs()};$("fullscreenBtn").onclick=fullscreen;$("pasteBtn").onclick=()=>$("pasteDialog").showModal();$("sourcesBtn").onclick=()=>{$("vagalumeKey").value=state.keyVag;$("sourcesDialog").showModal()};$("helpBtn").onclick=()=>$("helpDialog").showModal();
$("pasteForm").addEventListener("submit",e=>{if(e.submitter?.value==="cancel")return;const text=$("pasteText").value;if(!text.trim()){e.preventDefault();return $("pasteText").focus()}const sync=hasLRC(text);openSong({title:$("pasteTitle").value.trim()||"Letra colada",artist:$("pasteArtist").value.trim(),lyrics:sync?"":text,synced:sync?text:"",source:"colado"});$("pasteDialog").close();e.preventDefault()});
$("sourcesForm").addEventListener("submit",e=>{if(e.submitter?.value==="cancel")return;state.keyVag=$("vagalumeKey").value.trim();updatePrefs();$("sourcesDialog").close();notify(state.keyVag?"Chave salva neste aparelho.":"Chave removida.",true);e.preventDefault()});
$("exportBtn").onclick=exportSetlist;$("importBtn").onclick=()=>$("importFile").click();$("importFile").onchange=e=>{if(e.target.files[0])importSetlist(e.target.files[0]);e.target.value=""};

function b64urlEncode(obj){const bytes=new TextEncoder().encode(JSON.stringify(obj));let bin="";bytes.forEach(b=>bin+=String.fromCharCode(b));return btoa(bin).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"")}
function b64urlDecode(text){let s=text.replace(/-/g,"+").replace(/_/g,"/");while(s.length%4)s+="=";const bin=atob(s),bytes=Uint8Array.from(bin,c=>c.charCodeAt(0));return JSON.parse(new TextDecoder().decode(bytes))}
function sharedSongs(){return state.setlist.map(s=>({title:s.title,artist:s.artist||"",album:s.album||"",duration:s.duration||0}))}
function makeShareUrl(){const payload={v:1,songs:sharedSongs()};return location.origin+location.pathname+"#setlist="+b64urlEncode(payload)}
async function copyText(text){try{await navigator.clipboard.writeText(text);return true}catch{}const ta=document.createElement("textarea");ta.value=text;ta.style.position="fixed";ta.style.opacity="0";document.body.appendChild(ta);ta.select();let ok=false;try{ok=document.execCommand("copy")}catch{}ta.remove();return ok}
async function shareSetlist(){
  if(!state.setlist.length)return notify("Adicione músicas ao repertório antes de compartilhar.");
  const url=makeShareUrl(),title=`Repertório Estante · ${state.setlist.length} músicas`,text=`Repertório pronto com ${state.setlist.length} músicas na ordem do show.`;
  if(navigator.share){try{await navigator.share({title,text,url});notify("Repertório compartilhado.",true);return}catch(e){if(e?.name==="AbortError")return}}
  const ok=await copyText(url);notify(ok?"Link do repertório copiado. Cole no WhatsApp ou onde quiser.":"Não consegui copiar automaticamente. Use Exportar como alternativa.",ok)
}
function readSharedLink(){
  const mark="#setlist=";if(!location.hash.startsWith(mark))return null;
  try{const data=b64urlDecode(location.hash.slice(mark.length));if(data?.v!==1||!Array.isArray(data.songs)||!data.songs.length)throw 0;return data.songs.map(normalizeSong).slice(0,150)}catch{return null}
}
let incomingSetlist=null;
function showIncomingSetlist(list){incomingSetlist=list;const names=list.slice(0,4).map(x=>x.title).join(", ");$("sharedSummary").textContent=`Você recebeu ${list.length} música${list.length===1?"":"s"}${names?`: ${names}${list.length>4?"…":""}`:""}.`;$("sharedDialog").showModal()}
function finishSharedImport(mode){
  if(!incomingSetlist)return;
  if(mode==="replace")state.setlist=incomingSetlist.map(storedSong);else{const existing=new Set(state.setlist.map(songIdentity));incomingSetlist.forEach(x=>{const k=songIdentity(x);if(!existing.has(k)){state.setlist.push(storedSong(x));existing.add(k)}})}
  save(KEYS.setlist,state.setlist);state.tab="setlist";state.currentIndex=-1;renderList();updateSaveButton();$("sharedDialog").close();history.replaceState(null,"",location.pathname+location.search);notify(`Repertório ${mode==="replace"?"recebido":"adicionado"}: ${state.setlist.length} músicas.`,true);incomingSetlist=null
}
$("shareBtn").onclick=shareSetlist;$("sharedCloseBtn").onclick=()=>{$("sharedDialog").close();history.replaceState(null,"",location.pathname+location.search);incomingSetlist=null};$("sharedAddBtn").onclick=()=>finishSharedImport("add");$("sharedReplaceBtn").onclick=()=>finishSharedImport("replace");

window.addEventListener("online",updateNetwork);window.addEventListener("offline",updateNetwork);document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&(state.stage||state.scrolling||state.syncing))keepAwake()});
document.addEventListener("keydown",e=>{if(/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)||document.querySelector("dialog[open]"))return;switch(e.key){case" ":e.preventDefault();if(e.shiftKey&&state.lrc.length)toggleSync();else toggleScroll();break;case"ArrowUp":e.preventDefault();state.speed=Math.min(140,state.speed+2);updateControls();updatePrefs();break;case"ArrowDown":e.preventDefault();state.speed=Math.max(4,state.speed-2);updateControls();updatePrefs();break;case"ArrowLeft":jumpSong(-1);break;case"ArrowRight":jumpSong(1);break;case"PageDown":e.preventDefault();$("paperViewport").scrollBy({top:$("paperViewport").clientHeight*.5,behavior:"smooth"});break;case"PageUp":e.preventDefault();$("paperViewport").scrollBy({top:-$("paperViewport").clientHeight*.5,behavior:"smooth"});break;case"p":case"P":$("stageBtn").click();break;case"f":case"F":fullscreen();break;case"Escape":stopAll();break}});
$("paperViewport").addEventListener("pointerdown",()=>{if(state.scrolling)toggleScroll()});

(function init(){const oldP=load("estante:preferencias",{}),p=load(KEYS.prefs,null)||{source:oldP.fonte,speed:oldP.velocidade,font:oldP.corpo,stage:oldP.palco,keyVag:oldP.chaveVagalume};const raw=load(KEYS.setlist,null)||load("estante:repertorio",[]);state.setlist=(raw||[]).map(normalizeSong);state.source=(p.source==="trecho"?"excerpt":p.source)||"lrclib";state.speed=p.speed||18;state.font=p.font||26;state.stage=!!p.stage;state.keyVag=p.keyVag||"";save(KEYS.setlist,state.setlist);document.querySelectorAll(".chip").forEach(b=>b.classList.toggle("active",b.dataset.source===state.source));$("searchInput").placeholder=state.source==="excerpt"?"Um trecho da letra":state.source==="lrclib"?"Música, artista ou álbum":"Artista e música";updateControls();updateNetwork();renderList();updateSaveButton();const incoming=readSharedLink();if(incoming)showIncomingSetlist(incoming);else $("searchInput").focus()})();
