"use strict";
/* Editar letra e tempos de uma música já aberta. */
const EDIT_LRC_TIME=/\[(\d+):(\d+(?:[.:]\d+)?)\]/g;
let timingRows=[];
function formatLrcTime(seconds){const total=Math.max(0,Math.round(Number(seconds)*100)/100),minutes=Math.floor(total/60),rest=(total-minutes*60).toFixed(2).padStart(5,"0");return "["+String(minutes).padStart(2,"0")+":"+rest+"]"}
function lrcTimingRows(text){const rows=[];text.split(/\r?\n/).forEach((line,lineIndex)=>{const marks=[...line.matchAll(EDIT_LRC_TIME)];if(!marks.length)return;const body=line.replace(EDIT_LRC_TIME,"").replace(/\[[a-z]{2,10}:[^\]]*\]/gi,"").trim();marks.forEach((mark,markIndex)=>rows.push({line:lineIndex,mark:markIndex,time:+mark[1]*60+parseFloat(mark[2].replace(":",".")),text:body||"(trecho sem texto)"}))});return rows}
function applyLrcTimings(text,rows){const byLine=new Map();rows.forEach(row=>{if(!byLine.has(row.line))byLine.set(row.line,[]);byLine.get(row.line).push(row)});return text.split(/\r?\n/).map((line,lineIndex)=>{const changes=byLine.get(lineIndex)||[],marks=[...line.matchAll(EDIT_LRC_TIME)];for(let k=marks.length-1;k>=0;k--){const row=changes.find(item=>item.mark===k);if(!row)continue;const replacement=formatLrcTime(row.time);line=line.slice(0,marks[k].index)+replacement+line.slice(marks[k].index+marks[k][0].length)}return line}).join("\n")}
function openSongEditor(){
  if(!state.current)return notify("Abra uma música antes de editar.");
  $("editTitle").value=state.current.title||"";$("editArtist").value=state.current.artist||"";$("editArrangement").value=state.current.arrangementName||"Principal";$("editText").value=state.current.synced||state.current.lyrics||"";
  const saved=state.setlist.some(x=>x.id===state.current.id||sameSong(x,state.current));$("editScope").disabled=!saved;$("editScope").value="arrangement";
  $("timingOpenBtn").hidden=!hasLRC($("editText").value);$("editDialog").showModal();
}
function openTimingEditor(){const rows=lrcTimingRows($("editText").value);if(!rows.length)return notify("Inclua marcas como [00:12.30] antes de ajustar os tempos.");timingRows=rows;const list=$("timingRows");list.innerHTML="";rows.forEach((row,index)=>{const item=document.createElement("div");item.className="timingRow";const input=document.createElement("input");input.type="number";input.min="0";input.step="0.01";input.value=row.time.toFixed(2);input.dataset.row=index;input.setAttribute("aria-label","Tempo do trecho "+(index+1));const text=document.createElement("span");text.className="timingText";text.textContent=row.text;const label=document.createElement("span");label.className="timingLabel";label.textContent="Trecho "+(index+1);item.append(input,label,text);list.append(item)});$("timingDialog").showModal()}
$("timingOpenBtn").addEventListener("click",openTimingEditor);$("editText").addEventListener("input",()=>$("timingOpenBtn").hidden=!hasLRC($("editText").value));$("timingForm").addEventListener("submit",event=>{if(event.submitter?.value==="cancel")return;event.preventDefault();const inputs=[...$("timingRows").querySelectorAll("input")];for(const input of inputs){const value=Number(input.value);if(!Number.isFinite(value)||value<0)return notify("Cada tempo precisa ser um número igual ou maior que zero.");timingRows[Number(input.dataset.row)].time=value}$("editText").value=applyLrcTimings($("editText").value,timingRows);$("timingDialog").close();notify("Tempos atualizados no editor. Clique em Salvar letra para gravar.",true)});
function openRevisionHistory(){
  const list=$("revisionList");list.textContent="";const history=(state.current?.history||[]).slice().reverse();
  if(!history.length)list.innerHTML='<div class="empty">Este arranjo ainda não tem versões anteriores.</div>';
  history.forEach(entry=>{const row=document.createElement("div");row.className="historyRow";const info=document.createElement("div");const date=new Date(entry.savedAt);info.innerHTML=`<strong>Revisão ${entry.revision}</strong><small>${esc(entry.reason||"Edição")} · ${Number.isNaN(date.getTime())?"data desconhecida":date.toLocaleString("pt-BR")}</small>`;const restore=document.createElement("button");restore.type="button";restore.textContent="Restaurar";restore.onclick=()=>restoreRevision(entry);row.append(info,restore);list.appendChild(row)});
  $("revisionDialog").showModal();
}
function restoreRevision(entry){
  if(!state.current||!entry?.snapshot)return;
  const i=state.setlist.findIndex(x=>x.id===state.current.id||sameSong(x,state.current));if(i<0)return notify("Salve esta música no repertório antes de restaurar versões.");
  const previous=storedSong(state.setlist[i]),snapshot=storedSong(entry.snapshot),draft={...snapshot,id:previous.id,songId:previous.songId,arrangementId:previous.arrangementId,history:previous.history};
  state.current=updateArrangementEverywhere(draft,previous,`Revisão ${entry.revision} restaurada`);state.setlist[i]=storedSong(state.current);saveSetlists();
  $("revisionDialog").close();$("editDialog").close();$("songTitle").textContent=state.current.title||"Sem título";$("songArtist").textContent=(state.current.artist||"SEM ARTISTA").toUpperCase();stopAll();renderCurrentLyrics();renderList();updateSaveButton();notify(`Revisão ${entry.revision} restaurada como nova revisão ${state.current.revision}.`,true);
}
$("revisionHistoryBtn").addEventListener("click",openRevisionHistory);$("revisionCloseBtn").onclick=()=>$("revisionDialog").close();
function saveSongEdit(){
  if(!state.current)return;
  const texto=$("editText").value;if(!texto.trim())return notify("A letra não pode ficar vazia.");
  const i=state.setlist.findIndex(x=>x.id===state.current.id||sameSong(x,state.current)),previous=storedSong(i>=0?state.setlist[i]:state.current),sync=hasLRC(texto);
  const draft=storedSong({...state.current,title:$("editTitle").value.trim()||state.current.title,artist:$("editArtist").value.trim(),arrangementName:$("editArrangement").value.trim()||"Principal",lyrics:sync?"":texto,synced:sync?texto:""});
  if(i>=0){
    state.current=$("editScope").value==="setlist"?detachArrangement(draft,previous):updateArrangementEverywhere(draft,previous);
    state.setlist[i]=storedSong(state.current);saveSetlists();
  }else state.current=draft;
  $("songTitle").textContent=state.current.title||"Sem título";$("songArtist").textContent=(state.current.artist||"SEM ARTISTA").toUpperCase();stopAll();renderCurrentLyrics();renderList();updateSaveButton();$("editDialog").close();notify(`Arranjo salvo como revisão ${state.current.revision||1}.`,true);
}
