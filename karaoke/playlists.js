"use strict";
/*
 * Playlists (filas da festa), compartilhamento por link e backup em arquivo.
 *
 * Importar NUNCA substitui sem perguntar: lerBackup() só resume o que vem, e a
 * tela pede Adicionar ou Substituir.
 */
function criarPlaylist(nome){
  const p={id:uid("p"),nome:String(nome||"").trim().slice(0,60)||"Nova playlist",itens:[],atualizadaEm:Date.now()};
  K.dados.playlists.push(p);
  K.dados.activePlaylistId=p.id;
  return p;
}
function removerPlaylist(id){
  K.dados.playlists=K.dados.playlists.filter(p=>p.id!==id);
  if(K.dados.activePlaylistId===id)K.dados.activePlaylistId=K.dados.playlists[0]?.id||"";
}
function adicionarItem(playlist,musicaId,cantorA,cantorB){
  if(!playlist||!acharMusica(musicaId))return null;
  const item={id:uid("i"),musicaId,cantorA:cantorA||"",cantorB:cantorB&&cantorB!==cantorA?cantorB:""};
  playlist.itens.push(item);playlist.atualizadaEm=Date.now();
  return item;
}
function moverItem(playlist,indice,delta){
  const j=indice+delta;
  if(!playlist||j<0||j>=playlist.itens.length)return false;
  const [x]=playlist.itens.splice(indice,1);playlist.itens.splice(j,0,x);playlist.atualizadaEm=Date.now();
  return true;
}
// Muda o array no lugar (splice): o palco aponta para este mesmo array.
function removerItem(playlist,itemId){
  if(!playlist)return;
  const i=playlist.itens.findIndex(x=>x.id===itemId);
  if(i>=0)playlist.itens.splice(i,1);
  playlist.atualizadaEm=Date.now();
}
function duracaoPlaylist(p){return(p?.itens||[]).reduce((s,i)=>s+(acharMusica(i.musicaId)?.duration||0),0)}
// Garante uma playlist para trabalhar (primeiro uso).
function garantirPlaylist(){return playlistAtiva()||criarPlaylist("Festa da família")}

/* ---------------------------------------------------------- link de convite */
/*
 * O link leva a playlist, os cantores dela e as músicas (com ou sem letra).
 * Playback de arquivo não vai: o áudio mora só no aparelho de quem escolheu.
 * Compressão pela API nativa do navegador (CompressionStream), sem biblioteca.
 */
