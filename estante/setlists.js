"use strict";

function newSetlistId(){return stableId("r")}
function makeSetlist(name,songs){const id=newSetlistId(),now=new Date().toISOString();return{id,name:String(name||"Repertório").slice(0,60),date:"",createdAt:now,updatedAt:now,songs:(songs||[]).map(raw=>{const song=storedSong(raw);song.entryId=stableId("e");song.ownerSetlistId=id;return song})}}
function normalizeSetlist(s){return migrateSetlist(s)}
function activeSetlist(){return state.setlists.find(s=>s.id===state.activeSetlistId)||state.setlists[0]||null}
function bindActiveSetlist(){const s=activeSetlist();state.setlist=s?s.songs:[]}
function saveSetlists(){return persistData()}
function saveSetlistsSoon(){saveSoon("setlists",saveSetlists)}
function setActiveSongs(list){const s=activeSetlist();if(!s)return false;s.songs=list.map(raw=>{const song=storedSong(raw);song.entryId=song.entryId||stableId("e");song.ownerSetlistId=s.id;return song});bindActiveSetlist();saveSetlists();return true}

async function loadSetlists(){
  const runtime=await initializeDataStore();
  state.setlists=runtime.setlists;state.recoveredSetlists=runtime.recoveredSetlists||[];state.trash=runtime.trash||[];state.activeSetlistId=runtime.activeId||"";state.resume=runtime.resume||null;state.documentRevision=runtime.revision||0;state.readOnly=!!runtime.readOnly;state.storageError=runtime.storageError||"";state.recovery=runtime.recovery||null;
  bindActiveSetlist();
  if(state.readOnly)showSaveState("error","Somente leitura");
  if(state.recovery)notify("Encontramos dados antigos que precisam de atenção. Seus dados originais foram preservados.");
}

function createSetlist(name,songs){
  if(state.setlists.length>=MAX_ACTIVE_SETLISTS){notify("Você já tem 10 repertórios. Organize os existentes para criar outro.");return null}
  const s=makeSetlist(name,(songs||[]));state.setlists.push(s);state.activeSetlistId=s.id;state.currentIndex=-1;bindActiveSetlist();saveSetlists();renderHome();return s
}
function renameSetlist(id,name){const s=state.setlists.find(x=>x.id===id);if(!s||!String(name).trim())return false;s.name=String(name).trim().slice(0,60);s.updatedAt=new Date().toISOString();saveSetlists();renderHome();return true}
function duplicateSetlist(id){const s=state.setlists.find(x=>x.id===id);if(!s)return null;return createSetlist(`${s.name} (cópia)`,s.songs)}
function clearReader(){stopAll();state.current=null;state.currentIndex=-1;state.lines=[];state.lrc=[];$("songTitle").textContent="Nenhuma música aberta";$("songArtist").textContent="Escolha uma música do repertório";$("paper").innerHTML='<div class="emptyPaper welcome"><b>Repertório selecionado.</b><small>Escolha uma música ou toque em Adicionar música.</small></div>';$("credits").textContent="";updateSaveButton();updateControls()}
function switchSetlist(id,options={}){if(!state.setlists.some(s=>s.id===id))return false;state.activeSetlistId=id;bindActiveSetlist();if(!(state.stage||options.keepSession))clearReader();else state.currentIndex=state.current&&state.current.ownerSetlistId===id?state.setlist.findIndex(s=>s.entryId===state.current.entryId):-1;saveSetlists();renderHome();return true}
function deleteSetlist(id){if(state.trash.length>=20){notify("A área de recuperação está cheia. Baixe uma cópia e organize os itens apagados antes de remover outro.");return false}const i=state.setlists.findIndex(s=>s.id===id);if(i<0)return false;const removed=state.setlists.splice(i,1)[0];state.trash.push({type:"setlist",deletedAt:new Date().toISOString(),value:removed});if(state.activeSetlistId===id)state.activeSetlistId=(state.setlists[Math.max(0,i-1)]||{}).id||"";bindActiveSetlist();clearReader();saveSetlists();renderHome();return true}
function restoreLastDelete(){const item=state.trash[state.trash.length-1];if(!item||item.type!=="setlist")return false;if(state.setlists.length>=MAX_ACTIVE_SETLISTS){notify("Libere um repertório antes de restaurar.");return false}state.trash.pop();state.setlists.push(item.value);state.activeSetlistId=item.value.id;bindActiveSetlist();saveSetlists();renderHome();notify("Repertório restaurado.",true);return true}

function setlistDuration(songs){let total=0,unknown=0;(songs||[]).forEach(s=>{if(s.duration>0)total+=s.duration;else unknown++});return{total,unknown}}
function durationLabel(songs){const{total,unknown}=setlistDuration(songs);if(!total&&unknown)return`${unknown} sem duração conhecida`;if(!total)return"0 min";const h=Math.floor(total/3600),m=Math.round((total%3600)/60),tempo=h?`${h}h${String(m).padStart(2,"0")}`:`${m} min`;return unknown?`≈ ${tempo} (+${unknown} sem duração)`:`≈ ${tempo}`}

function renderSetlistBar(){
  const bar=$("setlistBar"),summary=$("setlistSummary"),showing=state.tab==="setlist";bar.hidden=!showing;summary.hidden=!showing;if(!showing)return;
  const sel=$("setlistSelect");sel.textContent="";sel.disabled=!state.setlists.length;state.setlists.forEach(s=>{const o=document.createElement("option");o.value=s.id;o.textContent=`${s.name} (${s.songs.length})`;o.selected=s.id===state.activeSetlistId;sel.appendChild(o)});for(const id of ["setlistRename","setlistCopy","printBtn","setlistDelete"])$(id).disabled=!state.setlists.length;
  const songs=state.setlist;summary.textContent=songs.length?`${songs.length} música${songs.length===1?"":"s"} · ${durationLabel(songs)}`:"Repertório vazio."
}

function updateEntrySetting(setlistId,entryId,fields){const set=state.setlists.find(s=>s.id===setlistId),song=set&&set.songs.find(x=>x.entryId===entryId);if(!song)return false;Object.keys(fields).forEach(key=>song[key]=fields[key]);set.updatedAt=new Date().toISOString();return true}
