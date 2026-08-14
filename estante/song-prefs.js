"use strict";
/*
 * Ajustes que pertencem à música, não ao aparelho: tom, capotraste, velocidade
 * de rolagem e anotações de palco.
 *
 * Antes tudo isso era global e se perdia ao trocar de música — no meio do show
 * era preciso refazer o tom a cada troca. Agora cada música do repertório
 * guarda os seus valores; músicas fora do repertório mantêm os ajustes só
 * enquanto estão abertas (e levam tudo junto ao serem salvas).
 *
 * O tamanho da letra continua global: é preferência de vista e de aparelho.
 */

// Deslocamento aplicado às cifras: o capotraste mostra as formas que a mão faz.
function chordShift(){return (state.key||0)-(state.capo||0)}

function applySongPrefs(song){
  state.key=Number(song&&song.key)||0;
  state.capo=Number(song&&song.capo)||0;
  state.speed=Number(song&&song.speed)||state.speedGlobal||18;
  renderSongNotes(song);
}

// Grava o ajuste na música aberta. persistCurrent() só escreve no disco quando
// a música faz parte do repertório ativo.
function rememberSongPref(field,value){
  if(!state.current)return;
  state.current[field]=value;
  persistCurrent();
  if(state.tab==="setlist")renderList();
}

function refreshChords(){
  const n=chordShift();
  $("paper").querySelectorAll(".chord").forEach(el=>{el.textContent=transposeLine(state.lines[+el.dataset.i].text,n)});
}

function changeKey(delta){
  state.key=Math.max(-11,Math.min(11,state.key+delta));
  updateControls();refreshChords();rememberSongPref("key",state.key);
}
function changeCapo(delta){
  state.capo=Math.max(0,Math.min(11,state.capo+delta));
  updateControls();refreshChords();rememberSongPref("capo",state.capo);
}
function changeSpeed(delta){
  state.speed=Math.max(4,Math.min(140,state.speed+delta));
  // A última velocidade usada também vira o padrão das próximas músicas.
  state.speedGlobal=state.speed;updatePrefs();
  updateControls();rememberSongPref("speed",state.speed);
}

function renderSongNotes(song){
  const bar=$("songNotes"),texto=(song&&song.notes)||"";
  bar.textContent=texto;bar.hidden=!texto;
  $("notesBtn").disabled=!state.current;
}
function saveSongNotes(texto){
  if(!state.current)return;
  state.current.notes=texto;
  renderSongNotes(state.current);
  persistCurrent();
  if(state.tab==="setlist")renderList();
}
