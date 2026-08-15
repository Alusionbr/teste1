"use strict";
// Versão única do app: aparece no cache do service worker, no ?v= do HTML e
// no cabeçalho enviado ao LRCLIB. Bump obrigatório a cada alteração de arquivo.
const APP_VERSION="3.10.0";
const LRCLIB_HEADERS={Accept:"application/json","Lrclib-Client":`Estante/${APP_VERSION} (https://alusionbr.github.io/teste1/estante/)`};
const $=id=>document.getElementById(id);
/*
 * `karaoke` e `videoPlaying` são duas coisas separadas de propósito:
 *
 * - `karaoke` é o MODO — vídeo acoplado, letra por cima, pedaleira remapeada.
 *   Sobrevive à troca de música, que é justamente o que uma fila de festa é.
 * - `videoPlaying` é o relógio andando, e é espelho do que o player do YouTube
 *   informa, nunca chute nosso. Anúncio, buffer ou um toque dentro do próprio
 *   vídeo mudam o estado sem passar por nós; ler do player é o que impede o
 *   LED e a letra de discordarem do que está tocando.
 *
 * Nenhum dos dois é persistido: modo de festa não deve voltar sozinho amanhã.
 */
const state={results:[],setlist:[],setlists:[],activeSetlistId:"",tab:"results",source:"lrclib",current:null,currentIndex:-1,lines:[],lrc:[],scrolling:false,syncing:false,karaoke:false,videoPlaying:false,speed:18,speedGlobal:18,font:26,key:0,capo:0,auto:false,stage:false,keyVag:"",keyYT:"",audioDelay:0};
const KEYS={setlist:"estante:v2:setlist",setlists:"estante:v3:setlists",prefs:"estante:v2:prefs"};
const SHARP=["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"],FLAT=["C","Db","D","Eb","E","F","Gb","G","Ab","A","Bb","B"];
const CHORD=/^[A-G][#b]?(?:m|maj|min|M|dim|aug|sus|add|°|º|\+)?[0-9]*(?:(?:sus|add|maj|dim|aug|m|M|b|#|\+|-)[0-9]*)*(?:\([^)]*\))?(?:\/[A-G][#b]?)?$/;
let raf=null,lastFrame=0,pixelRest=0,syncStart=0,syncOffset=0,lastActive=-1,installPrompt=null,wakeLock=null;

async function fetchSafe(url,options={},timeout=12000){const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),timeout);try{return await fetch(url,{...options,signal:ctrl.signal})}catch(e){if(e.name==="AbortError")throw Error("A fonte demorou demais para responder. Tente novamente.");throw e}finally{clearTimeout(timer)}}
/*
 * Repete uma vez em erro passageiro do servidor (502/503/504 — "fora do ar
 * agora, tente de novo"). Nunca repete em 429: aí o servidor está pedindo
 * para esperar, e insistir na hora só piora. O Vagalume cai com frequência
 * real (balanceador devolvendo 503 por minutos seguidos); uma segunda
 * tentativa rápida resolve boa parte sem o usuário perceber.
 */
async function fetchRetrying(url,options={},timeout=12000){
  const first=await fetchSafe(url,options,timeout);
  if(![502,503,504].includes(first.status))return first;
  const wait=Math.min(3000,(Number(first.headers.get("Retry-After"))||1)*1000);
  await new Promise(res=>setTimeout(res,wait));
  return fetchSafe(url,options,timeout);
}
// Saúde das fontes nesta sessão: usada para avisar no seletor de busca quando
// uma fonte específica está fora do ar, em vez de deixar o usuário descobrir
// tentando. Não persiste — cada visita começa "sem informação".
const sourceStatus={};
function markSource(name,ok,detail){sourceStatus[name]={ok,at:Date.now(),detail}}
function sourceDown(name,maxAgeMs=120000){const s=sourceStatus[name];return!!s&&!s.ok&&(Date.now()-s.at)<maxAgeMs}

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
// `audioDelay` é do APARELHO, não da música: é o atraso da caixa Bluetooth
// daquele lugar. `keyYT`, como a chave do Vagalume, fica só aqui — nunca no
// link compartilhado, nunca enviada a outro serviço.
function updatePrefs(){save(KEYS.prefs,{source:state.source,speed:state.speedGlobal,font:state.font,stage:state.stage,keyVag:state.keyVag,keyYT:state.keyYT,audioDelay:state.audioDelay})}
function updatePrefsSoon(){saveSoon("prefs",updatePrefs)}
// Rolar e Sincro ficam desabilitados durante o karaokê: os três escreveriam no
// mesmo scrollTop/relógio ao mesmo tempo se pudessem ligar juntos. Sair do
// karaokê é o único jeito de voltar a usá-los — evita o usuário apertar um pedal
// e nada acontecer, sem entender por quê.
function updateControls(){document.documentElement.style.setProperty("--font",state.font+"px");$("speedOut").textContent=state.speed;$("fontOut").textContent=state.font;$("keyOut").textContent=(state.key>0?"+":"")+state.key;$("capoOut").textContent=state.capo;$("autoBtn").classList.toggle("on",state.auto);$("autoBtn").title=state.auto?"Velocidade calculada pela duração da música":"Calcular a velocidade pela duração da música";$("scrollBtn").classList.toggle("on",state.scrolling);$("scrollBtn").querySelector("b").textContent=state.scrolling?"Pausar":"Rolar";$("scrollBtn").disabled=state.karaoke;$("syncBtn").classList.toggle("on",state.syncing);$("syncBtn").disabled=state.karaoke||!state.lrc.length;$("karaokeBtn").classList.toggle("on",state.karaoke&&state.videoPlaying);$("karaokeBtn").querySelector("b").textContent=state.karaoke?(state.videoPlaying?"Pausar":"Tocar"):"Karaokê";$("stageBtn").textContent=state.stage?"Modo dia":"Modo palco";document.body.classList.toggle("stageMode",state.stage);document.body.classList.toggle("karaokeMode",state.karaoke)}

