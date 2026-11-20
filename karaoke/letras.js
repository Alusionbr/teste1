"use strict";
/*
 * Busca de letra.
 *
 * Fonte principal: LRCLIB (letra sincronizada, aberta, sem chave, com CORS).
 * Reserva: lyrics.ovh (só texto, sem tempo). Nada disso é cacheado pelo
 * service worker: a resposta da fonte vai direto para a música salva.
 *
 * Medido no Estante (22/10/2026): a busca livre do LRCLIB (?q=) devolve 503 em
 * ~1 de cada 4 consultas novas; repetir resolve, e a busca por título
 * (?track_name=) é outro caminho no servidor que respondeu 200 sempre.
 */
async function lrclibBuscaLivre(q){
  const r=await fetchRetrying(`https://lrclib.net/api/search?q=${encodeURIComponent(q)}`,{headers:LRCLIB_HEADERS});
  if(![502,503,504].includes(r.status))return r;
  try{const alt=await fetchSafe(`https://lrclib.net/api/search?track_name=${encodeURIComponent(q)}`,{headers:LRCLIB_HEADERS});if(alt.ok)return alt}catch{}
  return r;
}
function deLrclib(x){
  return{title:String(x.trackName||x.name||""),artist:String(x.artistName||""),album:String(x.albumName||""),
    duration:Math.round(Number(x.duration)||0),synced:x.instrumental?"":String(x.syncedLyrics||""),lyrics:x.instrumental?"":String(x.plainLyrics||""),
    instrumental:!!x.instrumental,fonte:"LRCLIB"};
}
// Ordena: com sincronia primeiro, depois com letra, depois parecido com o pedido.
function pontuar(r,q){
  const f=fold(q),t=fold(`${r.title} ${r.artist}`);
  let s=0;
  if(r.synced)s+=40;else if(r.lyrics)s+=20;
  if(f&&t.includes(f))s+=15;
  f.split(" ").forEach(w=>{if(w.length>1&&t.includes(w))s+=3});
  if(/\b(ao vivo|live|remix|acustic|acoustic)\b/.test(fold(r.title)))s-=4;
  return s;
}
async function buscarLetras(q){
  q=String(q||"").trim();
  if(q.length<2)return[];
  if(sourceCoolingDown("lrclib"))throw Error("A busca de letras está instável agora. Tente de novo em alguns segundos.");
  let r;
  try{r=await lrclibBuscaLivre(q)}catch(e){markSource("lrclib",false);throw Error("Sem resposta da busca de letras. Confira a internet.")}
  if(!r.ok){markSource("lrclib",false);throw Error(`A busca de letras respondeu erro ${r.status}. Tente de novo.`)}
  markSource("lrclib",true);
  const lista=(await r.json()).map(deLrclib).filter(x=>x.title);
  // Mesma música repetida em vários álbuns: fica a melhor de cada título+artista.
  const melhor=new Map();
  lista.forEach(x=>{const k=fold(x.title)+"|"+fold(x.artist),a=melhor.get(k);if(!a||pontuar(x,q)>pontuar(a,q))melhor.set(k,x)});
  return [...melhor.values()].sort((a,b)=>pontuar(b,q)-pontuar(a,q)).slice(0,25);
}

/*
 * Letra para uma música já cadastrada (título + artista digitados pela família).
 * Ordem: LRCLIB exato (com duração, se houver) → LRCLIB por título e artista
 * → lyrics.ovh (só texto). Devolve {synced, lyrics, duration, fonte} ou null.
 */
