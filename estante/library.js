"use strict";

function libraryItems(){
  return state.library.flatMap(record=>(record.arrangements||[]).map(arrangement=>({...storedSong(arrangement.current),songId:record.id,arrangementId:arrangement.id,arrangementName:arrangement.name,_library:true})));
}
function visibleItems(){
  if(state.tab==="results")return state.results;
  if(state.tab==="library")return libraryItems();
  return state.setlist;
}
function emptyMessage(){
  if(state.tab==="results")return"Busque por artista e música. Use Por trecho quando lembrar apenas uma parte da letra.";
  if(state.tab==="library")return"Sua biblioteca será formada pelas músicas salvas em repertórios.";
  if(state.tab==="rehearsal")return"Adicione músicas ao repertório para começar um ensaio.";
  return"Seu repertório está vazio. Abra uma música e toque em + Repertório.";
}
function renderList(){
  const data=visibleItems(),list=$("list");list.textContent="";$("setlistCount").textContent=state.setlist.filter(x=>x.kind!=="note").length;
  const libraryCount=$("libraryCount");if(libraryCount)libraryCount.textContent=state.library.length;
  document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===state.tab));
  renderSetlistBar();
  const libraryTools=$("libraryTools");if(libraryTools)libraryTools.hidden=state.tab!=="library";
  const rehearsalTools=$("rehearsalTools");if(rehearsalTools)rehearsalTools.hidden=state.tab!=="rehearsal";
  if(!data.length){list.innerHTML=`<div class="empty">${emptyMessage()}</div>`;return}
  data.forEach((m,i)=>{
    if(m.kind==="note"){list.appendChild(renderNoteRow(m,i));return}
    const row=document.createElement("div");row.className="listRow";row.dataset.index=String(i);
    if(state.tab==="setlist"||state.tab==="rehearsal"){row.draggable=true;row.addEventListener("dragstart",e=>e.dataTransfer.setData("text/plain",String(i)));row.addEventListener("dragover",e=>e.preventDefault());row.addEventListener("drop",e=>{e.preventDefault();const from=Number(e.dataTransfer.getData("text/plain"));moveSongTo(from,i)})}
    if(state.tab==="library"){
      const pick=document.createElement("input");pick.type="checkbox";pick.className="libraryPick";pick.checked=state.selectedLibrary.has(m.arrangementId);pick.setAttribute("aria-label",`Selecionar ${m.title}`);pick.onchange=()=>{pick.checked?state.selectedLibrary.add(m.arrangementId):state.selectedLibrary.delete(m.arrangementId);updateLibrarySelection()};row.appendChild(pick);
    }
    const b=document.createElement("button");b.className="songItem";
    if((state.tab==="setlist"||state.tab==="rehearsal")&&i===state.currentIndex)b.classList.add("current");
    const tags=[];
    if(state.tab==="setlist"||state.tab==="rehearsal")tags.push(`<span class="tag">${i+1}/${data.length}</span>`);
    if(state.tab==="results"){
      if(m.local)tags.push(`<span class="tag local">${m.matchedLyrics?"na letra · sua biblioteca":"na sua biblioteca"}</span>`);
      else if(m.acervo)tags.push(`<span class="tag local">${m.matchedLyrics?"na letra · acervo":"acervo do site"}</span>`);
      else if(m.lyrics&&!m.synced)tags.push('<span class="tag">com letra</span>');
    }
    if(m.arrangementName)tags.push(`<span class="tag arrangement">${esc(m.arrangementName)}</span>`);
    if(m.status)tags.push(`<span class="tag status ${m.status}">${EstanteDomain.STATUS_LABELS[m.status]||m.status}</span>`);
    if(m.key)tags.push(`<span class="tag key">tom ${m.key>0?"+":""}${m.key}</span>`);if(m.capo)tags.push(`<span class="tag key">capo ${m.capo}</span>`);if(m.auto)tags.push('<span class="tag key">auto</span>');if(m.synced)tags.push('<span class="tag sync">sincro</span>');if(m.duration)tags.push(`<span class="tag">${fmt(m.duration)}</span>`);if(m.revision>1)tags.push(`<span class="tag">rev. ${m.revision}</span>`);
    b.innerHTML=`<strong>${esc(m.title)}</strong><small>${esc(m.artist||"sem artista")}</small>${tags.length?`<div class="tags">${tags.join("")}</div>`:""}`;
    b.onclick=()=>{state.currentIndex=state.tab==="setlist"||state.tab==="rehearsal"?i:state.setlist.findIndex(x=>x.arrangementId&&x.arrangementId===m.arrangementId||sameSong(x,m));openSong(m);if(matchMedia("(max-width:900px)").matches)closeSidebar();renderList()};row.appendChild(b);
    if(state.tab==="setlist")row.appendChild(setlistActions(i,data.length));
    if(state.tab==="rehearsal")row.appendChild(statusControl(m,i));
    if(state.tab==="library")row.appendChild(rowButton("＋",false,()=>addSongToActive(m),"addOne"));
    list.appendChild(row);
  });
  updateLibrarySelection();renderRehearsalSummary();
}
function renderNoteRow(note,index){
  const row=document.createElement("div");row.className="listRow noteRow";row.draggable=true;
  row.addEventListener("dragstart",e=>e.dataTransfer.setData("text/plain",String(index)));row.addEventListener("dragover",e=>e.preventDefault());row.addEventListener("drop",e=>{e.preventDefault();moveSongTo(Number(e.dataTransfer.getData("text/plain")),index)});
  const body=document.createElement("div");body.className="songItem noteItem";body.innerHTML=`<strong>${esc(note.title)}</strong><small>${note.duration?fmt(note.duration):"marcação"}${note.notes?` · ${esc(note.notes)}`:""}</small>`;row.appendChild(body);
  row.appendChild(setlistActions(index,state.setlist.length));return row;
}
function setlistActions(i,length){const actions=document.createElement("div");actions.className="rowActions";actions.append(rowButton("↑",i===0,()=>moveSong(i,-1)),rowButton("↓",i===length-1,()=>moveSong(i,1)),rowButton("×",false,()=>removeSong(i),"remove"));return actions}
function statusControl(song,index){const select=document.createElement("select");select.className="statusSelect";select.setAttribute("aria-label",`Estado de ${song.title}`);EstanteDomain.STATUSES.forEach(status=>{const option=document.createElement("option");option.value=status;option.textContent=EstanteDomain.STATUS_LABELS[status];option.selected=song.status===status;select.appendChild(option)});select.onchange=()=>setSongStatus(index,select.value);return select}
function updateLibrarySelection(){const out=$("librarySelection");if(out)out.textContent=state.selectedLibrary.size?`${state.selectedLibrary.size} selecionada${state.selectedLibrary.size===1?"":"s"}`:"Selecione arranjos para adicionar"}
function renderRehearsalSummary(){
  const out=$("rehearsalSummary");if(!out)return;
  const progress=EstanteDomain.progress(state.setlist),history=rehearsalHistory();
  out.textContent=`${progress.learning} a aprender · ${progress.rehearsing} em ensaio · ${progress.ready} prontas · ${history.length} ensaio${history.length===1?"":"s"} registrado${history.length===1?"":"s"}`;
  const start=$("rehearsalStart"),finish=$("rehearsalFinish");if(start)start.hidden=!!state.activeSession;if(finish)finish.hidden=!state.activeSession;
}

