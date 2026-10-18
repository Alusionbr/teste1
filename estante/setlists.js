"use strict";

function newSetlistId(){return EstanteDomain.uid("setlist")}
function makeSetlist(name,songs){return EstanteDomain.normalizeSetlist({id:newSetlistId(),name:name||"Repertório",songs:songs||[]})}
function normalizeSetlist(s){return EstanteDomain.normalizeSetlist(s)}
function activeSetlist(){return state.setlists.find(s=>s.id===state.activeSetlistId)||state.setlists.find(s=>!s.archived)||state.setlists[0]}
function bindActiveSetlist(){const s=activeSetlist();state.setlist=s?s.songs:[]}

function workspaceSnapshot(){
  const current=state.workspace||{};
  return{version:EstanteDomain.VERSION,revision:current.revision||0,updatedAt:current.updatedAt||new Date().toISOString(),activeId:state.activeSetlistId,setlists:state.setlists,library:state.library,trash:state.trash,sessions:state.sessions,activeSession:state.activeSession};
}
function saveSetlists(){
  const setlist=activeSetlist();if(setlist)setlist.updatedAt=new Date().toISOString();
  state.workspace=workspaceSnapshot();
  const ok=EstanteStorage.save(state.workspace);
  if(!ok)notify("Não foi possível salvar. Exporte uma cópia antes de fechar.");
  return ok;
}
function saveSetlistsSoon(){saveSoon("setlists",saveSetlists)}
function setActiveSongs(list){const s=activeSetlist();if(!s)return;s.songs=list.map(storedSong);bindActiveSetlist();state.library=EstanteDomain.rebuildLibrary(state.setlists,state.library);saveSetlists()}

async function loadSetlists(){
  const indexed=await EstanteStorage.load();
  const v3=load(KEYS.setlists,null);
  const legacy=load(KEYS.setlist,null)||load("estante:repertorio",null)||[];
  state.workspace=EstanteDomain.migrate(indexed||v3,legacy);
  state.setlists=state.workspace.setlists;
  state.activeSetlistId=state.workspace.activeId;
  state.library=state.workspace.library;
  state.trash=state.workspace.trash;
  state.sessions=state.workspace.sessions;
  state.activeSession=state.workspace.activeSession;
  bindActiveSetlist();
  if(!indexed)saveSetlists();
  EstanteStorage.listen(()=>notify("Este repertório mudou em outra aba.",false,{label:"Recarregar",run:()=>location.reload()}));
  EstanteStorage.requestPersistence();
}

function libraryRecordFor(song){
  return state.library.find(x=>x.id===song.songId)||state.library.find(x=>x.identity===EstanteDomain.songIdentity(song));
}
function syncArrangement(song,fields){
  if(!song||song.kind==="note")return;
  let record=libraryRecordFor(song);
  if(!record){state.library=EstanteDomain.rebuildLibrary(state.setlists,state.library);record=libraryRecordFor(song)}
  if(!record)return;
  song.songId=record.id;
  let arrangement=(record.arrangements||[]).find(x=>x.id===song.arrangementId);
  if(!arrangement){
    arrangement={id:song.arrangementId,name:song.arrangementName||"Principal",revision:song.revision||1,updatedAt:song.updatedAt,current:storedSong(song),history:song.history||[]};
    record.arrangements.push(arrangement);
  }
  if(fields){
    fields.forEach(field=>{arrangement.current[field]=song[field]});
    arrangement.updatedAt=new Date().toISOString();
  }else{
    arrangement.name=song.arrangementName||arrangement.name;
    arrangement.revision=song.revision||arrangement.revision;
    arrangement.updatedAt=song.updatedAt||new Date().toISOString();
    arrangement.current=storedSong(song);
    arrangement.history=EstanteDomain.clone(song.history||[]).slice(-20);
  }
  record.title=song.title;record.artist=song.artist;record.identity=EstanteDomain.songIdentity(song);record.updatedAt=arrangement.updatedAt;
}
function commitSongRevision(song,previous,reason){const revised=EstanteDomain.revise(song,previous,reason);syncArrangement(revised);return revised}
function updateArrangementEverywhere(song,previous,reason="Arranjo atualizado"){
  const revised=commitSongRevision(song,previous,reason);
  state.setlists.forEach(setlist=>setlist.songs.forEach((item,index)=>{if(item.kind!=="note"&&item.arrangementId===previous.arrangementId){const copy=storedSong(revised);copy.id=item.id;setlist.songs[index]=copy}}));
  state.current=revised;bindActiveSetlist();return revised;
}
function detachArrangement(song,previous,reason="Versão do repertório"){
  const draft={...song,arrangementId:EstanteDomain.uid("arr"),arrangementName:song.arrangementName||"Versão do repertório",detached:true,history:[]};
  const revised=EstanteDomain.revise(draft,{...previous,arrangementId:draft.arrangementId,history:[],revision:1},reason);
  syncArrangement(revised);return revised;
}

