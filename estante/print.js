"use strict";
/*
 * Impressão do repertório: monta um bloco simples em #printArea e chama a
 * impressora do navegador (que também gera PDF). Serve para levar a lista no
 * papel ou mandar para a banda.
 *
 * Duas versões: só a lista (ordem do show) ou com as letras, para virar o
 * caderno do show.
 */

function printRow(song){
  const row=document.createElement("li");
  const head=document.createElement("div");
  head.className="printSong";
  head.innerHTML=`<strong>${esc(song.title)}</strong><span>${esc(song.artist||"sem artista")}</span>`;

  const marks=[];
  if(song.key)marks.push(`tom ${song.key>0?"+":""}${song.key}`);
  if(song.capo)marks.push(`capo ${song.capo}`);
  if(song.duration)marks.push(fmt(song.duration));
  if(marks.length){const m=document.createElement("span");m.className="printMarks";m.textContent=marks.join(" · ");head.appendChild(m)}
  row.appendChild(head);

  if(song.notes){const n=document.createElement("p");n.className="printNotes";n.textContent=song.notes;row.appendChild(n)}
  return row;
}

function printLyrics(song){
  const block=document.createElement("pre");
  block.className="printLyrics";
  const shift=(song.key||0)-(song.capo||0);
  const texto=song.lyrics||(song.synced||"").replace(/\[[^\]]*\]/g,"");
  block.textContent=texto.split(/\r?\n/).map(line=>{
    const l=classify(line);
    return l.type==="chord"?transposeLine(l.text,shift):line;
  }).join("\n");
  return block;
}

function buildPrintArea(withLyrics){
  const area=$("printArea");
  area.textContent="";
  const set=activeSetlist();
  const songs=state.setlist;

  const header=document.createElement("header");
  header.innerHTML=`<h1>${esc(set?set.name:"Repertório")}</h1><p>${songs.length} música${songs.length===1?"":"s"} · ${esc(durationLabel(songs))}</p>`;
  area.appendChild(header);

  const list=document.createElement("ol");
  songs.forEach(s=>{
    const row=printRow(s);
    if(withLyrics&&(s.lyrics||s.synced))row.appendChild(printLyrics(s));
    list.appendChild(row);
  });
  area.appendChild(list);
}

function printSetlist(withLyrics){
  if(!state.setlist.length)return notify("Adicione músicas ao repertório antes de imprimir.");
  buildPrintArea(withLyrics);
  $("printDialog").close();
  // Espera o layout assentar antes de abrir a impressão.
  requestAnimationFrame(()=>window.print());
}
