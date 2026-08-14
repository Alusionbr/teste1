"use strict";
function normalizeSong(m={}){return{title:m.title??m.titulo??"Sem título",artist:m.artist??m.artista??"",album:m.album||"",duration:m.duration??m.duracao??0,lyrics:m.lyrics??m.letra??"",synced:m.synced??m.sincronizada??"",instrumental:!!m.instrumental,source:m.source??m.fonte??"",vagUrl:m.vagUrl??m.urlVagalume??""}}
function storedSong(m){return normalizeSong(m)}
function addSong(){
  if(!state.current)return;
  if(state.setlist.some(x=>x.title===state.current.title&&x.artist===state.current.artist))return notify("Essa música já está no repertório.",true);
  state.setlist.push(storedSong(state.current));save(KEYS.setlist,state.setlist);state.tab="setlist";renderList();updateSaveButton();notify("Adicionada ao repertório.",true)
}
function removeSong(i){state.setlist.splice(i,1);if(state.currentIndex>=state.setlist.length)state.currentIndex=state.setlist.length-1;save(KEYS.setlist,state.setlist);renderList();updateSaveButton()}
function moveSong(i,d){const j=Math.max(0,Math.min(state.setlist.length-1,i+d));if(i===j)return;const item=state.setlist.splice(i,1)[0];state.setlist.splice(j,0,item);if(state.currentIndex===i)state.currentIndex=j;save(KEYS.setlist,state.setlist);renderList()}
function jumpSong(d){if(!state.setlist.length)return;let i=state.currentIndex<0?(d>0?0:state.setlist.length-1):state.currentIndex+d;i=Math.max(0,Math.min(state.setlist.length-1,i));state.currentIndex=i;state.tab="setlist";openSong(state.setlist[i]);renderList()}