function renderSectionBar(){
  const bar=$("sectionBar");bar.textContent="";
  const marcas=state.lines.map((l,i)=>({l,i})).filter(x=>x.l.type==="section");
  bar.hidden=marcas.length<2;if(bar.hidden)return;
  marcas.forEach(({l,i})=>{
    const group=document.createElement("span");group.className="sectionShortcut";
    const b=document.createElement("button");b.type="button";const note=state.current?.sectionNotes?.[l.text]||"";b.textContent=l.text+(note?" •":"");b.onclick=()=>{scrollToLine(i);showSectionNote(l.text)};
    const edit=document.createElement("button");edit.type="button";edit.className="sectionEdit";edit.textContent="✎";edit.setAttribute("aria-label",`Anotar seção ${l.text}`);edit.onclick=()=>editSectionNote(l.text);
    group.append(b,edit);bar.appendChild(group);
  });
}
function scrollToLine(i){if(state.syncing&&state.lrc[i])return seekSync(i);const n=$("paper").children[i];if(!n)return;$("paperViewport").scrollTo({top:Math.max(0,n.offsetTop-16),behavior:state.scrolling?"auto":"smooth"})}
function showSectionNote(section){
  const global=state.current?.notes||"",specific=state.current?.sectionNotes?.[section]||"",bar=$("songNotes");
  bar.textContent=[global,specific&&`${section}: ${specific}`].filter(Boolean).join("\n");bar.hidden=!bar.textContent;
}
function editSectionNote(section){
  if(!state.current)return;
  const current=state.current.sectionNotes?.[section]||"",value=prompt(`Anotação de ${section}`,current);if(value===null)return;
  state.current.sectionNotes={...(state.current.sectionNotes||{})};
  if(value.trim())state.current.sectionNotes[section]=value.trim();else delete state.current.sectionNotes[section];
  persistCurrent(["sectionNotes"]);renderSectionBar();showSectionNote(section);notify("Anotação da seção salva.",true);
}
function rowButton(text,disabled,fn,cls=""){const b=document.createElement("button");b.type="button";b.textContent=text;b.disabled=disabled;b.className=cls;b.onclick=e=>{e.stopPropagation();fn()};return b}

