"use strict";
/*
 * Biblioteca: as músicas do aparelho, cada uma com letra e playback.
 */
/*
 * Catálogo compartilhado entre salas (supabase/002_catalogo.sql).
 * Só entra o que a família CONFIRMOU tocando: o palco chama compartilharPlayback quando o
 * vídeo toca por 10 s (palco.js, confirmarPlaybackDepoisDe). Antes isso acontecia ao salvar
 * a música, e um vídeo errado ou bloqueado virava "padrão da comunidade" para todas as salas.
 * Um envio por vídeo por sessão; se o catálogo estiver fora do ar, avisa uma vez só.
 */
const jaCompartilhados=new Set();let avisouCatalogo=false;
function compartilharPlayback(m){
  if(!m||m.playback?.tipo!=="youtube")return;
  const chave=m.title+"|"+m.artist+"|"+m.playback.id;
  if(jaCompartilhados.has(chave))return;
  jaCompartilhados.add(chave);
  salaRpc("karaoke_catalogo_salvar",{p_musica:m.title,p_artista:m.artist,p_video:m.playback.id,p_titulo:m.playback.titulo||m.title})
    .catch(()=>{jaCompartilhados.delete(chave);if(!avisouCatalogo){avisouCatalogo=true;notify("Música salva neste aparelho. O catálogo compartilhado está indisponível.")}});
}
function criarMusica(campos){
  const m=normalizarMusica({id:uid("m"),criadaEm:Date.now(),...campos});
  K.dados.musicas.push(m);
  return m;
}
function editarMusica(id,campos){
  const i=K.dados.musicas.findIndex(m=>m.id===id);
  if(i<0)return null;
  const nova=normalizarMusica({...K.dados.musicas[i],...campos,id});
  K.dados.musicas[i]=nova;
  return nova;
}
// Apagar música tira ela das playlists e apaga o áudio guardado (se houver).
async function removerMusica(id){
  const m=acharMusica(id);
  K.dados.musicas=K.dados.musicas.filter(x=>x.id!==id);
  K.dados.placar=(K.dados.placar||[]).filter(r=>r.musicaId!==id);
  K.dados.playlists.forEach(p=>{for(let i=p.itens.length-1;i>=0;i--)if(p.itens[i].musicaId===id)p.itens.splice(i,1)});
  if(m&&m.playback&&m.playback.tipo==="arquivo")try{await KStore.audio.apagar(m.playback.id)}catch{}
}
// Guarda o arquivo de áudio no aparelho e liga à música.
async function definirArquivo(musicaId,arquivo){
  if(!arquivo)return null;
  if(!/^audio\//.test(arquivo.type)&&!/\.(mp3|m4a|aac|ogg|oga|opus|wav|flac|webm)$/i.test(arquivo.name))throw Error("Escolha um arquivo de áudio (MP3, M4A, OGG, WAV…).");
  if(arquivo.size>80*1024*1024)throw Error("Arquivo grande demais (máximo 80 MB).");
  const chave="a-"+musicaId;
  await KStore.audio.guardar(chave,arquivo);
  return editarMusica(musicaId,{playback:{tipo:"arquivo",id:chave,titulo:arquivo.name.slice(0,160)}});
}

const temSincronia=m=>!!(m&&m.synced&&temLRC(m.synced));
const temLetra=m=>!!(m&&(temSincronia(m)||String(m.lyrics||"").trim()));
const letraDaMusica=m=>temSincronia(m)?m.synced:(m&&m.lyrics)||"";
const temDueto=m=>lerLetra(letraDaMusica(m)).linhas.some(l=>l.parte==="A"||l.parte==="B");

const ROTULO_PLAYBACK={youtube:"YouTube",spotify:"Spotify",arquivo:"Arquivo"};
function rotuloPlayback(m){return m&&m.playback?ROTULO_PLAYBACK[m.playback.tipo]:"Sem playback"}

function filtrarBiblioteca(q){
  const f=fold(q);
  const lista=[...K.dados.musicas].sort((a,b)=>fold(a.title).localeCompare(fold(b.title)));
  if(!f)return lista;
  return lista.filter(m=>fold(`${m.title} ${m.artist}`).includes(f)||fold(m.lyrics+" "+m.synced).includes(f));
}

// Mesma música já na biblioteca (título + artista, sem acento nem caixa)?
function musicaParecida(title,artist){
  const t=fold(title),a=fold(artist);
  return K.dados.musicas.find(m=>fold(m.title)===t&&fold(m.artist)===a)||null;
}
