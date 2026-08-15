"use strict";
const legacySearchMusic=searchMusic;
const legacyFetchLrclibSong=fetchLrclibSong;
const SEARCH_HEADERS=LRCLIB_HEADERS;
const EDITION_WORDS=/\b(ao vivo|live|remaster(?:ed)?|remix|acoustic|acustic[oa]|karaoke|instrumental|official(?: audio| video)?|audio|video|lyrics?|letra|vers[aã]o|version|deluxe|edit|radio edit|bonus track)\b/gi;
const searchFold=fold; // mesma normaliza\u00e7\u00e3o usada para identificar m\u00fasicas (core.js)
function cleanEdition(s){return String(s||"").replace(/[\[(][^\])]*(?:ao vivo|live|remaster|remix|acoustic|acústic|official|video|audio|version|versão)[^\])]*[\])]/gi," ").replace(EDITION_WORDS," ").replace(/\s+/g," ").trim()}
function searchTokens(s){return new Set(searchFold(s).split(" ").filter(x=>x.length>1))}
function overlapScore(a,b){const A=searchTokens(a),B=searchTokens(b);if(!A.size||!B.size)return 0;let hit=0;A.forEach(x=>{if(B.has(x))hit++});return hit/Math.max(A.size,B.size)}
function candidateScore(m,q){const qf=searchFold(q),tf=searchFold(m.title),af=searchFold(m.artist),hay=(tf+" "+af).trim();let score=overlapScore(q,hay)*100;if(hay===qf)score+=70;if(tf===qf)score+=55;if(hay.includes(qf)||qf.includes(hay))score+=25;if(m.synced)score+=12;else if(m.lyrics)score+=8;if((m.sources||[]).includes("Vagalume"))score+=4;if((m.sources||[]).includes("Apple"))score+=3;if((m.sources||[]).includes("Deezer"))score+=2;if((m.sources||[]).includes("MusicBrainz"))score+=2;return score}
function songKey(m){return searchFold(cleanEdition(m.title))+"|"+searchFold(String(m.artist||"").replace(/\b(feat\.?|ft\.?|com)\b.*$/i,""))}
function mergeSongs(rows,q){const map=new Map();for(const raw of rows){if(!raw||!raw.title)continue;const k=songKey(raw);const old=map.get(k);if(!old){const x={...raw,sources:[...(raw.sources||[raw.source].filter(Boolean))]};map.set(k,x);continue}const src=new Set([...(old.sources||[]),...(raw.sources||[raw.source].filter(Boolean))]);old.sources=[...src];for(const f of ["lyrics","synced","vagId","vagUrl","catalogUrl","appleId","album","duration"]){if(!old[f]&&raw[f])old[f]=raw[f]}if((raw.synced||raw.lyrics)&&!(old.synced||old.lyrics)){old.lyrics=raw.lyrics||"";old.synced=raw.synced||""}}
  const all=[...map.values()];for(const m of all){m.source=m.sources.join(" + ");m._score=candidateScore(m,q)}return all.sort((a,b)=>b._score-a._score||String(a.title).localeCompare(String(b.title))).slice(0,35)}
