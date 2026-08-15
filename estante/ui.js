"use strict";
// A busca e os chips de fonte são ligados em search-ui.js, que é carregado
// depois deste arquivo. Aqui ficam apenas os controles de palco e repertório.
document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>{state.tab=b.dataset.tab;renderList()});
$("menuBtn").onclick=()=>$("sidebar").classList.toggle("open");$("saveBtn").onclick=addSong;$("prevBtn").onclick=()=>jumpSong(-1);$("nextBtn").onclick=()=>jumpSong(1);$("topBtn").onclick=()=>$("paperViewport").scrollTo({top:0,behavior:"smooth"});$("scrollBtn").onclick=toggleScroll;$("syncBtn").onclick=toggleSync;
document.querySelectorAll("[data-speed]").forEach(b=>b.onclick=()=>changeSpeed(Number(b.dataset.speed)));
// Mudar o tamanho da letra muda a altura do texto: o automático recalcula.
document.querySelectorAll("[data-font]").forEach(b=>b.onclick=()=>{state.font=Math.max(16,Math.min(72,state.font+Number(b.dataset.font)));updateControls();applyAutoSpeed();updatePrefsSoon()});
$("autoBtn").onclick=toggleAuto;
document.querySelectorAll("[data-key]").forEach(b=>b.onclick=()=>changeKey(Number(b.dataset.key)));
document.querySelectorAll("[data-capo]").forEach(b=>b.onclick=()=>changeCapo(Number(b.dataset.capo)));
$("editBtn").onclick=openSongEditor;
$("editForm").addEventListener("submit",e=>{if(e.submitter?.value==="cancel")return;e.preventDefault();saveSongEdit()});
$("durationForm").addEventListener("submit",e=>{if(e.submitter?.value==="cancel")return;e.preventDefault();saveDuration($("durationInput").value);$("durationDialog").close()});
$("importCloseBtn").onclick=()=>{$("importDialog").close();incomingImport=null};
$("importAddBtn").onclick=()=>finishImport("add");
$("importReplaceBtn").onclick=()=>finishImport("replace");
$("notesBtn").onclick=()=>{if(!state.current)return;$("notesText").value=state.current.notes||"";$("notesDialog").showModal()};
$("notesForm").addEventListener("submit",e=>{if(e.submitter?.value==="cancel")return;saveSongNotes($("notesText").value.trim());$("notesDialog").close();e.preventDefault()});
$("stageBtn").onclick=()=>{state.stage=!state.stage;if(state.stage)keepAwake();else releaseAwake();updateControls();updatePrefs()};$("fullscreenBtn").onclick=fullscreen;$("pasteBtn").onclick=()=>$("pasteDialog").showModal();$("sourcesBtn").onclick=()=>{$("vagalumeKey").value=state.keyVag;$("sourcesDialog").showModal()};$("helpBtn").onclick=()=>$("helpDialog").showModal();
$("pasteForm").addEventListener("submit",e=>{if(e.submitter?.value==="cancel")return;const text=$("pasteText").value;if(!text.trim()){e.preventDefault();return $("pasteText").focus()}const sync=hasLRC(text);openSong({title:$("pasteTitle").value.trim()||"Letra colada",artist:$("pasteArtist").value.trim(),lyrics:sync?"":text,synced:sync?text:"",source:"colado"});$("pasteDialog").close();e.preventDefault()});
$("sourcesForm").addEventListener("submit",e=>{if(e.submitter?.value==="cancel")return;state.keyVag=$("vagalumeKey").value.trim();updatePrefs();$("sourcesDialog").close();notify(state.keyVag?"Chave salva neste aparelho.":"Chave removida.",true);e.preventDefault()});
$("exportBtn").onclick=exportSetlist;$("importBtn").onclick=()=>$("importFile").click();$("importFile").onchange=e=>{if(e.target.files[0])importSetlist(e.target.files[0]);e.target.value=""};