const LINK_LONGO=8000;
function pacotePlaylist(p,comLetras){
  const cantorIds=[...new Set(p.itens.flatMap(i=>[i.cantorA,i.cantorB]).filter(Boolean))];
  const musicaIds=[...new Set(p.itens.map(i=>i.musicaId))];
  return{v:1,nome:p.nome,
    cantores:cantorIds.map(acharCantor).filter(Boolean).map(c=>({nome:c.nome,emoji:c.emoji,cor:c.cor})),
    musicas:musicaIds.map(acharMusica).filter(Boolean).map(m=>({title:m.title,artist:m.artist,album:m.album,duration:m.duration,offset:m.offset,
      playback:m.playback&&m.playback.tipo!=="arquivo"?m.playback:null,
      ...(comLetras?{synced:m.synced,lyrics:m.lyrics}:{})})),
    itens:p.itens.map(i=>({m:musicaIds.indexOf(i.musicaId),a:cantorIds.indexOf(i.cantorA),b:cantorIds.indexOf(i.cantorB)}))};
}
const b64url={
  de:bytes=>{let s="";bytes.forEach(b=>{s+=String.fromCharCode(b)});return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"")},
  para:str=>{const s=atob(str.replace(/-/g,"+").replace(/_/g,"/"));return Uint8Array.from(s,c=>c.charCodeAt(0))}
};
async function transformar(bytes,Stream){return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new Stream("deflate-raw"))).arrayBuffer())}
async function linkDaPlaylist(p,comLetras){
  const json=JSON.stringify(pacotePlaylist(p,comLetras));
  const base=location.href.split("#")[0].replace(/controle\.html.*$/,"").replace(/\?.*$/,"");
  if(typeof CompressionStream==="function"){
    try{return `${base}#playlistz=${b64url.de(await transformar(new TextEncoder().encode(json),CompressionStream))}`}catch{}
  }
  return `${base}#playlist=${encodeURIComponent(json)}`;
}
async function lerLinkPlaylist(hash){
  const z=hash.match(/#playlistz=([\w-]+)/),j=hash.match(/#playlist=(.+)$/);
  let json="";
  if(z){if(typeof DecompressionStream!=="function")throw Error("Este navegador não abre links compactados. Atualize o navegador.");json=new TextDecoder().decode(await transformar(b64url.para(z[1]),DecompressionStream))}
  else if(j)json=decodeURIComponent(j[1]);
  else return null;
  const d=JSON.parse(json);
  if(!d||d.v!==1||!Array.isArray(d.itens))throw Error("Link de playlist inválido.");
  return d;
}
// Recebe o pacote do link e cria a playlist aqui. Música e cantor que já
// existem (mesmo nome) são reaproveitados — a versão local tem a sincronia
// gravada por esta família.
function importarPacote(d){
  const cantores=(d.cantores||[]).map(c=>K.dados.cantores.find(x=>fold(x.nome)===fold(c.nome))||criarCantor(c));
  const musicas=(d.musicas||[]).map(m=>{
    const ja=musicaParecida(m.title,m.artist);
    if(ja){if(!temLetra(ja)&&(m.synced||m.lyrics))editarMusica(ja.id,{synced:m.synced||"",lyrics:m.lyrics||""},{compartilhar:false});if(!ja.playback&&m.playback)editarMusica(ja.id,{playback:m.playback});return ja}
    return criarMusica({title:m.title,artist:m.artist,album:m.album,duration:m.duration,offset:m.offset,playback:m.playback,synced:m.synced||"",lyrics:m.lyrics||""});
  });
  const p=criarPlaylist(d.nome||"Playlist recebida");
  d.itens.forEach(i=>{const m=musicas[i.m];if(m)adicionarItem(p,m.id,cantores[i.a]?.id,cantores[i.b]?.id)});
  return p;
}

/* -------------------------------------------------------- backup em arquivo */
function backupJSON(){
  const{cantores,musicas,playlists,activePlaylistId,placar}=K.dados;
  return JSON.stringify({app:"karaoke-em-casa",version:1,exportadoEm:new Date().toISOString(),activePlaylistId,cantores,musicas,playlists,placar},null,1);
}
function baixarArquivo(nome,conteudo,tipo){
  const url=URL.createObjectURL(new Blob([conteudo],{type:tipo}));
  const a=document.createElement("a");a.href=url;a.download=nome;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
}
// Lê o arquivo e devolve {dados, resumo} SEM aplicar nada.
async function lerBackup(arquivo){
  let bruto;
  try{bruto=JSON.parse(await arquivo.text())}catch{throw Error("Arquivo inválido: não é um backup do Karaokê em Casa.")}
  if(!bruto||bruto.app!=="karaoke-em-casa")throw Error("Este arquivo não é um backup do Karaokê em Casa.");
  const dados=normalizarDados({...bruto,prefs:K.dados.prefs});
  return{dados,resumo:{cantores:dados.cantores.length,musicas:dados.musicas.length,playlists:dados.playlists.length}};
}
function aplicarBackup(dados,modo){
  if(modo==="substituir"){
    K.dados={...dados,prefs:K.dados.prefs};
    return;
  }
  const tem=(lista,id)=>lista.some(x=>x.id===id);
  dados.cantores.forEach(c=>{if(!tem(K.dados.cantores,c.id))K.dados.cantores.push(c)});
  dados.musicas.forEach(m=>{if(!tem(K.dados.musicas,m.id))K.dados.musicas.push(m)});
  dados.playlists.forEach(p=>{if(!tem(K.dados.playlists,p.id))K.dados.playlists.push(p)});
  if(!playlistAtiva())K.dados.activePlaylistId=K.dados.playlists[0]?.id||"";
}
