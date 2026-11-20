"use strict";
/*
 * Reconhece links de playback. Arquivo PURO (testado em tests/fontes.test.js).
 *
 * YouTube Music usa o mesmo código de vídeo do YouTube: o link
 * music.youtube.com/watch?v=ID toca no mesmo player embutido e sincroniza pelo
 * mesmo relógio. Link de playlist sem "v=" não aponta para uma música só.
 */
function lerLinkYouTube(texto){
  const t=String(texto||"").trim();
  if(!t)return"";
  if(/^[\w-]{11}$/.test(t))return t;
  let u;try{u=new URL(/^https?:\/\//i.test(t)?t:"https://"+t)}catch{return""}
  if(!/(^|\.)(youtube\.com|youtube-nocookie\.com|youtu\.be)$/i.test(u.hostname))return"";
  if(/youtu\.be$/i.test(u.hostname)){const id=(u.pathname.split("/")[1]||"").slice(0,11);return /^[\w-]{11}$/.test(id)?id:""}
  const v=u.searchParams.get("v");
  if(v&&/^[\w-]{11}/.test(v))return v.slice(0,11);
  const m=u.pathname.match(/\/(embed|shorts|live|v)\/([\w-]{11})/);
  return m?m[2]:"";
}
function ehPlaylistSemMusica(texto){
  try{const u=new URL(/^https?:\/\//i.test(texto)?texto:"https://"+texto);return /youtube\.com$/i.test(u.hostname)&&u.searchParams.has("list")&&!u.searchParams.has("v")}catch{return false}
}

// open.spotify.com/track/ID, open.spotify.com/intl-pt/track/ID, /embed/track/ID
// ou spotify:track:ID. Só faixas: álbum e playlist não dão uma letra só.
function lerLinkSpotify(texto){
  const t=String(texto||"").trim();
  const uri=t.match(/^spotify:track:([A-Za-z0-9]{22})$/);
  if(uri)return uri[1];
  let u;try{u=new URL(/^https?:\/\//i.test(t)?t:"https://"+t)}catch{return""}
  if(!/(^|\.)open\.spotify\.com$/i.test(u.hostname))return"";
  const m=u.pathname.match(/\/track\/([A-Za-z0-9]{22})(?:$|\/)/);
  return m?m[1]:"";
}

function linkBuscaYouTube(musica){
  const q=`${musica&&musica.title||""} ${musica&&musica.artist||""} playback karaokê`.replace(/\s+/g," ").trim();
  return "https://www.youtube.com/results?search_query="+encodeURIComponent(q);
}
function linkBuscaSpotify(musica){
  const q=`${musica&&musica.title||""} ${musica&&musica.artist||""} karaoke`.replace(/\s+/g," ").trim();
  return "https://open.spotify.com/search/"+encodeURIComponent(q);
}

if(typeof module!=="undefined")module.exports={lerLinkYouTube,lerLinkSpotify,ehPlaylistSemMusica,linkBuscaYouTube,linkBuscaSpotify};
