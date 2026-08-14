"use strict";
function renderList(){
  const data=state.tab==="results"?state.results:state.setlist;
  $("list").innerHTML=""; $("setlistCount").textContent=state.setlist.length;
  document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===state.tab));
  if(!data.length){
    $("list").innerHTML='<div class="empty">'+(state.tab==="results"?"Busque por artista e música. Use Por trecho quando lembrar apenas uma parte da letra.":"Seu repertório está vazio. Abra uma música e toque em + Repertório.")+'</div>';
    return;
  }
  data.forEach((m,i)=>{
    const row=document.createElement("div"); row.className="listRow";
    const b=document.createElement("button"); b.className="songItem";
    if(state.tab==="setlist"&&i===state.currentIndex)b.classList.add("current");
    b.innerHTML='<strong>'+esc(m.title)+'</strong><small>'+esc(m.artist||"sem artista")+'</small>';
    b.onclick=()=>{state.currentIndex=state.tab==="setlist"?i:-1;openSong(m);if(matchMedia("(max-width:900px)").matches)$("sidebar").classList.remove("open");renderList()};
    row.appendChild(b);
    if(state.tab==="setlist"){
      const a=document.createElement("div"); a.className="rowActions";
      a.append(rowButton("↑",i===0,()=>moveSong(i,-1)),rowButton("↓",i===data.length-1,()=>moveSong(i,1)),rowButton("×",false,()=>removeSong(i),"remove"));
      row.appendChild(a);
    }
    $("list").appendChild(row);
  });
}
function rowButton(text,disabled,fn,cls=""){const b=document.createElement("button");b.textContent=text;b.disabled=disabled;b.className=cls;b.onclick=e=>{e.stopPropagation();fn()};return b}
