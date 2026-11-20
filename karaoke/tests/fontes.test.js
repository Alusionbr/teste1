"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const L=require("../links.js");

test("YouTube: link comum, encurtado, shorts, embed e id puro",()=>{
  const id="dQw4w9WgXcQ";
  for(const s of [id,`https://www.youtube.com/watch?v=${id}&t=10`,`youtu.be/${id}?si=x`,`https://m.youtube.com/watch?v=${id}`,`https://www.youtube.com/shorts/${id}`,`https://www.youtube-nocookie.com/embed/${id}`])assert.equal(L.lerLinkYouTube(s),id,s);
});
test("YouTube Music usa o mesmo id",()=>{
  assert.equal(L.lerLinkYouTube("https://music.youtube.com/watch?v=dQw4w9WgXcQ&list=RDAMVM"),"dQw4w9WgXcQ");
  assert.equal(L.lerLinkYouTube("https://music.youtube.com/playlist?list=OLAK5uy"),"");
  assert.equal(L.ehPlaylistSemMusica("https://music.youtube.com/playlist?list=OLAK5uy"),true);
});
test("YouTube: recusa domínio parecido",()=>{
  assert.equal(L.lerLinkYouTube("https://youtube.com.golpe.net/watch?v=dQw4w9WgXcQ"),"");
  assert.equal(L.lerLinkYouTube("https://notyoutube.com/watch?v=dQw4w9WgXcQ"),"");
});
test("Spotify: link de faixa, com idioma, embed e URI",()=>{
  const id="4cOdK2wGLETKBW3PvgPWqT";
  for(const s of [`https://open.spotify.com/track/${id}?si=abc`,`https://open.spotify.com/intl-pt/track/${id}`,`https://open.spotify.com/embed/track/${id}`,`spotify:track:${id}`])assert.equal(L.lerLinkSpotify(s),id,s);
  assert.equal(L.lerLinkSpotify(`https://open.spotify.com/album/${id}`),"");
  assert.equal(L.lerLinkSpotify(`https://spotify.com.evil.io/track/${id}`),"");
});
test("links de busca levam título, artista e 'playback karaokê'",()=>{
  const u=new URL(L.linkBuscaYouTube({title:"Evidências",artist:"Chitãozinho & Xororó"}));
  assert.equal(u.searchParams.get("search_query"),"Evidências Chitãozinho & Xororó playback karaokê");
});