// --- Repertórios (criar, renomear, duplicar, apagar, trocar) ---
// O mesmo diálogo serve para nomear em qualquer um desses casos.
let setlistAction="new";
function askSetlistName(action,title,valor){
  setlistAction=action;
  $("setlistDialogTitle").textContent=title;
  $("setlistName").value=valor||"";
  $("setlistDialog").showModal();
  $("setlistName").focus();
}
$("setlistSelect").onchange=e=>{switchSetlist(e.target.value);renderList();updateSaveButton()};
$("setlistNew").onclick=()=>askSetlistName("new","Novo repertório","");
$("setlistRename").onclick=()=>{const s=activeSetlist();if(s)askSetlistName("rename","Renomear repertório",s.name)};
$("setlistCopy").onclick=()=>{duplicateSetlist(state.activeSetlistId);renderList();updateSaveButton();notify("Repertório duplicado.",true)};
$("setlistDelete").onclick=()=>{
  const s=activeSetlist();if(!s)return;
  const ultimo=state.setlists.length===1;
  const pergunta=ultimo?`Esvaziar "${s.name}"? As ${s.songs.length} músicas salvas serão apagadas.`:`Apagar o repertório "${s.name}" com ${s.songs.length} música(s)?`;
  if(!confirm(pergunta))return;
  deleteSetlist(s.id);renderList();updateSaveButton();notify(ultimo?"Repertório esvaziado.":"Repertório apagado.",true);
};
$("setlistForm").addEventListener("submit",e=>{
  if(e.submitter?.value==="cancel")return;
  const nome=$("setlistName").value.trim();
  if(!nome){e.preventDefault();return $("setlistName").focus()}
  if(setlistAction==="rename")renameSetlist(state.activeSetlistId,nome);else createSetlist(nome);
  $("setlistDialog").close();renderList();updateSaveButton();e.preventDefault();
});

$("printBtn").onclick=()=>{if(!state.setlist.length)return notify("Adicione músicas ao repertório antes de imprimir.");$("printDialog").showModal()};
$("printCloseBtn").onclick=()=>$("printDialog").close();
$("printListBtn").onclick=()=>printSetlist(false);
$("printFullBtn").onclick=()=>printSetlist(true);

function b64urlFromBytes(bytes){let bin="";bytes.forEach(b=>bin+=String.fromCharCode(b));return btoa(bin).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"")}
function b64urlToBytes(text){let s=text.replace(/-/g,"+").replace(/_/g,"/");while(s.length%4)s+="=";return Uint8Array.from(atob(s),c=>c.charCodeAt(0))}
/*
 * O link leva a letra junto.
 *
 * Antes ia só título, artista, álbum e duração: quem recebia abria o
 * repertório certo, na ordem certa, e cada música tinha de ser buscada de
 * novo. Chegando no local sem sinal — que é o caso comum — NENHUMA abria.
 * Compartilhar o repertório sem a letra é compartilhar uma lista de nomes.
 *
 * O preço é o tamanho: por isso o botão pergunta antes, mostra quanto ficou e
 * avisa quando o link passa do que os aplicativos costumam aguentar.
 *
 * Tom e capotraste vão nas duas formas (são dois números e a banda precisa
 * deles); letra, sincronia e anotações só na versão completa.
 */
function sharedSongs(comLetras){
  return state.setlist.map(s=>{
    // videoId/videoOffset vão nas duas formas pelo mesmo motivo de tom e capo:
    // são 11 caracteres e um número, e o repertório recebido deve chegar pronto
    // para tocar. A chave da API nunca vai — ela é do aparelho.
    const base={title:s.title,artist:s.artist||"",album:s.album||"",duration:s.duration||0,key:s.key||0,capo:s.capo||0,videoId:s.videoId||"",videoOffset:s.videoOffset||0};
    if(!comLetras)return base;
    return Object.assign(base,{lyrics:s.lyrics||"",synced:s.synced||"",instrumental:!!s.instrumental,source:s.source||"",notes:s.notes||""});
  });
}
/*
 * Compactação: `deflate-raw` é do próprio navegador (CompressionStream), não é
 * biblioteca — encolhe a letra em ~70% e não quebra o uso offline. Onde não
 * existir, o link sai sem compactar e continua funcionando; por isso são duas
 * marcas de hash diferentes, e a leitura aceita as duas.
 */
