"use strict";
/*
 * Estado do app e regras de dados.
 *
 * Modelo (versão 1):
 *   { version:1, activePlaylistId,
 *     cantores:[{id, nome, emoji, cor}],
 *     musicas:[{id, title, artist, album, duration, synced, lyrics,
 *               playback:{tipo:"youtube"|"spotify"|"arquivo", id, titulo}|null,
 *               offset, criadaEm}],
 *     playlists:[{id, nome, itens:[{id, musicaId, cantorA, cantorB}], atualizadaEm}],
 *     placar:[{musicaId, nota, em}],   // notas do "Cantar sozinho" (placar.js)
 *     prefs:{audioDelay, tamanho, fundo, fundoV12, contagem, aplausometro, trava, keyYT} }
 *
 * A música mora na biblioteca e a playlist só aponta para ela: a sincronia
 * gravada e o ajuste da letra valem em todas as playlists.
 *
 * Ajuste da MÚSICA (offset, dueto) fica na música; ajuste do APARELHO (atraso
 * da caixa Bluetooth, tamanho da letra, chave do YouTube) fica em prefs.
 * Um nunca escreve no outro.
 */
const PREFS_PADRAO={audioDelay:0,tamanho:100,fundo:"tela",fundoV12:true,contagem:5,aplausometro:true,trava:true,keyYT:""};
const FUNDOS=["opaco","escuro","video","tela"];   // "tela": só o vídeo do YouTube, com a letra do próprio vídeo
const TIPOS_PLAYBACK=["youtube","spotify","arquivo"];

const K={dados:vazio(),pronto:false};

function vazio(){return{version:1,activePlaylistId:"",cantores:[],musicas:[],playlists:[],placar:[],prefs:{...PREFS_PADRAO}}}

const txt=(v,max)=>String(v??"").slice(0,max);
const num=(v,min,max,padrao)=>{const n=Number(v);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):padrao};
const idOk=v=>typeof v==="string"&&/^[\w-]{1,60}$/.test(v);
const corOk=v=>/^#[0-9a-f]{6}$/i.test(String(v||""));

function normalizarCantor(c){
  if(!c||!idOk(c.id))return null;
  return{id:c.id,nome:txt(c.nome,24).trim()||"Cantor",emoji:txt(c.emoji,8)||"🎤",cor:corOk(c.cor)?c.cor:"#ff3d9a"};
}
function normalizarPlayback(p){
  if(!p||!TIPOS_PLAYBACK.includes(p.tipo)||!idOk(p.id))return null;
  // duracao (s): duração do vídeo conhecida na escolha. É a referência do relógio da letra
  // para reconhecer anúncio; 0 = desconhecida (backups antigos).
  return{tipo:p.tipo,id:p.id,titulo:txt(p.titulo,160),duracao:num(p.duracao,0,14400,0)};
}
function normalizarMusica(m){
  if(!m||!idOk(m.id))return null;
  return{id:m.id,title:txt(m.title,160).trim()||"Sem título",artist:txt(m.artist,160).trim(),album:txt(m.album,160),
    duration:num(m.duration,0,3600,0),synced:txt(m.synced,60000),lyrics:txt(m.lyrics,60000),
    playback:normalizarPlayback(m.playback),letraDe:m.letraDe==="app"||m.letraDe==="video"?m.letraDe:"",offset:num(m.offset,-120,120,0),criadaEm:num(m.criadaEm,0,9e15,Date.now())};
}
function normalizarPlaylist(p,musicaIds,cantorIds){
  if(!p||!idOk(p.id))return null;
  const itens=(Array.isArray(p.itens)?p.itens:[]).filter(i=>i&&idOk(i.id)&&musicaIds.has(i.musicaId)).map(i=>({
    id:i.id,musicaId:i.musicaId,cantorA:cantorIds.has(i.cantorA)?i.cantorA:"",cantorB:cantorIds.has(i.cantorB)&&i.cantorB!==i.cantorA?i.cantorB:""
  }));
  return{id:p.id,nome:txt(p.nome,60).trim()||"Playlist",itens,atualizadaEm:num(p.atualizadaEm,0,9e15,Date.now())};
}
// Aceita qualquer coisa (arquivo importado, versão antiga, dado corrompido) e
// devolve um estado válido. Nunca lança: o que não presta é descartado.
function normalizarDados(d){
  const out=vazio();
  if(!d||typeof d!=="object")return out;
  out.cantores=(Array.isArray(d.cantores)?d.cantores:[]).map(normalizarCantor).filter(Boolean);
  out.musicas=(Array.isArray(d.musicas)?d.musicas:[]).map(normalizarMusica).filter(Boolean);
  const mIds=new Set(out.musicas.map(m=>m.id)),cIds=new Set(out.cantores.map(c=>c.id));
  out.playlists=(Array.isArray(d.playlists)?d.playlists:[]).map(p=>normalizarPlaylist(p,mIds,cIds)).filter(Boolean);
  out.activePlaylistId=out.playlists.some(p=>p.id===d.activePlaylistId)?d.activePlaylistId:(out.playlists[0]?.id||"");
  out.placar=(typeof normalizarPlacar==="function"?normalizarPlacar:require("./placar.js").normalizarPlacar)(d.placar,mIds);
  const pr=d.prefs||{};
  // 1.0.12: quem veio de versão antiga ficou com a letra do app por cima de vídeos que já trazem
  // a letra (em dobro). O padrão "só o vídeo" volta uma única vez; depois vale a escolha de cada um
  // (Ajustes) e a de cada música (letraDe).
  const fundo=pr.fundoV12?(FUNDOS.includes(pr.fundo)?pr.fundo:PREFS_PADRAO.fundo):PREFS_PADRAO.fundo;
  out.prefs={audioDelay:num(pr.audioDelay,0,800,0),tamanho:num(pr.tamanho,60,180,100),fundo,fundoV12:true,
    contagem:num(pr.contagem,0,15,5),aplausometro:pr.aplausometro!==false,trava:pr.trava!==false,keyYT:txt(pr.keyYT,80).trim()};
  return out;
}

async function carregarEstado(){
  const salvo=await KStore.carregar();
  K.dados=normalizarDados(salvo);
  K.pronto=true;
}
async function salvarEstado(){
  if(!K.pronto)return false;
  const ok=await KStore.salvar(K.dados);
  if(!ok)notify("Não consegui salvar no aparelho (armazenamento cheio?). Exporte um backup em Ajustes.");
  if(typeof aoMudarEstado==="function")aoMudarEstado();
  return ok;
}
function salvarLogo(){saveSoon("estado",salvarEstado)}

/* ------------------------------------------------------------------ busca */
const acharMusica=id=>K.dados.musicas.find(m=>m.id===id)||null;
const acharCantor=id=>K.dados.cantores.find(c=>c.id===id)||null;
const acharPlaylist=id=>K.dados.playlists.find(p=>p.id===id)||null;
const playlistAtiva=()=>acharPlaylist(K.dados.activePlaylistId);

if(typeof module!=="undefined")module.exports={normalizarDados,vazio,PREFS_PADRAO};