function normalizeSong(m={}){return EstanteDomain.normalizeSong(m)}
function storedSong(m){return EstanteDomain.normalizeSong(m)}
function addSong(){if(!state.current)return;addSongToActive(state.current)}
function addSongToActive(source){
  const candidate=storedSong(source);
  const exists=state.setlist.some(x=>x.kind!=="note"&&x.arrangementId===candidate.arrangementId);
  if(exists)return notify("Esse arranjo já está no repertório.",true);
  const previousIndex=state.currentIndex;
  candidate.id=EstanteDomain.uid("item");state.setlist.push(candidate);state.currentIndex=state.setlist.length-1;
  state.library=EstanteDomain.rebuildLibrary(state.setlists,state.library);syncArrangement(candidate);
  if(!saveSetlists()){state.setlist.pop();state.currentIndex=previousIndex;return}
  state.tab="setlist";renderList();updateSaveButton();notify("Adicionada ao repertório.",true);
}
function addSelectedLibrary(){
  const selected=libraryItems().filter(x=>state.selectedLibrary.has(x.arrangementId));let added=0;
  selected.forEach(song=>{if(!state.setlist.some(x=>x.arrangementId===song.arrangementId)){const item=storedSong(song);item.id=EstanteDomain.uid("item");state.setlist.push(item);added++}});
  if(added){saveSetlists();state.selectedLibrary.clear();state.tab="setlist";renderList();notify(`${added} arranjo${added===1?"":"s"} adicionado${added===1?"":"s"}.`,true)}else notify("Os arranjos selecionados já estão neste repertório.");
}
function removeSong(i){
  const removed=state.setlist.splice(i,1)[0];if(!removed)return;
  const trash={id:EstanteDomain.uid("trash"),removedAt:new Date().toISOString(),setlistId:state.activeSetlistId,index:i,item:storedSong(removed)};state.trash.push(trash);state.trash=state.trash.slice(-100);
  if(i<state.currentIndex)state.currentIndex--;else if(i===state.currentIndex)state.currentIndex=-1;if(state.currentIndex>=state.setlist.length)state.currentIndex=state.setlist.length-1;
  saveSetlists();renderList();updateSaveButton();notify("Item removido.",true,{label:"Desfazer",run:()=>restoreTrash(trash.id)});
}
function moveSongTo(i,j){
  if(!Number.isInteger(i)||!Number.isInteger(j)||i===j||i<0||j<0||i>=state.setlist.length||j>=state.setlist.length)return;
  const[x]=state.setlist.splice(i,1);state.setlist.splice(j,0,x);
  if(state.currentIndex===i)state.currentIndex=j;else if(i<state.currentIndex&&j>=state.currentIndex)state.currentIndex--;else if(i>state.currentIndex&&j<=state.currentIndex)state.currentIndex++;
  saveSetlists();renderList();
}
function moveSong(i,d){moveSongTo(i,Math.max(0,Math.min(state.setlist.length-1,i+d)))}
function jumpSong(d){
  if(!state.setlist.length)return;
  let i=state.currentIndex<0?(d>0?-1:state.setlist.length):state.currentIndex;
  do{i+=d}while(i>=0&&i<state.setlist.length&&state.setlist[i].kind==="note");
  if(i<0||i>=state.setlist.length)return;
  state.currentIndex=i;state.tab="setlist";openSong(state.setlist[i]);renderList();
}

const LRC_TIME=/\[(\d+):(\d+(?:[.:]\d+)?)\]/g;
const LRC_META=/\[[a-z]{2,10}:[^\]]*\]/gi;
function parseLRC(text){
  const out=[];
  text.split(/\r?\n/).forEach(line=>{const marks=[...line.matchAll(LRC_TIME)];if(!marks.length)return;const body=line.replace(LRC_TIME,"").replace(LRC_META,"").trim();marks.forEach(m=>out.push({t:+m[1]*60+parseFloat(m[2].replace(":",".")),text:body}))});
  return out.sort((a,b)=>a.t-b.t);
}
function hasLRC(t){return /\[\d+:\d+/.test(t)}
function classify(line){if(!line.trim())return{text:"",type:"blank"};if(/^\s*[\[(].{1,28}[\])]\s*$/.test(line))return{text:line.trim().replace(/^[\[(]|[\])]$/g,""),type:"section"};const parts=line.trim().split(/\s+/);if(parts.length<=14&&parts.every(x=>CHORD.test(x)))return{text:line.replace(/\s+$/,""),type:"chord"};return{text:line,type:"lyric"}}
function moveNote(note,n,flat){let i=SHARP.indexOf(note);if(i<0)i=FLAT.indexOf(note);if(i<0)return note;return(flat?FLAT:SHARP)[((i+n)%12+12)%12]}
function transposeChord(c,n){if(!CHORD.test(c))return c;const flat=/(^|\/)[A-G]b/.test(c);return c.replace(/(^|\/)([A-G][#b]?)/g,(_,p,note)=>p+moveNote(note,n,flat))}
function transposeLine(line,n){if(!n)return line;let out="",end=0,debt=0,m;const re=/\S+/g;while((m=re.exec(line))){let gap=line.slice(end,m.index);if(debt>0){const eat=Math.min(debt,Math.max(0,gap.length-1));gap=gap.slice(eat);debt-=eat}else if(debt<0){gap+=" ".repeat(-debt);debt=0}const x=transposeChord(m[0],n);debt+=x.length-m[0].length;out+=gap+x;end=m.index+m[0].length}return out+line.slice(end)}
