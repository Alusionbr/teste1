"use strict";
/*
 * Editar a letra de uma música já aberta.
 *
 * As fontes públicas erram: trazem verso trocado, refrão faltando, cabeçalho de
 * site no meio do texto, cifra sem alinhamento. Até a versão anterior a única
 * saída era apagar a música e colar de novo — perdendo tom, capotraste,
 * velocidade e anotações junto.
 *
 * Aqui a letra é editada no lugar. Também serve para escrever o arranjo da
 * banda: marcar [Refrão], repetir a parte final, cortar o solo.
 */

function openSongEditor(){
  if(!state.current)return notify("Abra uma música antes de editar.");
  $("editTitle").value=state.current.title||"";
  $("editArtist").value=state.current.artist||"";
  // Letra temporizada (.lrc) é editada com as marcas de tempo à vista.
  $("editText").value=state.current.synced||state.current.lyrics||"";
  $("editDialog").showModal();
}

function saveSongEdit(){
  if(!state.current)return;
  const texto=$("editText").value;
  if(!texto.trim())return notify("A letra não pode ficar vazia.");
  // Título e artista formam a identidade da música (sameSong). Se mudarem, o
  // índice no repertório precisa ser achado ANTES da edição, senão a música
  // editada não seria reconhecida e viraria uma cópia órfã.
  const i=state.setlist.findIndex(x=>sameSong(x,state.current));
  const sync=hasLRC(texto);
  state.current.title=$("editTitle").value.trim()||state.current.title;
  state.current.artist=$("editArtist").value.trim();
  state.current.lyrics=sync?"":texto;
  state.current.synced=sync?texto:"";
  // Tom, capo, velocidade e anotações continuam como estavam: mudou o texto.
  if(i>=0){state.setlist[i]=storedSong(state.current);saveSetlists()}
  $("songTitle").textContent=state.current.title||"Sem título";
  $("songArtist").textContent=(state.current.artist||"SEM ARTISTA").toUpperCase();
  stopAll();renderCurrentLyrics();renderList();updateSaveButton();
  $("editDialog").close();
  notify("Letra atualizada.",true);
}