const SHARE_ZIP="#setlistz=",SHARE_PLAIN="#setlist=";
async function packShare(payload){
  const bytes=new TextEncoder().encode(JSON.stringify(payload));
  if(typeof CompressionStream==="function"){
    try{
      const buf=await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer();
      return SHARE_ZIP+b64urlFromBytes(new Uint8Array(buf));
    }catch{}
  }
  return SHARE_PLAIN+b64urlFromBytes(bytes);
}
async function unpackShare(hash){
  if(hash.startsWith(SHARE_ZIP)){
    if(typeof DecompressionStream!=="function")throw Error("Este link foi compactado e o navegador não sabe abrir. Peça o arquivo de exportação.");
    const buf=await new Response(new Blob([b64urlToBytes(hash.slice(SHARE_ZIP.length))]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer();
    return JSON.parse(new TextDecoder().decode(new Uint8Array(buf)));
  }
  return JSON.parse(new TextDecoder().decode(b64urlToBytes(hash.slice(SHARE_PLAIN.length))));
}
async function makeShareUrl(comLetras){
  const set=activeSetlist();
  return location.origin+location.pathname+await packShare({v:2,name:set?set.name:"",comLetras:!!comLetras,songs:sharedSongs(comLetras)});
}
async function copyText(text){try{await navigator.clipboard.writeText(text);return true}catch{}const ta=document.createElement("textarea");ta.value=text;ta.style.position="fixed";ta.style.opacity="0";document.body.appendChild(ta);ta.select();let ok=false;try{ok=document.execCommand("copy")}catch{}ta.remove();return ok}
// Acima disso vários aplicativos de mensagem cortam o link ao colar. Não é um
// limite do navegador: é o ponto em que passa a valer mais mandar o arquivo.
const LINK_LONGO=8000;
// "0 mil caracteres" para um link de 430 não informa nada: só arredondar depois
// que o número passa a ser grande o bastante para importar.
function tamanhoLink(url){return url.length<2000?`${url.length} caracteres`:`${(url.length/1000).toFixed(1)} mil caracteres`}
async function openShareDialog(){
  if(!state.setlist.length)return notify("Adicione músicas ao repertório antes de compartilhar.");
  $("shareSummary").textContent="Calculando o tamanho do link…";
  $("shareWarn").hidden=true;$("shareFullBtn").disabled=true;
  $("shareDialog").showModal();
  const [completo,simples]=await Promise.all([makeShareUrl(true),makeShareUrl(false)]);
  linkCompleto=completo;linkSimples=simples;
  const comLetra=state.setlist.filter(s=>s.lyrics||s.synced).length;
  $("shareSummary").textContent=`${state.setlist.length} música${state.setlist.length===1?"":"s"}, ${comLetra} com letra guardada. Com as letras o link fica com ${tamanhoLink(completo)} e abre sem internet; só a ordem fica com ${tamanhoLink(simples)} e quem receber precisa buscar cada letra.`;
  $("shareFullBtn").disabled=false;
  if(completo.length>LINK_LONGO){
    $("shareWarn").hidden=false;
    $("shareWarn").textContent="Link longo: alguns aplicativos cortam links desse tamanho ao colar. Se chegar quebrado do outro lado, use Exportar e mande o arquivo.";
  }
}
let linkCompleto="",linkSimples="";
async function shareSetlist(comLetras){
  $("shareDialog").close();
  const url=comLetras?linkCompleto:linkSimples;if(!url)return;
  const title=`Repertório Estante · ${state.setlist.length} músicas`,text=comLetras?`Repertório com ${state.setlist.length} músicas e as letras — abre sem internet.`:`Repertório com ${state.setlist.length} músicas na ordem do show.`;
  if(navigator.share){try{await navigator.share({title,text,url});notify("Repertório compartilhado.",true);return}catch(e){if(e?.name==="AbortError")return}}
  const ok=await copyText(url);notify(ok?"Link do repertório copiado. Cole no WhatsApp ou onde quiser.":"Não consegui copiar automaticamente. Use Exportar como alternativa.",ok)
}
async function readSharedLink(){
  const hash=location.hash;
  if(!hash.startsWith(SHARE_PLAIN)&&!hash.startsWith(SHARE_ZIP))return null;
  try{
    const data=await unpackShare(hash);
    if(!(data?.v===1||data?.v===2)||!Array.isArray(data.songs)||!data.songs.length)throw Error("Este link de repertório não está num formato que eu conheça.");
    incomingName=String(data.name||"").slice(0,60);
    return data.songs.map(normalizeSong).slice(0,150);
  }catch(e){notify(e.message||"Não consegui ler este link de repertório.");return null}
}
let incomingSetlist=null,incomingName="";
function showIncomingSetlist(list){
  incomingSetlist=list;
  const names=list.slice(0,4).map(x=>x.title).join(", ");
  const comLetra=list.filter(x=>x.lyrics||x.synced).length;
  $("sharedSummary").textContent=`Você recebeu ${list.length} música${list.length===1?"":"s"}${names?`: ${names}${list.length>4?"…":""}`:""}.`;
  // Dizer isso agora evita a descoberta ruim: chegar no local sem sinal e
  // encontrar o repertório certo com todas as músicas em branco.
  $("sharedDetail").textContent=comLetra===list.length?"As letras vieram junto: abrem sem internet."
    :comLetra?`${comLetra} vieram com a letra; as outras precisam de internet para abrir.`
    :"O link trouxe só a ordem do show — cada letra precisa ser buscada com internet.";
  $("sharedDialog").showModal();
}
function finishSharedImport(mode){
  if(!incomingSetlist)return;
  if(mode==="new")createSetlist(incomingName||"Repertório recebido",incomingSetlist);
  else{
    const existing=new Set(state.setlist.map(songIdentity));
    incomingSetlist.forEach(x=>{const k=songIdentity(x);if(!existing.has(k)){state.setlist.push(storedSong(x));existing.add(k)}});
    saveSetlists();
  }
  state.tab="setlist";state.currentIndex=-1;renderList();updateSaveButton();$("sharedDialog").close();history.replaceState(null,"",location.pathname+location.search);
  notify(`Repertório ${mode==="new"?"recebido em uma lista nova":"adicionado"}: ${state.setlist.length} músicas.`,true);
  incomingSetlist=null;incomingName=""
}
$("shareBtn").onclick=openShareDialog;$("shareCloseBtn").onclick=()=>$("shareDialog").close();$("shareFullBtn").onclick=()=>shareSetlist(true);$("shareListOnlyBtn").onclick=()=>shareSetlist(false);
$("sharedCloseBtn").onclick=()=>{$("sharedDialog").close();history.replaceState(null,"",location.pathname+location.search);incomingSetlist=null;incomingName=""};$("sharedAddBtn").onclick=()=>finishSharedImport("add");$("sharedNewBtn").onclick=()=>finishSharedImport("new");

window.addEventListener("online",updateNetwork);window.addEventListener("offline",updateNetwork);
// Gravação adiada não pode morrer com a aba: fecha a conta ao sair ou esconder.
window.addEventListener("pagehide",flushSaves);
document.addEventListener("visibilitychange",()=>{
  if(document.visibilityState==="visible"){
    // O relógio da rolagem recomeça agora: sem isso o primeiro quadro na volta
    // cobraria todo o tempo em que a aba esteve escondida. (A sincronia com
    // .lrc não é reiniciada de propósito — lá o relógio é o da música, que
    // seguiu tocando enquanto você olhava outra coisa.)
    lastFrame=performance.now();
    if(state.stage||state.scrolling||state.syncing)keepAwake();
  }else flushSaves();
});
document.addEventListener("keydown",e=>{if(/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)||document.querySelector("dialog[open]"))return;switch(e.key){case" ":e.preventDefault();if(e.shiftKey&&state.lrc.length)toggleSync();else toggleScroll();break;case"ArrowUp":e.preventDefault();changeSpeed(2);break;case"ArrowDown":e.preventDefault();changeSpeed(-2);break;case"ArrowLeft":jumpSong(-1);break;case"ArrowRight":jumpSong(1);break;case"PageDown":e.preventDefault();$("paperViewport").scrollBy({top:$("paperViewport").clientHeight*.5,behavior:"smooth"});break;case"PageUp":e.preventDefault();$("paperViewport").scrollBy({top:-$("paperViewport").clientHeight*.5,behavior:"smooth"});break;case"p":case"P":$("stageBtn").click();break;case"f":case"F":fullscreen();break;case"Escape":stopAll();break}});
// Encostar na letra pausa — vale para a rolagem e também para a sincronia, que
// antes seguia correndo enquanto o toque reposicionava a música sem avisar.
$("paperViewport").addEventListener("pointerdown",()=>{
  if(state.scrolling){toggleScroll();pausouNoToque=true}
  else if(state.syncing){toggleSync();pausouNoToque=true}
});

(function init(){const oldP=load("estante:preferencias",{}),p=load(KEYS.prefs,null)||{source:oldP.fonte,speed:oldP.velocidade,font:oldP.corpo,stage:oldP.palco,keyVag:oldP.chaveVagalume};loadSetlists();state.source=(p.source==="trecho"?"excerpt":p.source)||"lrclib";state.speed=state.speedGlobal=p.speed||18;state.font=p.font||26;state.stage=!!p.stage;state.keyVag=p.keyVag||"";state.keyYT=p.keyYT||"";state.audioDelay=Number(p.audioDelay)||0;document.querySelectorAll(".chip").forEach(b=>b.classList.toggle("active",b.dataset.source===state.source));$("searchInput").placeholder=state.source==="excerpt"?"Um trecho da letra":state.source==="lrclib"?"Música, artista ou álbum":"Artista e música";updateControls();updateNetwork();renderList();updateSaveButton();readSharedLink().then(incoming=>{if(incoming)showIncomingSetlist(incoming);else $("searchInput").focus()})})();