async function acharLetra(musica){
  const title=String(musica.title||"").trim(),artist=String(musica.artist||"").trim();
  if(!title)return null;
  if(!sourceCoolingDown("lrclib")){
    try{
      const p=new URLSearchParams({track_name:title,artist_name:artist});
      if(musica.duration)p.set("duration",String(Math.round(musica.duration)));
      const r=await fetchRetrying(`https://lrclib.net/api/get?${p}`,{headers:LRCLIB_HEADERS},10000);
      if(r.ok){markSource("lrclib",true);const x=deLrclib(await r.json());if(x.synced||x.lyrics)return x}
      else if(r.status!==404)markSource("lrclib",false);
      const p2=new URLSearchParams({track_name:title});if(artist)p2.set("artist_name",artist);
      const s=await fetchRetrying(`https://lrclib.net/api/search?${p2}`,{headers:LRCLIB_HEADERS},10000);
      if(s.ok){
        const lista=(await s.json()).map(deLrclib).filter(x=>x.synced||x.lyrics);
        // Sincronia de outra gravação sairia fora do tempo: com duração
        // conhecida, só aceita LRC com diferença de até 3 s.
        const certa=lista.find(x=>x.synced&&(!musica.duration||!x.duration||Math.abs(x.duration-musica.duration)<=3));
        if(certa)return certa;
        if(lista[0])return{...lista[0],synced:musica.duration&&lista[0].duration&&Math.abs(lista[0].duration-musica.duration)>3?"":lista[0].synced};
      }
    }catch{markSource("lrclib",false)}
  }
  if(artist){
    try{
      const r=await fetchSafe(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`,{},10000);
      if(r.ok){const d=await r.json();const lyrics=String(d.lyrics||"").replace(/^Paroles de la chanson.*\n/i,"").trim();if(lyrics)return{synced:"",lyrics,duration:0,fonte:"lyrics.ovh"}}
    }catch{}
  }
  return null;
}

/* ------------------------------------------------------------- YouTube */
// Título do vídeo pelo oEmbed (CORS aberto, sem chave): só para a família ver
// que colou o vídeo certo. O texto vem de terceiro e é escapado na exibição.
async function tituloYouTube(id){
  const url=`https://www.youtube.com/oembed?url=${encodeURIComponent("https://www.youtube.com/watch?v="+id)}&format=json`;
  const r=await fetchSafe(url,{headers:{Accept:"application/json"}},8000);
  if(!r.ok){
    // 401 = o dono proibiu tocar fora do YouTube; 404/400 = não existe ou é particular.
    const e=Error(r.status===401?"Este vídeo não pode tocar fora do YouTube (o dono bloqueou). Escolha outro playback.":r.status===404||r.status===400?"Vídeo não encontrado ou particular.":"Não consegui confirmar esse vídeo.");
    e.codigo=r.status;throw e;
  }
  const d=await r.json();
  return String(d.title||"").slice(0,160);
}
async function tituloSpotify(id){
  const r=await fetchSafe(`https://open.spotify.com/oembed?url=${encodeURIComponent("https://open.spotify.com/track/"+id)}`,{},8000);
  if(!r.ok)throw Error("Faixa do Spotify não encontrada.");
  const d=await r.json();
  return String(d.title||"").slice(0,160);
}
/*
 * Busca de playback dentro do app — só com a chave da API do YouTube que a
 * família colou em Ajustes (fica só neste aparelho). `videoEmbeddable=true`
 * traz apenas vídeos que tocam fora do YouTube: evita o erro 101/150 antes de
 * ele acontecer.
 */
async function buscarVideosYouTube(q,chave){
  const p=new URLSearchParams({part:"snippet",type:"video",videoEmbeddable:"true",maxResults:"8",q,key:chave,relevanceLanguage:"pt"});
  const r=await fetchSafe(`https://www.googleapis.com/youtube/v3/search?${p}`,{},10000);
  if(r.status===400||r.status===403){
    let motivo="";try{motivo=(await r.json()).error?.errors?.[0]?.reason||""}catch{}
    throw Error(motivo==="quotaExceeded"?"A cota diária de buscas do YouTube acabou. Use 'Procurar no YouTube' e cole o link.":"Chave do YouTube recusada. Confira a chave em Ajustes.");
  }
  if(!r.ok)throw Error("A busca do YouTube não respondeu. Tente de novo.");
  const d=await r.json();
  return(d.items||[]).filter(x=>x.id&&x.id.videoId).map(x=>({id:x.id.videoId,titulo:semEntidades(x.snippet?.title),canal:semEntidades(x.snippet?.channelTitle),thumb:String(x.snippet?.thumbnails?.default?.url||"")}));
}
// A API devolve o título com entidades HTML ("Don&#39;t"). Volta ao texto puro;
// a tela escapa de novo ao exibir.
function semEntidades(s){return String(s||"").replace(/&(amp|quot|#39|lt|gt);/g,(_,e)=>({amp:"&",quot:'"',"#39":"'",lt:"<",gt:">"}[e]))}
