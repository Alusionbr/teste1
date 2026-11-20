"use strict";
/*
 * "Adicionar pelo nome" (tela): escolhe o vídeo de karaokê sozinho, busca a letra
 * sincronizada e já põe a música na playlist. É o que o campo único de Nova música
 * e o "Adicionar várias de uma vez" usam (ui.js liga os botões).
 *
 * A escolha pode errar: toda música adicionada aqui volta com "Trocar vídeo" e
 * "Tirar". Se nenhum vídeo toca fora do YouTube e há letra, a música entra sem
 * playback (a família escolhe depois); sem vídeo e sem letra, nada é criado.
 */
const AUTO={};   // musicaId → {musica, item, video, alternativas, letra, jaExistia} da última adição

// Letra pela linha digitada. Com artista: busca exata (acharLetra); sem artista, a
// primeira da busca livre, que já vem com a sincronizada na frente. Falha vira null.
async function procurarLetraDaLinha(titulo,artista){
  try{
    if(artista){const x=await acharLetra({title:titulo,artist:artista});return x&&(x.synced||x.lyrics)?x:null}
    const lista=await buscarLetras(titulo);
    return lista.find(r=>r.synced||r.lyrics)||null;
  }catch{return null}
}

async function adicionarPeloNome({titulo,artista},{comLetra=true}={}){
  const ja=musicaParecida(titulo,artista);
  const precisaVideo=!(ja&&ja.playback),precisaLetra=comLetra&&!(ja&&temLetra(ja));
  const [letra,res]=await Promise.all([
    precisaLetra?procurarLetraDaLinha(titulo,artista):null,
    precisaVideo?resolverPlayback(`${titulo} ${artista}`.trim(),{chave:K.dados.prefs.keyYT,titulo,artista}).catch(erro=>({erro})):null
  ]);
  if(res&&res.erro&&!letra)throw res.erro;
  const video=res&&res.video||null;
  const playback=video?{tipo:"youtube",id:video.id,titulo:video.titulo}:null;
  const comTexto=letra?{synced:letra.synced,lyrics:letra.lyrics}:{};
  let m;
  if(ja)m=editarMusica(ja.id,{...(playback?{playback}:{}),...(letra&&!temLetra(ja)?comTexto:{})});
  else m=criarMusica({
    title:!artista&&letra&&letra.title?letra.title:titulo,
    artist:artista||(letra?letra.artist:""),
    album:letra?letra.album:"",
    duration:(letra&&letra.duration)||(video?video.duracao:0),
    ...comTexto,playback
  });
  const item=adicionarItem(garantirPlaylist(),m.id,"","");
  await salvarEstado();
  const alternativas=res?(res.alternativas||(res.erro&&res.erro.alternativas)||[]):[];
  const entrada={musica:m,item,video,alternativas,letra,jaExistia:!!ja,semVideo:precisaVideo&&!video,aviso:res&&res.aviso||""};
  AUTO[m.id]=entrada;
  return entrada;
}

function htmlEntradaAuto(e){
  const m=e.musica,v=e.video;
  const letra=temSincronia(m)?`<span class="selo ok">✓ letra sincronizada</span>`:temLetra(m)?`<span class="selo meio">letra sem tempo</span>`:`<span class="selo falta">sem letra</span>`;
  const dif=v&&e.letra&&e.letra.duration?diferencaDuracao(e.letra.duration,v.duracao):0;
  const linhaVideo=v
    ?`▶ ${esc(v.titulo)} · ${fmt(v.duracao)}${v.duvida?` · <b>confira se é este mesmo</b>`:""}${dif?` · vídeo ${dif>0?"mais longo":"mais curto"} que a letra (${Math.abs(dif)} s)`:""}`
    :(m.playback?`▶ ${esc(m.playback.titulo||"playback já salvo")}`:"⚠ nenhum vídeo que toque aqui: use “Escolher vídeo”");
  return `<li class="autoItem" data-musica="${esc(m.id)}"><div class="autoTexto"><b>${esc(m.title)}</b><small>${esc(m.artist)}${e.jaExistia?" · já estava nas músicas":""}</small><small>${linhaVideo}</small><span class="selos">${letra}</span></div>
    <div class="autoAcoes"><button type="button" data-auto="trocar">${v||m.playback?"Trocar vídeo":"Escolher vídeo"}</button><button type="button" data-auto="tirar">Tirar</button></div>
    <ul class="lista videos autoVideos" hidden></ul></li>`;
}
function htmlFalhaAuto(texto,mensagem){
  return `<li class="autoItem falhou"><div class="autoTexto"><b>${esc(texto)}</b><small>${esc(mensagem)}</small></div></li>`;
}

// Troca o playback da música (já conferido que toca) e devolve a entrada atualizada.
async function trocarVideoDaEntrada(musicaId,video){
  const e=AUTO[musicaId];if(!e)return null;
  const m=editarMusica(musicaId,{playback:{tipo:"youtube",id:video.id,titulo:video.titulo}});
  await salvarEstado();
  const anterior=e.video;
  e.alternativas=[...(anterior&&anterior.id!==video.id?[anterior]:[]),...(e.alternativas||[]).filter(x=>x.id!==video.id)];
  e.musica=m;e.video={...video,duvida:false};e.semVideo=false;
  return e;
}

// Tira da playlist; a música some junto só se foi criada agora (as que já existiam ficam).
async function tirarEntrada(musicaId){
  const e=AUTO[musicaId];if(!e)return;
  removerItem(playlistAtiva(),e.item&&e.item.id);
  if(!e.jaExistia)await removerMusica(musicaId);
  delete AUTO[musicaId];
  await salvarEstado();
}
