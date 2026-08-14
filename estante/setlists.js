"use strict";
/*
 * Vários repertórios (um por show, por banda, por data).
 *
 * Modelo guardado em KEYS.setlists:
 *   { version:3, activeId, setlists:[ {id, name, date, songs:[música]} ] }
 *
 * state.setlist continua existindo e aponta para o array de músicas do
 * repertório ativo. Assim o resto do app (renderList, addSong, moveSong,
 * jumpSong, player) segue mexendo em state.setlist como sempre fez; só a
 * gravação passa por saveSetlists().
 */

function newSetlistId(){return "s"+Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
function makeSetlist(name,songs){return{id:newSetlistId(),name:name||"Repertório",date:"",songs:songs||[]}}
function normalizeSetlist(s){s=s||{};return{id:s.id||newSetlistId(),name:String(s.name||"Repertório").slice(0,60),date:s.date||"",songs:Array.isArray(s.songs)?s.songs.map(normalizeSong):[]}}

function activeSetlist(){return state.setlists.find(s=>s.id===state.activeSetlistId)||state.setlists[0]}
// Religa state.setlist ao array de músicas do repertório ativo (mesma referência).
function bindActiveSetlist(){const s=activeSetlist();state.setlist=s?s.songs:[]}
function saveSetlists(){return save(KEYS.setlists,{version:3,activeId:state.activeSetlistId,setlists:state.setlists})}
// Versão adiada, para ajuste que se repete (tom, capo, velocidade digitados na
// pedaleira). Ver o comentário de saveSoon() em core.js.
function saveSetlistsSoon(){saveSoon("setlists",saveSetlists)}

// Substitui as músicas do repertório ativo mantendo a referência viva.
function setActiveSongs(list){const s=activeSetlist();if(!s)return;s.songs=list.map(storedSong);bindActiveSetlist();saveSetlists()}

function loadSetlists(){
  const box=load(KEYS.setlists,null);
  if(box&&Array.isArray(box.setlists)&&box.setlists.length){
    state.setlists=box.setlists.map(normalizeSetlist);
    state.activeSetlistId=state.setlists.some(s=>s.id===box.activeId)?box.activeId:state.setlists[0].id;
  }else{
    // Primeira abertura na versão nova: traz o repertório único das versões
    // anteriores sem apagar as chaves antigas.
    const antigo=load(KEYS.setlist,null)||load("estante:repertorio",null)||[];
    state.setlists=[makeSetlist("Repertório",(antigo||[]).map(normalizeSong))];
    state.activeSetlistId=state.setlists[0].id;
    saveSetlists();
  }
  bindActiveSetlist();
}

function createSetlist(name,songs){
  const s=makeSetlist(name,(songs||[]).map(storedSong));
  state.setlists.push(s);state.activeSetlistId=s.id;state.currentIndex=-1;
  bindActiveSetlist();saveSetlists();return s;
}
function renameSetlist(id,name){const s=state.setlists.find(x=>x.id===id);if(!s||!name)return;s.name=String(name).slice(0,60);saveSetlists()}
function duplicateSetlist(id){const s=state.setlists.find(x=>x.id===id);if(!s)return;createSetlist(`${s.name} (cópia)`,s.songs)}
function switchSetlist(id){if(!state.setlists.some(s=>s.id===id))return;state.activeSetlistId=id;state.currentIndex=-1;bindActiveSetlist();saveSetlists()}
function deleteSetlist(id){
  const i=state.setlists.findIndex(s=>s.id===id);if(i<0)return;
  // Sempre sobra pelo menos um repertório: o último é esvaziado, não removido.
  if(state.setlists.length===1)state.setlists[0].songs=[];
  else{state.setlists.splice(i,1);if(state.activeSetlistId===id)state.activeSetlistId=state.setlists[Math.max(0,i-1)].id}
  state.currentIndex=-1;bindActiveSetlist();saveSetlists();
}

// Duração estimada: soma o que se sabe e conta quantas músicas não têm duração.
function setlistDuration(songs){
  let total=0,unknown=0;
  (songs||[]).forEach(s=>{if(s.duration>0)total+=s.duration;else unknown++});
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
  const bar=$("setlistBar"),summary=$("setlistSummary"),showing=state.tab==="setlist";
  bar.hidden=!showing;summary.hidden=!showing;
  if(!showing)return;
  const sel=$("setlistSelect");sel.textContent="";
  state.setlists.forEach(s=>{
    const o=document.createElement("option");
    o.value=s.id;o.textContent=`${s.name} (${s.songs.length})`;
    o.selected=s.id===state.activeSetlistId;
    sel.appendChild(o);
  });
  const songs=state.setlist;
  summary.textContent=songs.length?`${songs.length} música${songs.length===1?"":"s"} · ${durationLabel(songs)}`:"Repertório vazio.";
}