function createSetlist(name,songs){
  const s=makeSetlist(name,(songs||[]).map(storedSong));
  state.setlists.push(s);state.activeSetlistId=s.id;state.currentIndex=-1;
  bindActiveSetlist();state.library=EstanteDomain.rebuildLibrary(state.setlists,state.library);saveSetlists();return s;
}
function renameSetlist(id,name){const s=state.setlists.find(x=>x.id===id);if(!s||!name)return;s.name=String(name).slice(0,60);saveSetlists()}
function duplicateSetlist(id){const s=state.setlists.find(x=>x.id===id);if(!s)return;createSetlist(`${s.name} (cópia)`,s.songs.map(song=>({...storedSong(song),id:EstanteDomain.uid("item")})))}
function switchSetlist(id){
  if(!state.setlists.some(s=>s.id===id))return false;
  if(state.activeSession&&state.activeSession.setlistId!==id){notify("Encerre o ensaio atual antes de trocar de repertório.");return false}
  state.activeSetlistId=id;state.currentIndex=-1;bindActiveSetlist();saveSetlists();return true;
}
function archiveSetlist(id){
  const s=state.setlists.find(x=>x.id===id);if(!s)return;
  if(state.activeSession&&state.activeSession.setlistId===id){notify("Encerre o ensaio antes de arquivar este repertório.");return false}
  s.archived=!s.archived;
  if(s.archived&&state.setlists.some(x=>!x.archived)){state.activeSetlistId=state.setlists.find(x=>!x.archived).id;bindActiveSetlist()}
  saveSetlists();return true;
}
function deleteSetlist(id){
  const i=state.setlists.findIndex(s=>s.id===id);if(i<0)return;
  if(state.activeSession&&state.activeSession.setlistId===id){notify("Encerre o ensaio antes de mover este repertório para a lixeira.");return false}
  const removed=EstanteDomain.clone(state.setlists[i]);
  if(state.setlists.length===1)state.setlists[0].songs=[];
  else{state.setlists.splice(i,1);if(state.activeSetlistId===id)state.activeSetlistId=state.setlists[Math.max(0,i-1)].id}
  state.trash.push({id:EstanteDomain.uid("trash"),removedAt:new Date().toISOString(),setlistId:id,index:i,item:{kind:"setlist",...removed}});
  state.trash=state.trash.slice(-100);state.currentIndex=-1;bindActiveSetlist();saveSetlists();return true;
}
function restoreTrash(id){
  const index=state.trash.findIndex(x=>x.id===id);if(index<0)return;
  const entry=state.trash.splice(index,1)[0];
  if(entry.item.kind==="setlist"){const restored=normalizeSetlist(entry.item);state.setlists.splice(Math.min(entry.index,state.setlists.length),0,restored);state.activeSetlistId=restored.id}
  else{const setlist=state.setlists.find(x=>x.id===entry.setlistId)||activeSetlist();if(setlist)setlist.songs.splice(Math.min(entry.index,setlist.songs.length),0,storedSong(entry.item))}
  bindActiveSetlist();saveSetlists();renderList();
}

function addSetlistNote(title="Pausa",duration=0,notes=""){
  state.setlist.push(EstanteDomain.normalizeSong({kind:"note",title,duration,notes}));
  saveSetlists();renderList();
}
function setSongStatus(index,status){
  const song=state.setlist[index];if(!song||song.kind==="note"||!EstanteDomain.STATUSES.includes(status))return;
  song.status=status;syncArrangement(song,["status"]);saveSetlistsSoon();renderList();
}
function beginRehearsal(){
  if(state.activeSession)return state.activeSession;
  state.activeSession=EstanteDomain.newSession(state.activeSetlistId,state.setlist);
  saveSetlists();renderList();return state.activeSession;
}
function endRehearsal(notes=""){
  if(!state.activeSession)return null;
  const session=EstanteDomain.finishSession(state.activeSession,state.setlist,notes);
  state.sessions.push(session);state.sessions=state.sessions.slice(-200);state.activeSession=null;saveSetlists();renderList();return session;
}
function rehearsalHistory(){return state.sessions.filter(x=>x.setlistId===state.activeSetlistId).sort((a,b)=>String(b.startedAt).localeCompare(String(a.startedAt)))}

function setlistDuration(songs){
  let total=0,unknown=0;
  (songs||[]).forEach(s=>{if(s.duration>0)total+=s.duration;else if(s.kind!=="note")unknown++});
  return{total,unknown};
}
function durationLabel(songs){
  const{total,unknown}=setlistDuration(songs);
  if(!total&&unknown)return`${unknown} sem duração conhecida`;
  const h=Math.floor(total/3600),m=Math.round((total%3600)/60);
  const tempo=h?`${h}h${String(m).padStart(2,"0")}`:`${m} min`;
  return unknown?`≈ ${tempo} (+${unknown} sem duração)`:`≈ ${tempo}`;
}
function renderSetlistBar(){
  const bar=$("setlistBar"),summary=$("setlistSummary"),showing=state.tab==="setlist"||state.tab==="rehearsal";
  bar.hidden=!showing;summary.hidden=!showing;if(!showing)return;
  const sel=$("setlistSelect");sel.textContent="";
  state.setlists.forEach(s=>{const o=document.createElement("option");o.value=s.id;o.textContent=`${s.archived?"Arquivado · ":""}${s.name} (${s.songs.filter(x=>x.kind!=="note").length})`;o.selected=s.id===state.activeSetlistId;sel.appendChild(o)});
  const ready=EstanteDomain.readiness(state.setlist),progress=EstanteDomain.progress(state.setlist);
  summary.textContent=state.setlist.length?`${ready.total} músicas · ${durationLabel(state.setlist)} · offline ${ready.ready}/${ready.total} · ${progress.ready} prontas`:"Repertório vazio.";
  const archive=$("setlistArchive");if(archive)archive.textContent=activeSetlist()?.archived?"Desarquivar":"Arquivar";
}
