"use strict";
// Versão única do app: aparece no cache do service worker, no ?v= do HTML e
// no cabeçalho enviado ao LRCLIB. Bump obrigatório a cada alteração de arquivo.
const APP_VERSION="3.4.0";
const LRCLIB_HEADERS={Accept:"application/json","Lrclib-Client":`Estante/${APP_VERSION} (https://alusionbr.github.io/teste1/estante/)`};
const $=id=>document.getElementById(id);
const state={results:[],setlist:[],setlists:[],activeSetlistId:"",tab:"results",source:"lrclib",current:null,currentIndex:-1,lines:[],lrc:[],scrolling:false,syncing:false,speed:18,speedGlobal:18,font:26,key:0,capo:0,auto:false,stage:false,keyVag:""};
const KEYS={setlist:"estante:v2:setlist",setlists:"estante:v3:setlists",prefs:"estante:v2:prefs"};
const SHARP=["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"],FLAT=["C","Db","D","Eb","E","F","Gb","G","Ab","A","Bb","B"];
const CHORD=/^[A-G][#b]?(?:m|maj|min|M|dim|aug|sus|add|°|º|\+)?[0-9]*(?:(?:sus|add|maj|dim|aug|m|M|b|#|\+|-)[0-9]*)*(?:\([^)]*\))?(?:\/[A-G][#b]?)?$/;
let raf=null,lastFrame=0,pixelRest=0,syncStart=0,syncOffset=0,lastActive=-1,installPrompt=null,wakeLock=null;

async function fetchSafe(url,options={},timeout=12000){const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),timeout);try{return await fetch(url,{...options,signal:ctrl.signal})}catch(e){if(e.name==="AbortError")throw Error("A fonte demorou demais para responder. Tente novamente.");throw e}finally{clearTimeout(timer)}}

function load(k,fallback){try{const v=localStorage.getItem(k);return v?JSON.parse(v):fallback}catch{return fallback}}
// Devolve true quando gravou. Quando o armazenamento do navegador enche, o
// repertório deixaria de salvar em silêncio — por isso o aviso na tela.
function save(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch{notify("Armazenamento do navegador cheio: as últimas alterações não foram salvas. Exporte o repertório e apague músicas que não usa.");return false}}
/*
 * Gravar custa caro: serializa todos os repertórios, letra e tudo. Segurar um
 * botão da pedaleira faria isso a cada clique, no meio da rolagem — e a letra
 * engasgava. Ajuste fino (tom, capo, velocidade, anotação) agenda a gravação;
 * o que não pode se perder (adicionar, remover, trocar de repertório) continua
 * gravando na hora. flushSaves() fecha a conta ao sair da página.
 */