function queryVariants(q){const out=[q];const clean=cleanEdition(q);if(searchFold(clean)!==searchFold(q)&&clean.length>2)out.push(clean);const noFeat=clean.replace(/\b(feat\.?|ft\.?|com)\b.*$/i,"").trim();if(noFeat.length>2&&!out.some(x=>searchFold(x)===searchFold(noFeat)))out.push(noFeat);const dash=q.split(/\s[-–—]\s/).map(x=>x.trim()).filter(x=>x.length>2);for(const x of dash)if(!out.some(v=>searchFold(v)===searchFold(x)))out.push(x);return out.slice(0,3)}
async function searchLrclib(q){const r=await fetchSafe(`https://lrclib.net/api/search?q=${encodeURIComponent(q)}`,{headers:SEARCH_HEADERS});if(r.status===429)return[];if(!r.ok){markSource("lrclib",false,r.status);throw Error(`LRCLIB respondeu ${r.status}`)}markSource("lrclib",true);return(await r.json()).map(x=>({title:x.trackName||"Sem título",artist:x.artistName||"",album:x.albumName||"",duration:x.duration||0,lyrics:x.plainLyrics||"",synced:x.syncedLyrics||"",instrumental:!!x.instrumental,source:"LRCLIB",sources:["LRCLIB"],lrclibId:x.id||0}))}
async function searchVagalumeAdvanced(q,route="search.artmus"){const key=state.keyVag?`&apikey=${encodeURIComponent(state.keyVag)}`:"";const r=await fetchRetrying(`https://api.vagalume.com.br/${route}?q=${encodeURIComponent(q)}&limit=10${key}`);if(!r.ok){markSource("vagalume",false,r.status);return[]}markSource("vagalume",true);const d=await r.json();return((d.response&&d.response.docs)||[]).filter(x=>x.title).map(x=>({title:x.title,artist:x.band||"",album:"",duration:0,lyrics:"",synced:"",source:"Vagalume",sources:["Vagalume"],vagId:x.id||"",vagUrl:x.url?"https://www.vagalume.com.br"+x.url:""}))}
// Fontes por JSONP: a Apple e a Deezer não devolvem cabeçalho de CORS para
// fetch() direto do navegador, então o pedido vira uma tag <script> — a mesma
// técnica que já usávamos só para a Apple. Nenhuma das duas tem letra; entram
// só para achar a música certa (e a duração, que alimenta a rolagem automática)
// quando LRCLIB e Vagalume não conhecem essa versão.
function jsonp(src,callbackParam,timeout=8500){return new Promise(resolve=>{const cb=`estanteJsonp_${Date.now()}_${Math.random().toString(36).slice(2)}`;const s=document.createElement("script");let done=false;const finish=data=>{if(done)return;done=true;clearTimeout(timer);try{delete window[cb]}catch{}s.remove();resolve(data)};window[cb]=finish;s.onerror=()=>finish(null);s.src=`${src}${src.includes("?")?"&":"?"}${callbackParam}=${cb}`;document.head.appendChild(s);const timer=setTimeout(()=>finish(null),timeout)})}
function searchItunes(q){return jsonp(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&country=BR&media=music&entity=song&limit=25`,"callback").then(data=>{markSource("itunes",!!data);return((data&&data.results)||[]).filter(x=>x.wrapperType==="track"&&x.kind==="song").map(x=>({title:x.trackName||"",artist:x.artistName||"",album:x.collectionName||"",duration:x.trackTimeMillis?Math.round(x.trackTimeMillis/1000):0,lyrics:"",synced:"",source:"Apple",sources:["Apple"],catalogUrl:x.trackViewUrl||"",appleId:x.trackId||0}))})}
/*
 * MusicBrainz: catálogo aberto, sem chave e com CORS liberado para uso no
 * navegador.
 *
 * Não tem letra — entra por outro motivo. Ela conhece lançamento brasileiro,
 * regional e independente que Apple e Deezer não catalogam, e devolve o nome
 * do álbum e a duração exata da gravação. É isso que faz o LRCLIB casar no
 * /api/get (que exige álbum + duração) e a lyrics.ovh acertar a grafia do
 * artista. Ou seja: ajuda menos a "achar mais" e mais a identificar direito o
 * que já foi achado.
 *
 * O serviço pede no máximo uma consulta por segundo, então é chamada só uma
 * vez por busca — nunca dentro do laço de variações.
 */
async function searchMusicBrainz(q){
  const url=`https://musicbrainz.org/ws/2/recording?query=${encodeURIComponent(q)}&fmt=json&limit=12`;
  let r;try{r=await fetchSafe(url,{headers:{Accept:"application/json"}},10000)}catch{markSource("musicbrainz",false);return[]}
  if(!r.ok){markSource("musicbrainz",false,r.status);return[]}
  markSource("musicbrainz",true);
  const d=await r.json();
  return((d&&d.recordings)||[]).filter(x=>x&&x.title).map(x=>({
    title:x.title,
    artist:(x["artist-credit"]||[]).map(a=>a.name).filter(Boolean).join(", "),
    album:((x.releases||[])[0]||{}).title||"",
    duration:x.length?Math.round(x.length/1000):0,
    lyrics:"",synced:"",source:"MusicBrainz",sources:["MusicBrainz"],mbid:x.id||""
  }));
}
function searchDeezer(q){return jsonp(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=25&output=jsonp`,"callback").then(data=>{markSource("deezer",!!data&&!data.error);return((data&&data.data)||[]).map(x=>({title:x.title||"",artist:(x.artist&&x.artist.name)||"",album:(x.album&&x.album.title)||"",duration:x.duration||0,lyrics:"",synced:"",source:"Deezer",sources:["Deezer"],catalogUrl:x.link||"",deezerId:x.id||0}))})}
/*
 * Busca no que já está salvo neste aparelho: título, artista e o texto da letra.
 *
 * É a única busca que funciona sem internet, e a única que acha por trecho sem
 * depender do Vagalume — LRCLIB, Deezer e Apple só comparam título, artista e
 * álbum, nunca o conteúdo da letra. Como as músicas do repertório guardam a
 * letra inteira (inclusive as que você corrigiu na mão), procurar nelas por um
 * verso funciona sempre.
 */
function searchLocal(q){
  const alvo=searchFold(q);if(!alvo)return[];
  const achados=[],vistos=new Set();
  (state.setlists||[]).forEach(set=>{(set.songs||[]).forEach(song=>{
    const cabeca=searchFold(`${song.title} ${song.artist}`);
    const corpo=searchFold(`${song.lyrics||""} ${song.synced||""}`);
    const noTitulo=cabeca.includes(alvo),naLetra=corpo.includes(alvo);
    if(!noTitulo&&!naLetra)return;
    const k=songIdentity(song);if(vistos.has(k))return;vistos.add(k);
    achados.push({...song,source:"Repertório",sources:["Repertório"],local:true,localSetlist:set.name,matchedLyrics:!noTitulo&&naLetra});
  })});
  return achados;
}
// O que já está no aparelho vem primeiro: tem a letra baixada, as correções que
// você fez e o tom que você deixou marcado. O mesmo resultado vindo da rede é
// descartado para não aparecer duas vezes.
function withLocalFirst(locais,remotos){
  const vistos=new Set(locais.map(songIdentity));
  return[...locais,...(remotos||[]).filter(m=>!vistos.has(songIdentity(m)))];
}
async function smartSearchMusic(q){const variants=queryVariants(q),rows=[];const first=await Promise.allSettled([searchLrclib(q),searchVagalumeAdvanced(q),searchItunes(q),searchDeezer(q),searchMusicBrainz(q)]);first.forEach(x=>{if(x.status==="fulfilled")rows.push(...x.value)});let merged=mergeSongs(rows,q);if(merged.length<8&&variants.length>1){for(const v of variants.slice(1)){await new Promise(r=>setTimeout(r,300));try{rows.push(...await searchLrclib(v))}catch{}if(rows.length<60){try{rows.push(...await searchVagalumeAdvanced(v))}catch{}}merged=mergeSongs(rows,q);if(merged.length>=12)break}}
  if(merged.length<5){try{rows.push(...await searchVagalumeAdvanced(q,"search.excerpt"))}catch{}merged=mergeSongs(rows,q)}state.searchMeta={engine:"smart",count:merged.length,sources:[...new Set(merged.flatMap(x=>x.sources||[]))]};return merged}
searchMusic=async function(q){if(state.source==="smart")return smartSearchMusic(q);return legacySearchMusic(q)};
fetchLrclibSong=async function(song){
  if(song.title&&song.artist&&song.album&&song.duration){const qs=new URLSearchParams({track_name:song.title,artist_name:song.artist,album_name:song.album,duration:String(Math.round(song.duration))});try{const r=await fetchSafe(`https://lrclib.net/api/get?${qs}`,{headers:SEARCH_HEADERS},15000);if(r.ok){const x=await r.json();Object.assign(song,{album:x.albumName||song.album||"",duration:x.duration||song.duration||0,lyrics:x.plainLyrics||"",synced:x.syncedLyrics||"",instrumental:!!x.instrumental,source:"LRCLIB"});return song}}catch{}}
  try{return await legacyFetchLrclibSong(song)}catch(first){
    if(state.keyVag){try{const hits=await searchVagalumeAdvanced(`${song.artist} ${song.title}`);const best=hits.sort((a,b)=>candidateScore(b,`${song.artist} ${song.title}`)-candidateScore(a,`${song.artist} ${song.title}`))[0];if(best){song.vagId=best.vagId;song.vagUrl=best.vagUrl;return await fetchVagalume(song)}}catch{}}
    // Reservas antes de desistir. Faixa achada só no catálogo (Apple ou Deezer)
    // abria com "encontrei a música, mas não a letra"; e sem chave do Vagalume
    // não havia mais nada a tentar.
    // O acervo do site vem primeiro: é conteúdo próprio, conferido, e responde
    // sem rede. Depois a lyrics.ovh, que não pede chave e tem CORS aberto.
    try{const daCasa=await fetchFromAcervo(song);if(daCasa)return daCasa}catch{}
    try{const achou=await fetchLyricsOvh(song);if(achou)return achou}catch{}
    throw first;
  }
};
// Só letra simples: nada de cifra nem de marcação de tempo. Serve para não
// deixar a música sem texto nenhum quando as outras fontes falham.
//
// Ela casa por nome exato, então erra com "Fulano feat. Sicrano" ou
// "Canção (Ao Vivo)". Por isso tenta também a versão limpa do nome — é a
// diferença entre achar e não achar em boa parte dos casos.
async function fetchLyricsOvh(song){
  if(!song.artist||!song.title)return null;
  const semFeat=String(song.artist).replace(/\s*(\(|\[)?\b(feat\.?|ft\.?|part\.?|participação)\b.*$/i,"").trim();
  const semEdicao=cleanEdition(song.title);
  const tentativas=[[song.artist,song.title]];
  if(semFeat&&semEdicao&&(semFeat!==song.artist||semEdicao!==song.title))tentativas.push([semFeat||song.artist,semEdicao||song.title]);
  for(const[art,tit]of tentativas){
    let r;try{r=await fetchSafe(`https://api.lyrics.ovh/v1/${encodeURIComponent(art)}/${encodeURIComponent(tit)}`,{headers:{Accept:"application/json"}},15000)}catch{continue}
    if(!r.ok)continue;
    let texto="";try{texto=String((await r.json()||{}).lyrics||"").trim()}catch{}
    if(!texto)continue;
    markSource("lyricsovh",true);
    song.lyrics=texto.replace(/\r\n/g,"\n");song.synced="";song.source="lyrics.ovh";
    return song;
  }
  markSource("lyricsovh",false);
  return null;
}