// Erro com um rótulo de fonte anexado, para a interface poder oferecer "tentar
// na Inteligente" só quando faz sentido (fonte fora do ar), não em qualquer erro.
function sourceError(name,msg){const e=Error(msg);e.source=name;return e}
async function searchMusic(q){
  if(state.source==="lrclib"){
    const r=await fetchSafe(`https://lrclib.net/api/search?q=${encodeURIComponent(q)}`,{headers:LRCLIB_HEADERS});
    if(r.status===429){const wait=r.headers.get("Retry-After");throw Error(`Muitas buscas seguidas no LRCLIB.${wait?` Tente novamente em ${wait}s.`:" Aguarde alguns segundos."}`)} if(!r.ok)throw Error(`LRCLIB respondeu ${r.status}`);
    markSource("lrclib",true);
    return (await r.json()).map(x=>({title:x.trackName||"Sem título",artist:x.artistName||"",album:x.albumName||"",duration:x.duration||0,lyrics:x.plainLyrics||"",synced:x.syncedLyrics||"",instrumental:!!x.instrumental,source:"LRCLIB"}));
  }
  const route=state.source==="excerpt"?"search.excerpt":"search.artmus";
  // A mensagem diz só o fato. Quem sugere o que fazer é search-ui.js, que sabe
  // em qual modo o usuário está: no Brasil vale tentar a Inteligente, no Trecho
  // não — nenhuma outra fonte procura dentro da letra.
  let r;try{r=await fetchRetrying(`https://api.vagalume.com.br/${route}?q=${encodeURIComponent(q)}&limit=10`)}catch(e){markSource("vagalume",false,e.message);throw sourceError("vagalume","O Vagalume não respondeu a tempo.")}
  if(!r.ok){markSource("vagalume",false,r.status);throw sourceError("vagalume",`O Vagalume está fora do ar agora (erro ${r.status}).`)}
  markSource("vagalume",true);const d=await r.json();
  return ((d.response&&d.response.docs)||[]).filter(x=>x.title).map(x=>({title:x.title,artist:x.band||"",album:"",duration:0,lyrics:"",synced:"",source:"Vagalume",vagId:x.id||"",vagUrl:x.url?"https://www.vagalume.com.br"+x.url:""}));
}
async function fetchVagalume(song){
  if(!state.keyVag)throw Error("Abra Fontes e salve sua chave gratuita do Vagalume para exibir a letra.");
  const base=`https://api.vagalume.com.br/search.php?apikey=${encodeURIComponent(state.keyVag)}`;let d=null;
  if(song.vagId){try{const id=String(song.vagId).replace(/^l/,"");const r=await fetchRetrying(`${base}&musid=${encodeURIComponent(id)}`);if(r.ok)d=await r.json()}catch{}}
  if(!d?.mus?.[0]?.text){
    let r;try{r=await fetchRetrying(`${base}&art=${encodeURIComponent(song.artist)}&mus=${encodeURIComponent(song.title)}`)}catch(e){markSource("vagalume",false,e.message);throw sourceError("vagalume","O Vagalume não respondeu a tempo.")}
    if(!r.ok){markSource("vagalume",false,r.status);throw sourceError("vagalume",`O Vagalume está fora do ar agora (erro ${r.status}).`)}
    d=await r.json();
  }
  markSource("vagalume",true);
  if(d?.captcha)throw Error("O Vagalume pediu verificação temporária por excesso de acessos. Tente novamente mais tarde.");
  if(!d?.mus?.[0]?.text)throw Error("A fonte não devolveu a letra desta versão.");
  song.lyrics=d.mus[0].text;song.vagUrl=d.mus[0].url||song.vagUrl;return song;
}

async function fetchLrclibSong(song){
  const qs=new URLSearchParams({track_name:song.title||""});if(song.artist)qs.set("artist_name",song.artist);
  const r=await fetchSafe(`https://lrclib.net/api/search?${qs}`,{headers:LRCLIB_HEADERS});
  if(r.status===429)throw Error("LRCLIB limitou temporariamente as buscas. Tente novamente em instantes.");if(!r.ok)throw Error(`LRCLIB respondeu ${r.status}`);
  markSource("lrclib",true);
  // Pega a primeira linha COM texto. Cair no rows[0] quando nenhuma tem letra
  // devolvia a música em branco como se fosse sucesso, e as fontes de reserva
  // nunca chegavam a ser tentadas.
  const rows=await r.json(),x=rows.find(v=>v.syncedLyrics||v.plainLyrics||v.instrumental);
  if(!x)throw Error("Não encontrei uma letra alternativa para esta música.");
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