const pendingSaves=new Map();
function saveSoon(key,build,ms=700){const p=pendingSaves.get(key);if(p)clearTimeout(p.timer);pendingSaves.set(key,{build,timer:setTimeout(()=>{pendingSaves.delete(key);build()},ms)})}
function flushSaves(){const jobs=[...pendingSaves.values()];pendingSaves.clear();jobs.forEach(p=>{clearTimeout(p.timer);p.build()})}
// Identidade de música: ignora acento, maiúscula e pontuação, para não criar
// duplicata entre "Cotidiano" e "COTIDIANO " vindos de fontes diferentes.
function fold(s){return String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/&/g," e ").replace(/[^a-z0-9]+/g," ").trim()}
function songIdentity(m){return fold(m&&m.title)+"|"+fold(m&&m.artist)}
function sameSong(a,b){return songIdentity(a)===songIdentity(b)}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function notify(msg,ok=false){$("notice").innerHTML=msg?`<div class="notice ${ok?"ok":""}">${msg}</div>`:""}
function fmt(sec){if(!sec)return"";const m=Math.floor(sec/60),s=Math.floor(sec%60);return `${m}:${String(s).padStart(2,"0")}`}
// Lê "3:45", "3.45" ou "225" e devolve segundos. 0 quando não dá para entender.
function parseClock(text){const t=String(text||"").trim();if(!t)return 0;const m=t.match(/^(\d+)\s*[:.']\s*(\d{1,2})$/);if(m)return +m[1]*60+Math.min(59,+m[2]);const n=t.match(/^\d+$/);return n?+t:0}
function updateNetwork(){const n=$("network"),on=navigator.onLine;n.textContent=on?"online":"offline";n.className=on?"online":"offline";n.title=on?"Busca online disponível":"Sem internet: repertório salvo continua disponível"}
function updatePrefs(){save(KEYS.prefs,{source:state.source,speed:state.speedGlobal,font:state.font,stage:state.stage,keyVag:state.keyVag})}
function updatePrefsSoon(){saveSoon("prefs",updatePrefs)}
function updateControls(){document.documentElement.style.setProperty("--font",state.font+"px");$("speedOut").textContent=state.speed;$("fontOut").textContent=state.font;$("keyOut").textContent=(state.key>0?"+":"")+state.key;$("capoOut").textContent=state.capo;$("autoBtn").classList.toggle("on",state.auto);$("autoBtn").title=state.auto?"Velocidade calculada pela duração da música":"Calcular a velocidade pela duração da música";$("scrollBtn").classList.toggle("on",state.scrolling);$("scrollBtn").querySelector("b").textContent=state.scrolling?"Pausar":"Rolar";$("syncBtn").classList.toggle("on",state.syncing);$("stageBtn").textContent=state.stage?"Modo dia":"Modo palco";document.body.classList.toggle("stageMode",state.stage)}

async function searchMusic(q){
  if(state.source==="lrclib"){
    const r=await fetchSafe(`https://lrclib.net/api/search?q=${encodeURIComponent(q)}`,{headers:LRCLIB_HEADERS});
    if(r.status===429){const wait=r.headers.get("Retry-After");throw Error(`Muitas buscas seguidas no LRCLIB.${wait?` Tente novamente em ${wait}s.`:" Aguarde alguns segundos."}`)} if(!r.ok)throw Error(`LRCLIB respondeu ${r.status}`);
    return (await r.json()).map(x=>({title:x.trackName||"Sem título",artist:x.artistName||"",album:x.albumName||"",duration:x.duration||0,lyrics:x.plainLyrics||"",synced:x.syncedLyrics||"",instrumental:!!x.instrumental,source:"LRCLIB"}));
  }
  const route=state.source==="excerpt"?"search.excerpt":"search.artmus";
  const r=await fetchSafe(`https://api.vagalume.com.br/${route}?q=${encodeURIComponent(q)}&limit=10`);if(!r.ok)throw Error(`Vagalume respondeu ${r.status}`);const d=await r.json();
  return ((d.response&&d.response.docs)||[]).filter(x=>x.title).map(x=>({title:x.title,artist:x.band||"",album:"",duration:0,lyrics:"",synced:"",source:"Vagalume",vagId:x.id||"",vagUrl:x.url?"https://www.vagalume.com.br"+x.url:""}));
}
async function fetchVagalume(song){
  if(!state.keyVag)throw Error("Abra Fontes e salve sua chave gratuita do Vagalume para exibir a letra.");
  const base=`https://api.vagalume.com.br/search.php?apikey=${encodeURIComponent(state.keyVag)}`;let d=null;
  if(song.vagId){try{const id=String(song.vagId).replace(/^l/,"");const r=await fetchSafe(`${base}&musid=${encodeURIComponent(id)}`);if(r.ok)d=await r.json()}catch{}}
  if(!d?.mus?.[0]?.text){const r=await fetchSafe(`${base}&art=${encodeURIComponent(song.artist)}&mus=${encodeURIComponent(song.title)}`);if(!r.ok)throw Error(`Vagalume respondeu ${r.status}`);d=await r.json()}
  if(d?.captcha)throw Error("O Vagalume pediu verificação temporária por excesso de acessos. Tente novamente mais tarde.");
  if(!d?.mus?.[0]?.text)throw Error("A fonte não devolveu a letra desta versão.");
  song.lyrics=d.mus[0].text;song.vagUrl=d.mus[0].url||song.vagUrl;return song;
}

async function fetchLrclibSong(song){
  const qs=new URLSearchParams({track_name:song.title||""});if(song.artist)qs.set("artist_name",song.artist);
  const r=await fetchSafe(`https://lrclib.net/api/search?${qs}`,{headers:LRCLIB_HEADERS});
  if(r.status===429)throw Error("LRCLIB limitou temporariamente as buscas. Tente novamente em instantes.");if(!r.ok)throw Error(`LRCLIB respondeu ${r.status}`);
  const rows=await r.json(),x=rows.find(v=>v.syncedLyrics||v.plainLyrics)||rows[0];if(!x)throw Error("Não encontrei uma letra alternativa para esta música.");
  Object.assign(song,{album:x.albumName||song.album||"",duration:x.duration||song.duration||0,lyrics:x.plainLyrics||"",synced:x.syncedLyrics||"",instrumental:!!x.instrumental,source:"LRCLIB"});return song;
}
// Grava no repertório a versão aberta agora (letra carregada, tom, capo,
// velocidade e anotações) quando a música já faz parte do repertório ativo.
// Sem argumento grava a música inteira na hora (letra recém-carregada, texto
// editado). Com a lista de campos só atualiza esses campos e adia a escrita:
// é o caminho dos ajustes da pedaleira, que se repetem muito.
function persistCurrent(fields){
  if(!state.current)return;
  const i=state.setlist.findIndex(x=>sameSong(x,state.current));if(i<0)return;
  if(fields){fields.forEach(f=>{state.setlist[i][f]=state.current[f]});saveSetlistsSoon()}
  else{state.setlist[i]=storedSong(state.current);saveSetlists()}
}
function updateSaveButton(){if(!state.current){$("saveBtn").disabled=true;$("saveBtn").textContent="+ Repertório";return}const exists=state.setlist.some(x=>sameSong(x,state.current));$("saveBtn").disabled=exists;$("saveBtn").textContent=exists?"✓ Repertório":"+ Repertório"}
