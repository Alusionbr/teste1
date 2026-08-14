"use strict";
function renderList(){
  const data=state.tab==="results"?state.results:state.setlist;$("list").innerHTML="";$("setlistCount").textContent=state.setlist.length;
  document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===state.tab));
  renderSetlistBar();
  if(!data.length){$("list").innerHTML=`<div class="empty">${state.tab==="results"?"Busque por artista e música. Use Por trecho quando lembrar apenas uma parte da letra.":"Seu repertório está vazio. Abra uma música e toque em + Repertório."}</div>`;return}
  data.forEach((m,i)=>{
    const row=document.createElement("div");row.className="listRow";
    const b=document.createElement("button");b.className="songItem";if(state.tab==="setlist"&&i===state.currentIndex)b.classList.add("current");
    const tags=[];if(state.tab==="setlist")tags.push(`<span class="tag">${i+1}/${data.length}</span>`);if(m.key)tags.push(`<span class="tag key">tom ${m.key>0?"+":""}${m.key}</span>`);if(m.capo)tags.push(`<span class="tag key">capo ${m.capo}</span>`);if(m.synced)tags.push('<span class="tag sync">sincro</span>');if(m.duration)tags.push(`<span class="tag">${fmt(m.duration)}</span>`);if(m.source)tags.push(`<span class="tag">${esc(m.source)}</span>`);
    b.innerHTML=`<strong>${esc(m.title)}</strong><small>${esc(m.artist||"sem artista")}</small>${tags.length?`<div class="tags">${tags.join("")}</div>`:""}`;
    b.onclick=()=>{if(state.tab==="setlist")state.currentIndex=i;else state.currentIndex=-1;openSong(m);if(matchMedia("(max-width:900px)").matches)$("sidebar").classList.remove("open");renderList()};row.appendChild(b);
    if(state.tab==="setlist"){const a=document.createElement("div");a.className="rowActions";a.append(rowButton("↑",i===0,()=>moveSong(i,-1)),rowButton("↓",i===data.length-1,()=>moveSong(i,1)),rowButton("×",false,()=>removeSong(i),"remove"));row.appendChild(a)}
    $("list").appendChild(row);
  });
}
function rowButton(text,disabled,fn,cls=""){const b=document.createElement("button");b.textContent=text;b.disabled=disabled;b.className=cls;b.onclick=e=>{e.stopPropagation();fn()};return b}
function normalizeSong(m={}){return{title:m.title??m.titulo??"Sem título",artist:m.artist??m.artista??"",album:m.album||"",duration:m.duration??m.duracao??0,lyrics:m.lyrics??m.letra??"",synced:m.synced??m.sincronizada??"",instrumental:!!m.instrumental,source:m.source??m.fonte??"",vagUrl:m.vagUrl??m.urlVagalume??"",key:Number(m.key)||0,capo:Number(m.capo)||0,speed:Number(m.speed)||0,notes:String(m.notes||"")}}
function storedSong(m){return normalizeSong(m)}
function addSong(){if(!state.current)return;const exists=state.setlist.some(x=>sameSong(x,state.current));if(exists)return notify("Essa música já está no repertório.",true);state.setlist.push(storedSong(state.current));saveSetlists();state.tab="setlist";renderList();updateSaveButton();notify("Adicionada ao repertório.",true)}
function removeSong(i){state.setlist.splice(i,1);if(i<state.currentIndex)state.currentIndex--;else if(i===state.currentIndex)state.currentIndex=-1;if(state.currentIndex>=state.setlist.length)state.currentIndex=state.setlist.length-1;saveSetlists();renderList();updateSaveButton()}
function moveSong(i,d){const j=Math.max(0,Math.min(state.setlist.length-1,i+d));if(i===j)return;const[x]=state.setlist.splice(i,1);state.setlist.splice(j,0,x);if(state.currentIndex===i)state.currentIndex=j;else if(i<state.currentIndex&&j>=state.currentIndex)state.currentIndex--;else if(i>state.currentIndex&&j<=state.currentIndex)state.currentIndex++;saveSetlists();renderList()}
function jumpSong(d){if(!state.setlist.length)return;let i=state.currentIndex<0?(d>0?0:state.setlist.length-1):state.currentIndex+d;i=Math.max(0,Math.min(state.setlist.length-1,i));state.currentIndex=i;state.tab="setlist";openSong(state.setlist[i]);renderList()}

function parseLRC(text){const out=[];text.split(/\r?\n/).forEach(line=>{const marks=[...line.matchAll(/\[(\d+):(\d+(?:[.:]\d+)?)\]/g)];const body=line.replace(/\[[^\]]*\]/g,"").trim();marks.forEach(m=>out.push({t:+m[1]*60+parseFloat(m[2].replace(":",".")),text:body}))});return out.sort((a,b)=>a.t-b.t)}
function hasLRC(t){return /\[\d+:\d+/.test(t)}
function classify(line){if(!line.trim())return{text:"",type:"blank"};if(/^\s*[\[(].{1,28}[\])]\s*$/.test(line))return{text:line.trim().replace(/^[\[(]|[\])]$/g,""),type:"section"};const parts=line.trim().split(/\s+/);if(parts.length<=14&&parts.every(x=>CHORD.test(x)))return{text:line.replace(/\s+$/,"") ,type:"chord"};return{text:line,type:"lyric"}}
function moveNote(note,n,flat){let i=SHARP.indexOf(note);if(i<0)i=FLAT.indexOf(note);if(i<0)return note;return(flat?FLAT:SHARP)[((i+n)%12+12)%12]}
function transposeChord(c,n){if(!CHORD.test(c))return c;const flat=/(^|\/)[A-G]b/.test(c);return c.replace(/(^|\/)([A-G][#b]?)/g,(_,p,note)=>p+moveNote(note,n,flat))}
function transposeLine(line,n){if(!n)return line;let out="",end=0,debt=0,m;const re=/\S+/g;while((m=re.exec(line))){let gap=line.slice(end,m.index);if(debt>0){const eat=Math.min(debt,Math.max(0,gap.length-1));gap=gap.slice(eat);debt-=eat}else if(debt<0){gap+=" ".repeat(-debt);debt=0}const x=transposeChord(m[0],n);debt+=x.length-m[0].length;out+=gap+x;end=m.index+m[0].length}return out+line.slice(end)}
