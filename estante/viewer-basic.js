"use strict";
function openSong(song){
  stopAll();state.current=song;state.key=0;state.lines=[];state.lrc=[];
  $("songTitle").textContent=song.title||"Sem título";
  $("songArtist").textContent=(song.artist||"SEM ARTISTA").toUpperCase();
  $("paperViewport").scrollTop=0;$("paper").textContent="";$("credits").textContent="";
  state.lrc=song.synced?parseLRC(song.synced):[];
  const raw=song.lyrics||"";
  state.lines=state.lrc.length?state.lrc.map(x=>({text:x.text,type:x.text?"lyric":"blank"})):raw.split("\n").map(classify);
  renderPaper();$("syncBtn").disabled=!state.lrc.length;$("keyControl").hidden=!state.lines.some(x=>x.type==="chord");updateSaveButton();
  $("credits").textContent="Fonte: "+(song.source||"conteúdo local")+". Direitos reservados aos autores e editoras.";
}
function renderPaper(){const p=$("paper");p.textContent="";if(!state.lines.length){const d=document.createElement("div");d.className="emptyPaper";d.textContent="Esta versão não trouxe texto. Tente a fonte Sincronizada ou cole seu próprio conteúdo.";p.appendChild(d);return}state.lines.forEach((l,i)=>{const d=document.createElement("div");d.className="lineLyric "+l.type;d.dataset.i=i;d.textContent=l.type==="chord"?transposeLine(l.text,state.key):l.text;if(state.lrc.length)d.onclick=()=>seekSync(i);p.appendChild(d)})}
